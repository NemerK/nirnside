/**
 * Next.js instrumentation hook. Runs once when the server process starts, so
 * simply launching the app (npm run dev / npm run start) also starts the
 * automatic SavedVariables detection + import + watch. No extra command needed.
 */
export async function register() {
  // Only in the Node.js server runtime (not edge, not the browser).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __nirnsideAutoStarted?: boolean };
  if (g.__nirnsideAutoStarted) return;
  g.__nirnsideAutoStarted = true;

  const { startAutoImport } = await import("./lib/snapshot/auto");
  startAutoImport();
}
