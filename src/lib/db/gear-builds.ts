import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { emptyBuild, type SavedBuild } from "../builds/saved";
import { isTwoHandedWeapon, parseFrontWeapon } from "../builds/slots";
import { ARMOR_TRAITS, defaultTraitPlan, isArmorWeight, JEWELRY_TRAITS, WEAPON_TRAITS, type ArmorWeight } from "../builds/traits";

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
  const frontMain = parseFrontWeapon(typeof parsed.frontMain === "string" ? parsed.frontMain : "");
  const frontOff = parseFrontWeapon(typeof parsed.frontOff === "string" ? parsed.frontOff : "");
  const plan = defaultTraitPlan();
  const weight: ArmorWeight = isArmorWeight(parsed.weight) ? parsed.weight : plan.weight;
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
    frontMain,
    frontOff: frontMain && !isTwoHandedWeapon(frontMain) && frontOff && !isTwoHandedWeapon(frontOff) ? frontOff : null,
    backSetId: num(parsed.backSetId),
    backName: text(parsed.backName),
    weight,
    armorTrait: listed(parsed.armorTrait, ARMOR_TRAITS, plan.armorTrait),
    jewelryTrait: listed(parsed.jewelryTrait, JEWELRY_TRAITS, plan.jewelryTrait),
    frontTrait: listed(parsed.frontTrait, WEAPON_TRAITS, plan.frontTrait),
    backTrait: listed(parsed.backTrait, WEAPON_TRAITS, plan.backTrait),
  };
}

function listed(value: unknown, allowed: readonly string[], fallback: string): string {
  const name = text(value);
  if (!name) return fallback;
  return allowed.find((trait) => trait.toLowerCase() === name.toLowerCase()) ?? fallback;
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
