/**
 * Pure update decision. A missing local revision counts as pending, matching
 * the launcher: a fresh install should still offer Update. Offline (no remote
 * sha) and NIRNSIDE_SKIP_UPDATE stay quiet.
 */
export function isUpdateAvailable(
  current: string | null | undefined,
  remote: string | null | undefined,
  skipped: boolean,
): boolean {
  if (skipped) return false;
  const next = remote?.trim() || "";
  if (!next) return false;
  return (current?.trim() || "") !== next;
}

/**
 * The launcher URL the running app may ask to apply an update. Only a local
 * http origin is accepted, so a poisoned env var cannot send the request elsewhere.
 */
export function launcherApplyUrl(base: string | undefined | null): string | null {
  if (!base?.trim()) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:") return null;
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return null;
  if (url.username || url.password) return null;
  const port = url.port ? `:${url.port}` : "";
  return `${url.protocol}//${url.hostname}${port}/api/apply-update`;
}

/** Origin of a local launcher, for the browser to read update progress. */
export function launcherOrigin(base: string | undefined | null): string | null {
  const apply = launcherApplyUrl(base);
  if (!apply) return null;
  return apply.slice(0, -"/api/apply-update".length);
}
