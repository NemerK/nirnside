import { CheckCircle2, FolderSearch, TriangleAlert } from "lucide-react";
import type { DataSource } from "@/lib/db/queries";
import { Card } from "./ui";

/**
 * Tells the user exactly where their data is coming from. The whole app is
 * auto-detected, so this makes "is this my real account?" answerable at a glance.
 */
export function DataSourceBanner({ source }: { source: DataSource | null }) {
  if (!source) return null;

  if (source.kind === "sample") {
    return (
      <Card className="mb-6 flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
        <FolderSearch className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div className="text-sm text-fg">
          <span className="font-medium">Showing sample data.</span> No ESO{" "}
          <code className="rounded bg-surface-2 px-1">SavedVariables</code> file was found on this machine, so Nirnside
          loaded a demo account. Two ways to see your real account:{" "}
          <span className="text-fg-muted">
            run Nirnside on the PC where you play ESO (with the{" "}
            <code className="rounded bg-surface-2 px-1">NirnsideSnapshot</code> addon) and it auto-detects your file —
            or, if this is running somewhere without ESO, drop your{" "}
            <code className="rounded bg-surface-2 px-1">NirnsideSnapshot.lua</code> into{" "}
            <code className="rounded bg-surface-2 px-1">data/incoming/</code> and it loads within seconds.
          </span>
        </div>
      </Card>
    );
  }

  if (!source.ok) {
    return (
      <Card className="mb-6 flex items-start gap-3 border-danger/40 p-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div className="text-sm text-fg">
          <span className="font-medium">Found your file but couldn&apos;t read it.</span>{" "}
          <span className="text-fg-muted">{source.path}</span>
          {source.error && <div className="mt-1 font-mono text-xs text-danger">{source.error}</div>}
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-2 text-sm text-fg-muted">
      <CheckCircle2 className="h-4 w-4 text-ok" />
      Reading your account automatically from{" "}
      <code className="rounded bg-surface-2 px-1 text-fg">{source.path}</code>
      <span className="text-fg-subtle">({source.label})</span>
    </div>
  );
}
