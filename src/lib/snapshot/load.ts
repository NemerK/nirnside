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
/**
 * Two different files are both named NirnsideSnapshot.lua:
 *   - the addon PROGRAM in  ...\AddOns\NirnsideSnapshot\NirnsideSnapshot.lua
 *   - the SAVED DATA in     ...\live\SavedVariables\NirnsideSnapshot.lua
 * People routinely grab the addon one (it's the file they have open). It is Lua
 * source, not a data table, so parsing it yields a cryptic "expected '='"
 * error. Detect it up front and say exactly which file to use instead.
 */
const WRONG_FILE_HINT =
  "This looks like the Nirnside addon program, not your saved account data. " +
  "Both files are named NirnsideSnapshot.lua — pick the one inside your SavedVariables folder " +
  "(Documents\\Elder Scrolls Online\\live\\SavedVariables\\NirnsideSnapshot.lua), which begins with " +
  "'NirnsideData = {'. The one in the AddOns folder is the addon itself and can't be read as data.";

function looksLikeAddonSource(src: string): boolean {
  const hasDataAssignment = /(^|\n)\s*NirnsideData\s*=/.test(src);
  if (hasDataAssignment) return false;
  return /(^|\n)\s*local\s+\w|\bfunction\s|\bSLASH_COMMANDS\b|\bEVENT_[A-Z]/.test(src);
}

export function loadSnapshotFromLua(src: string): AccountSnapshot {
  if (looksLikeAddonSource(src)) throw new Error(WRONG_FILE_HINT);

  let program: Record<string, LuaValue>;
  try {
    program = parseLua(src);
  } catch (err) {
    // If it doesn't parse and doesn't contain the data table, it's almost
    // certainly the wrong NirnsideSnapshot.lua (the addon), or some other file.
    if (!/(^|\n)\s*NirnsideData\s*=/.test(src)) throw new Error(WRONG_FILE_HINT);
    throw err;
  }
  const root = program["NirnsideData"];
  if (!isObject(root)) throw new Error("NirnsideData table not found in SavedVariables");

  const defaults = root["Default"];
  if (!isObject(defaults)) throw new Error("NirnsideData.Default not found");

  const accountKey = pickAccountKey(defaults);
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

const SAMPLE_ACCOUNT = "@azurastar";

export function isBundledSampleAccount(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === SAMPLE_ACCOUNT;
}

const SAMPLE_CHARACTER_NAMES = new Set(["Sings-With-Shadows", "Draugr-Bane", "Bakes-Sweet-Rolls"]);

/** True for the bundled tour fixture, even if it was saved under another filename. */
export function looksLikeBundledSample(snap: {
  displayName?: string | null;
  characters?: { name?: string }[];
}): boolean {
  if (isBundledSampleAccount(snap.displayName)) return true;
  const names = (snap.characters ?? []).map((c) => c.name).filter(Boolean) as string[];
  return names.filter((n) => SAMPLE_CHARACTER_NAMES.has(n)).length >= 2;
}

/**
 * A SavedVariables file can hold more than one @account. Prefer the live
 * roster with the most characters / newest snapshot, and never pick the
 * bundled @AzuraStar fixture when a real account is sitting next to it.
 */
function pickAccountKey(defaults: Record<string, LuaValue>): string | null {
  const keys = Object.keys(defaults).filter((k) => k.startsWith("@"));
  if (keys.length === 0) return null;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const key of keys) {
    const node = defaults[key];
    if (!isObject(node)) continue;
    const payload = isObject(node["$AccountWide"]) ? node["$AccountWide"] : node;
    const chars = isObject(payload) ? payload.characters : null;
    const n = Array.isArray(chars) ? chars.length : 0;
    const last = isObject(payload) && typeof payload.lastSnapshot === "number" ? payload.lastSnapshot : 0;
    let score = n * 1_000_000 + last;
    if (isBundledSampleAccount(key)) score -= 1_000_000_000;
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
}
