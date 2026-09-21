import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { ROLE_COLOR_RE, type Role, type RoleAssignments } from "../roles/types";

export function ensureRoleTables() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      sortOrder  INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS character_roles (
      characterId  TEXT NOT NULL,
      roleId       TEXT NOT NULL,
      PRIMARY KEY (characterId, roleId),
      FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE
    );
  `);
}

function db() {
  ensureRoleTables();
  return getDb();
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function assertColor(color: string): string {
  const c = color.trim();
  if (!ROLE_COLOR_RE.test(c)) throw new Error("Color must be a hex value like #3f7fd6.");
  return c.toLowerCase();
}

export function listRoles(): Role[] {
  return db()
    .prepare("SELECT id, name, color, sortOrder FROM roles ORDER BY sortOrder ASC, name ASC")
    .all() as Role[];
}

/** characterId → role ids. Survives snapshot re-imports. */
export function listAssignments(): RoleAssignments {
  const rows = db()
    .prepare(
      `SELECT cr.characterId, cr.roleId
       FROM character_roles cr
       LEFT JOIN roles r ON r.id = cr.roleId
       ORDER BY r.sortOrder ASC, r.name ASC`,
    )
    .all() as { characterId: string; roleId: string }[];
  const out: RoleAssignments = {};
  for (const r of rows) {
    (out[r.characterId] ??= []).push(r.roleId);
  }
  return out;
}

export function getRole(id: string): Role | null {
  const row = db().prepare("SELECT id, name, color, sortOrder FROM roles WHERE id = ?").get(id) as Role | undefined;
  return row ?? null;
}

export function createRole(rawName: string, rawColor: string): Role {
  const name = normalizeName(rawName);
  if (!name) throw new Error("Give the role a name.");
  if (name.length > 32) throw new Error("Role names are 32 characters or fewer.");
  const color = assertColor(rawColor);

  const conn = db();
  const taken = conn.prepare("SELECT id FROM roles WHERE lower(name) = lower(?)").get(name) as
    | { id: string }
    | undefined;
  if (taken) throw new Error(`A role named “${name}” already exists.`);

  const max = conn.prepare("SELECT COALESCE(MAX(sortOrder), -1) AS m FROM roles").get() as { m: number };
  const role: Role = { id: randomUUID(), name, color, sortOrder: max.m + 1 };
  conn.prepare("INSERT INTO roles (id, name, color, sortOrder) VALUES (@id, @name, @color, @sortOrder)").run(role);
  return role;
}

export function updateRole(id: string, patch: { name?: string; color?: string }): Role {
  const existing = getRole(id);
  if (!existing) throw new Error("That role is gone.");
  const name = patch.name != null ? normalizeName(patch.name) : existing.name;
  if (!name) throw new Error("Give the role a name.");
  if (name.length > 32) throw new Error("Role names are 32 characters or fewer.");
  const color = patch.color != null ? assertColor(patch.color) : existing.color;

  const conn = db();
  const clash = conn.prepare("SELECT id FROM roles WHERE lower(name) = lower(?) AND id <> ?").get(name, id) as
    | { id: string }
    | undefined;
  if (clash) throw new Error(`A role named “${name}” already exists.`);

  conn.prepare("UPDATE roles SET name = ?, color = ? WHERE id = ?").run(name, color, id);
  return { ...existing, name, color };
}

export function deleteRole(id: string): void {
  db().prepare("DELETE FROM roles WHERE id = ?").run(id);
}

export function setCharacterRole(characterId: string, roleId: string, assigned: boolean): void {
  const id = characterId.trim();
  if (!id) throw new Error("Missing character.");
  const conn = db();
  if (!assigned) {
    conn.prepare("DELETE FROM character_roles WHERE characterId = ? AND roleId = ?").run(id, roleId);
    return;
  }
  if (!getRole(roleId)) throw new Error("That role is gone.");
  conn.prepare("INSERT OR IGNORE INTO character_roles (characterId, roleId) VALUES (?, ?)").run(id, roleId);
}

export function clearCharacterRoles(characterId: string): void {
  const id = characterId.trim();
  if (!id) throw new Error("Missing character.");
  db().prepare("DELETE FROM character_roles WHERE characterId = ?").run(id);
}
