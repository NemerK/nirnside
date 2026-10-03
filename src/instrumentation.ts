/**
 * Next.js instrumentation hook. Runs once when the server process starts, so
 * simply launching the app (npm run dev / npm run start) also starts the
 * automatic SavedVariables detection + import + watch. No extra command needed.
 *
 * The locate/import work is deferred so `next start` can bind 127.0.0.1 and
 * answer /api/health first. The Windows exe waits on that probe; doing the
 * disk walk inside register() kept the wizard stuck at 98%.
 */
export async function register() {
  // Only in the Node.js server runtime (not edge, not the browser).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as unknown as { __nirnsideAutoStarted?: boolean };
  if (g.__nirnsideAutoStarted) return;
  g.__nirnsideAutoStarted = true;

  const { startAutoImport } = await import("./lib/snapshot/auto");
  setTimeout(() => {
    try {
      startAutoImport();
    } catch (err) {
      console.error(`[nirnside] auto-import failed to start: ${err instanceof Error ? err.message : err}`);
    }
  }, 1500);
}
