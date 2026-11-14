import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The code revision the updater last applied. One small file; safe for the health probe. */
export function readLocalSha(root = process.cwd()): string | null {
  try {
    const file = join(root, ".nirnside-revision");
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { sha?: string };
    const sha = parsed.sha?.trim() || "";
    return sha || null;
  } catch {
    return null;
  }
}
