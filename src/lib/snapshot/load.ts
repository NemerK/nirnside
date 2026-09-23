import { readFileSync } from "node:fs";
import { parseLua, type LuaValue } from "./lua-parser";
import { AccountSnapshot } from "./schema";

/**
 * ESO's ZO_SavedVars account-wide layout wraps our payload:
 *
 *   NirnsideData = {
 *     ["Default"] = {
 *       ["@account"] = {
 *         ["$AccountWide"] = { ...our AccountSnapshot fields... }
 *       }
 *     }
 *   }
 *
 * This unwraps that, validates against the schema, and returns a typed snapshot.
 * On any structural problem it throws with a clear message rather than guessing —
 * accuracy over silent partial data.
 */
export function loadSnapshotFromLua(src: string): AccountSnapshot {
  const program = parseLua(src);
  const root = program["NirnsideData"];
  if (!isObject(root)) throw new Error("NirnsideData table not found in SavedVariables");

  const defaults = root["Default"];
  if (!isObject(defaults)) throw new Error("NirnsideData.Default not found");

  const accountKey = Object.keys(defaults).find((k) => k.startsWith("@"));
  if (!accountKey) throw new Error("No @account key found under NirnsideData.Default");

  const accountNode = defaults[accountKey];
  if (!isObject(accountNode)) throw new Error("Account node is not a table");

  const payload = accountNode["$AccountWide"] ?? accountNode;
  if (!isObject(payload)) throw new Error("$AccountWide payload not found");

  // Every field in AccountSnapshot degrades to a safe default (scalars via
  // .catch, lists via lenientArray), so a single odd value never blanks the
  // whole account. A hard failure here means the payload is not an object at
  // all — a genuinely unusable / wrong file.
  const parsed = AccountSnapshot.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Snapshot failed validation:\n" + JSON.stringify(parsed.error.format(), null, 2));
  }

  // The account name is the file's identity. If it was missing or unreadable,
  // fall back to the SavedVariables account key (e.g. "@AzuraStar") rather than
  // showing a nameless account.
  if (!parsed.data.displayName) {
    parsed.data.displayName = accountKey;
  }
  return parsed.data;
}

export function loadSnapshotFromFile(path: string): AccountSnapshot {
  return loadSnapshotFromLua(readFileSync(path, "utf8"));
}

function isObject(v: LuaValue | undefined): v is Record<string, LuaValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
