import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { getSkillLines } from "./catalog-queries";
import { getCharacters } from "./queries";
import type { Goal, GoalScope, SkillLineChoice } from "../goals/types";
import { mergeSkillLineChoices, normalizeLineName } from "../goals/progress";

export function ensureGoalTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id            TEXT PRIMARY KEY,
      scope         TEXT NOT NULL,
      characterId   TEXT,
      lineName      TEXT NOT NULL,
      targetRank    INTEGER NOT NULL,
      note          TEXT NOT NULL DEFAULT '',
      createdAt     INTEGER NOT NULL
    );
  `);
}

function db() {
  ensureGoalTables();
  return getDb();
}

function rowToGoal(r: {
  id: string;
  scope: string;
  characterId: string | null;
  lineName: string;
  targetRank: number;
  note: string;
  createdAt: number;
}): Goal {
  return {
    id: r.id,
    scope: r.scope === "character" ? "character" : "account",
    characterId: r.characterId,
    lineName: r.lineName,
    targetRank: r.targetRank,
    note: r.note ?? "",
    createdAt: r.createdAt,
  };
}

export function listGoals(): Goal[] {
  const rows = db()
    .prepare(
      `SELECT id, scope, characterId, lineName, targetRank, note, createdAt
       FROM goals
       ORDER BY createdAt ASC`,
    )
    .all() as Parameters<typeof rowToGoal>[0][];
  return rows.map(rowToGoal);
}

export function getGoal(id: string): Goal | null {
  const row = db()
    .prepare(
      `SELECT id, scope, characterId, lineName, targetRank, note, createdAt FROM goals WHERE id = ?`,
    )
    .get(id) as Parameters<typeof rowToGoal>[0] | undefined;
  return row ? rowToGoal(row) : null;
}

function assertRank(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 50) {
    throw new Error("Rank must be a whole number from 1 to 50.");
  }
  return n;
}

function assertScope(scope: string, characterId: string | null): { scope: GoalScope; characterId: string | null } {
  if (scope === "account") return { scope: "account", characterId: null };
  if (scope === "character") {
    const id = (characterId ?? "").trim();
    if (!id) throw new Error("Pick a character for a personal goal.");
    return { scope: "character", characterId: id };
  }
  throw new Error("A goal is either account-wide or for one character.");
}

function duplicate(scope: GoalScope, characterId: string | null, lineName: string, exceptId?: string): Goal | null {
  const rows = listGoals().filter(
    (g) =>
      g.scope === scope &&
      (g.characterId ?? "") === (characterId ?? "") &&
      normalizeLineName(g.lineName).toLowerCase() === lineName.toLowerCase() &&
      g.id !== exceptId,
  );
  return rows[0] ?? null;
}

export function createGoal(input: {
  scope: string;
  characterId?: string | null;
  lineName: string;
  targetRank: number;
  note?: string;
}): Goal {
  const { scope, characterId } = assertScope(input.scope, input.characterId ?? null);
  const lineName = normalizeLineName(input.lineName);
  if (!lineName) throw new Error("Pick a skill line.");
  if (lineName.length > 64) throw new Error("Skill line names are 64 characters or fewer.");
  const targetRank = assertRank(Number(input.targetRank));
  const note = (input.note ?? "").trim().slice(0, 120);

  if (duplicate(scope, characterId, lineName)) {
    throw new Error(
      scope === "account"
        ? `An account-wide ${lineName} goal already exists.`
        : `This character already has a ${lineName} goal.`,
    );
  }

  const goal: Goal = {
    id: randomUUID(),
    scope,
    characterId,
    lineName,
    targetRank,
    note,
    createdAt: Date.now(),
  };
  db()
    .prepare(
      `INSERT INTO goals (id, scope, characterId, lineName, targetRank, note, createdAt)
       VALUES (@id, @scope, @characterId, @lineName, @targetRank, @note, @createdAt)`,
    )
    .run(goal);
  return goal;
}

export function updateGoal(
  id: string,
  patch: { targetRank?: number; note?: string },
): Goal {
  const existing = getGoal(id);
  if (!existing) throw new Error("That goal is gone.");
  const targetRank = patch.targetRank != null ? assertRank(Number(patch.targetRank)) : existing.targetRank;
  const note = patch.note != null ? patch.note.trim().slice(0, 120) : existing.note;
  db().prepare("UPDATE goals SET targetRank = ?, note = ? WHERE id = ?").run(targetRank, note, id);
  return { ...existing, targetRank, note };
}

export function deleteGoal(id: string): void {
  db().prepare("DELETE FROM goals WHERE id = ?").run(id);
}

/** Catalog lines plus any names already on the account (in-game snapshot wins for extras). */
export function skillLineChoices(): SkillLineChoice[] {
  let catalog: SkillLineChoice[] = [];
  try {
    catalog = getSkillLines().map(({ entry }) => ({ name: entry.name, category: entry.category }));
  } catch {
    catalog = [];
  }
  const fromChars: SkillLineChoice[] = [];
  try {
    for (const c of getCharacters()) {
      for (const l of c.skillLines) fromChars.push({ name: l.name, category: l.category });
    }
  } catch {
    // no roster yet
  }
  return mergeSkillLineChoices(catalog, fromChars);
}
