import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { emptyBuild, type SavedBuild } from "../builds/saved";

function db() {
  return getDb();
}

function num(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function rowToBuild(row: { id: string; name: string; json: string; createdAt: number }): SavedBuild {
  let parsed: Partial<SavedBuild> = {};
  try {
    parsed = JSON.parse(row.json) as Partial<SavedBuild>;
  } catch {
    parsed = {};
  }
  const base = emptyBuild();
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    bodySetId: num(parsed.bodySetId) ?? base.bodySetId,
    bodyName: text(parsed.bodyName),
    monsterSetId: num(parsed.monsterSetId),
    monsterName: text(parsed.monsterName),
    monsterPieces: parsed.monsterPieces === 1 ? 1 : 2,
    mythicSetId: num(parsed.mythicSetId),
    mythicName: text(parsed.mythicName),
    frontSetId: num(parsed.frontSetId),
    frontName: text(parsed.frontName),
    backSetId: num(parsed.backSetId),
    backName: text(parsed.backName),
  };
}

export function listGearBuilds(): SavedBuild[] {
  const rows = db()
    .prepare("SELECT id, name, json, createdAt FROM gear_builds ORDER BY createdAt ASC")
    .all() as { id: string; name: string; json: string; createdAt: number }[];
  return rows.map(rowToBuild);
}

export function createGearBuild(input: { name: string } & Partial<SavedBuild>): SavedBuild {
  const name = input.name.trim();
  if (!name) throw new Error("Name the build.");
  const build = rowToBuild({
    id: randomUUID(),
    name,
    json: JSON.stringify(input),
    createdAt: Date.now(),
  });
  db()
    .prepare("INSERT INTO gear_builds (id, name, json, createdAt) VALUES (?, ?, ?, ?)")
    .run(build.id, build.name, JSON.stringify(build), build.createdAt);
  return build;
}

export function updateGearBuild(id: string, input: Partial<SavedBuild>): SavedBuild {
  const existing = db().prepare("SELECT id, name, json, createdAt FROM gear_builds WHERE id = ?").get(id) as
    | { id: string; name: string; json: string; createdAt: number }
    | undefined;
  if (!existing) throw new Error("That build is gone.");
  const current = rowToBuild(existing);
  const name = text(input.name) ?? current.name;
  const next = rowToBuild({
    id: current.id,
    name,
    json: JSON.stringify({ ...current, ...input, name }),
    createdAt: current.createdAt,
  });
  db().prepare("UPDATE gear_builds SET name = ?, json = ? WHERE id = ?").run(next.name, JSON.stringify(next), id);
  return next;
}

export function deleteGearBuild(id: string): void {
  db().prepare("DELETE FROM gear_builds WHERE id = ?").run(id);
}
