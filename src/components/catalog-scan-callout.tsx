import { ScanLine } from "lucide-react";
import type { CatalogSource } from "@/lib/catalog/schema";

/**
 * The encyclopedia ships with a tiny hand-written reference sample so pages
 * aren't empty on first run. That sample is NOT authoritative — the real,
 * complete, U50-accurate catalog comes from an in-game scan. When the catalog
 * is still reference-only, tell the user exactly how to load the real thing.
 */
export function CatalogScanCallout({ source }: { source: CatalogSource | undefined }) {
  if (source === "ingame") return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400">
        <ScanLine className="h-5 w-5" />
      </span>
      <div className="text-sm text-fg-muted">
        <p className="font-medium text-fg">
          You&apos;re seeing a small reference sample — not the real in-game catalog.
        </p>
        <p className="mt-1 max-w-3xl">
          These pages currently show a hand-written placeholder set of entries, which is why numbers and details look
          incomplete or off. To load the full, live, U50-accurate encyclopedia straight from the game:
        </p>
        <ol className="mt-2 max-w-3xl list-decimal space-y-1 pl-5">
          <li>
            Log in, stand somewhere safe and go AFK, then type{" "}
            <code className="rounded bg-surface-2 px-1 text-fg">/nirncatalog</code> in chat. It walks the game&apos;s
            data tables — this takes a few seconds and is never run in combat.
          </li>
          <li>
            When it finishes, type <code className="rounded bg-surface-2 px-1 text-fg">/reloadui</code> (or log out) so
            the game writes the file.
          </li>
          <li>This app auto-detects the scan and upgrades every entry to in-game-verified. No re-download needed.</li>
        </ol>
        <p className="mt-2 text-xs text-fg-subtle">
          The <code className="rounded bg-surface-2 px-1">NirnsideCatalog</code> addon is installed automatically; just
          make sure it&apos;s enabled in the in-game AddOns menu.
        </p>
      </div>
    </div>
  );
}
