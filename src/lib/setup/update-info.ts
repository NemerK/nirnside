import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface UpdateInfo {
  repo: string;
  ref: string;
  source: "git" | "zip" | "unknown";
  sha: string | null;
  at: string | null;
  skipped: boolean;
}

const DEFAULT_REPO = "NemerK/nirnside";
const DEFAULT_REF = "main";

/**
 * What this install will track for updates (start-nirnside.cmd/.sh).
 * The account database is never part of an update.
 */
export function getUpdateInfo(): UpdateInfo {
  const skipped = process.env.NIRNSIDE_SKIP_UPDATE === "1";
  const repo = process.env.NIRNSIDE_UPDATE_REPO || DEFAULT_REPO;
  const fallbackRef = process.env.NIRNSIDE_UPDATE_REF || DEFAULT_REF;
  const git = existsSync(join(process.cwd(), ".git"));

  let sha: string | null = null;
  let at: string | null = null;
  let source: UpdateInfo["source"] = git ? "git" : "unknown";
  let ref = git ? "this git branch" : fallbackRef;

  const file = join(process.cwd(), ".nirnside-revision");
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as {
        sha?: string;
        at?: string;
        source?: UpdateInfo["source"];
        ref?: string;
        repo?: string;
      };
      sha = parsed.sha ?? null;
      at = parsed.at ?? null;
      if (parsed.source) source = parsed.source;
      if (parsed.ref) ref = parsed.ref;
    } catch {
      /* ignore */
    }
  }

  return { repo, ref, source, sha, at, skipped };
}
