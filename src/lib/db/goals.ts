import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { getRole } from "./roles";
import { ESO_CLASSES } from "../classes";
import type { Goal, GoalDomain, GoalScope, GoalTier } from "../goals/types";
import { TIERS } from "../goals/types";
import { normalizeLineName } from "../goals/progress";

export function ensureGoalTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id          TEXT PRIMARY KEY,
      domain      TEXT NOT NULL DEFAULT 'skillline',
      tier        TEXT NOT NULL DEFAULT 'essential',
      scope       TEXT NOT NULL,
      characterId TEXT,
      scopeKey    TEXT,
      target      TEXT NOT NULL,
      targetRank  INTEGER NOT NULL DEFAULT 0,
      note        TEXT NOT NULL DEFAULT '',
      createdAt   INTEGER NOT NULL
    );
  `);
}

const DOMAINS: GoalDomain[] = ["skillline", "ability", "script"];
const SCOPES: GoalScope[] = ["account", "character", "role", "class"];

function db() {
  ensureGoalTables();
  return getDb();
}

function rowToGoal(r: {
  id: string;
  domain: string;
  tier: string;
  scope: string;
  characterId: string | null;
  scopeKey: string | null;
  target: string;
  targetRank: number;
  note: string;
  createdAt: number;
}): Goal {
  return {
    id: r.id,
    domain: (DOMAINS.includes(r.domain as GoalDomain) ? r.domain : "skillline") as GoalDomain,
    tier: (TIERS.includes(r.tier as GoalTier) ? r.tier : "essential") as GoalTier,
    scope: (SCOPES.includes(r.scope as GoalScope) ? r.scope : "account") as GoalScope,
    characterId: r.characterId,
    scopeKey: r.scopeKey,
    target: r.target,
    targetRank: Number.isFinite(r.targetRank) ? r.targetRank : 0,
    note: r.note ?? "",
    createdAt: r.createdAt,
  };
}

export function listGoals(): Goal[] {
  const rows = db()
    .prepare(
      `SELECT id, domain, tier, scope, characterId, scopeKey, target, targetRank, note, createdAt
       FROM goals
       ORDER BY createdAt ASC`,
    )
    .all() as Parameters<typeof rowToGoal>[0][];
  return rows.map(rowToGoal);
}

export function getGoal(id: string): Goal | null {
  const row = db()
    .prepare(
      `SELECT id, domain, tier, scope, characterId, scopeKey, target, targetRank, note, createdAt
       FROM goals WHERE id = ?`,
    )
    .get(id) as Parameters<typeof rowToGoal>[0] | undefined;
  return row ? rowToGoal(row) : null;
}

function assertTier(tier: string): GoalTier {
  const t = tier as GoalTier;
  if (!TIERS.includes(t)) throw new Error("A tier is Essential, Optional, or Completionist.");
  return t;
}

function canonicalClass(name: string): string {
  const hit = ESO_CLASSES.find((c) => c.toLowerCase() === name.trim().toLowerCase());
  if (!hit) {
    throw new Error(`Unknown class "${name.trim()}". Live classes: ${ESO_CLASSES.join(", ")}.`);
  }
  return hit;
}

function assertScope(
  scope: string,
  characterId: string | null,
  scopeKey: string | null,
): { scope: GoalScope; characterId: string | null; scopeKey: string | null } {
  const s = scope as GoalScope;
  if (!SCOPES.includes(s)) {
    throw new Error("A target applies to the account, a role, a class, or one character.");
  }
  if (s === "account") return { scope: s, characterId: null, scopeKey: null };
  if (s === "character") {
    const id = (characterId ?? "").trim();
    if (!id) throw new Error("Pick a character for a personal target.");
    return { scope: s, characterId: id, scopeKey: null };
  }
  const key = (scopeKey ?? "").trim();
  if (!key) throw new Error(s === "role" ? "Pick a role." : "Pick a class.");
  if (s === "role") {
    if (!getRole(key)) throw new Error("That role is gone. Pick an existing role.");
    return { scope: s, characterId: null, scopeKey: key };
  }
  return { scope: s, characterId: null, scopeKey: canonicalClass(key) };
}

function assertTarget(domain: GoalDomain, target: string): string {
  const name = domain === "skillline" ? normalizeLineName(target) : target.trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Pick what to target.");
  if (name.length > 100) throw new Error("Names are 100 characters or fewer.");
  return name;
}

function duplicate(
  domain: GoalDomain,
  scope: GoalScope,
  characterId: string | null,
  scopeKey: string | null,
  target: string,
  exceptId?: string,
): Goal | null {
  const rows = listGoals().filter(
    (g) =>
      g.domain === domain &&
      g.scope === scope &&
      (g.characterId ?? "") === (characterId ?? "") &&
      (g.scopeKey ?? "") === (scopeKey ?? "") &&
      g.target.toLowerCase() === target.toLowerCase() &&
      g.id !== exceptId,
  );
  return rows[0] ?? null;
}

export function createGoal(input: {
  domain?: string;
  tier?: string;
  scope: string;
  characterId?: string | null;
  scopeKey?: string | null;
  target?: string;
  /** Legacy field name for skill-line targets (old editor + tests). */
  lineName?: string;
  targetRank?: number;
  note?: string;
}): Goal {
  const domain = ((input.domain ?? (input.lineName ? "skillline" : "skillline")) as GoalDomain) ?? "skillline";
  if (!DOMAINS.includes(domain)) throw new Error("A target is a skill line, an ability, or a script.");
  const tier = assertTier(input.tier ?? "essential");
  const { scope, characterId, scopeKey } = assertScope(input.scope, input.characterId ?? null, input.scopeKey ?? null);
  const target = assertTarget(domain, input.target ?? input.lineName ?? "");
  const note = (input.note ?? "").trim().slice(0, 120);

  let targetRank = 0;
  if (domain === "skillline") {
    if (!Number.isInteger(Number(input.targetRank)) || Number(input.targetRank) < 1 || Number(input.targetRank) > 50) {
      throw new Error("Rank must be a whole number from 1 to 50.");
    }
    targetRank = Number(input.targetRank);
  }

  const dup = duplicate(domain, scope, characterId, scopeKey, target);
  if (dup) {
    throw new Error("That target already exists for this scope.");
  }

  const goal: Goal = {
    id: randomUUID(),
    domain,
    tier,
    scope,
    characterId,
    scopeKey,
    target,
    targetRank,
    note,
    createdAt: Date.now(),
  };
  db()
    .prepare(
      `INSERT INTO goals (id, domain, tier, scope, characterId, scopeKey, target, targetRank, note, createdAt)
       VALUES (@id, @domain, @tier, @scope, @characterId, @scopeKey, @target, @targetRank, @note, @createdAt)`,
    )
    .run(goal);
  return goal;
}

export function updateGoal(
  id: string,
  patch: { targetRank?: number; note?: string; tier?: string },
): Goal {
  const existing = getGoal(id);
  if (!existing) throw new Error("That target is gone.");
  let { targetRank } = existing;
  if (patch.targetRank != null) {
    if (existing.domain !== "skillline") throw new Error("Only skill-line targets have a rank.");
    const n = Number(patch.targetRank);
    if (!Number.isInteger(n) || n < 1 || n > 50) throw new Error("Rank must be a whole number from 1 to 50.");
    targetRank = n;
  }
  const note = patch.note != null ? patch.note.trim().slice(0, 120) : existing.note;
  const tier = patch.tier != null ? assertTier(patch.tier) : existing.tier;
  db().prepare("UPDATE goals SET targetRank = ?, note = ?, tier = ? WHERE id = ?").run(targetRank, note, tier, id);
  return { ...existing, targetRank, note, tier };
}

export function deleteGoal(id: string): void {
  db().prepare("DELETE FROM goals WHERE id = ?").run(id);
}
