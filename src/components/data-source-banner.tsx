import Link from "next/link";
import { CheckCircle2, FolderSearch, PackageCheck, TriangleAlert } from "lucide-react";
import type { AutoSetup, DataSource } from "@/lib/db/queries";
import { Card } from "./ui";
import { LoadLiveAccountButton } from "./demo-controls";

/**
 * Tells the user exactly where their data is coming from. The whole app is
 * auto-detected, so this makes "is this my real account?" answerable at a glance.
 */
export function DataSourceBanner({
  source,
  setup,
  sampleAccount = false,
}: {
  source: DataSource | null;
  setup?: AutoSetup | null;
  sampleAccount?: boolean;
}) {
  const showingSample = sampleAccount || source?.kind === "sample";
  if (showingSample) {
    const foundEso = (setup?.addOnsDirs.length ?? 0) > 0;
    return (
      <Card className="mb-6 flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
        {foundEso ? (
          <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        ) : (
          <FolderSearch className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        )}
        <div className="min-w-0 text-sm text-fg">
          <div className="font-medium">This is the sample account (@AzuraStar), not yours.</div>
          <p className="mt-1 text-fg-muted">
            {foundEso
              ? "Nirnside can see your ESO install. Click Load my ESO account to read SavedVariables (the file the Snapshot addon writes on logout)."
              : "Open Setup and point Nirnside at Documents\\Elder Scrolls Online, then click Load my ESO account."}{" "}
            <Link href="/setup" className="text-accent hover:underline">
              Setup
            </Link>
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <LoadLiveAccountButton />
        </div>
      </Card>
    );
  }

  if (!source) return null;

  if (!source.ok) {
    return (
      <Card className="mb-6 flex items-start gap-3 border-danger/40 p-4">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div className="text-sm text-fg">
          <span className="font-medium">Found your file but couldn&apos;t read it.</span>{" "}
          <span className="text-fg-muted">{source.path}</span>
          {source.error && <div className="mt-1 font-mono text-xs text-danger">{source.error}</div>}
          <div className="mt-2">
            <LoadLiveAccountButton />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-2 text-sm text-fg-muted">
      <CheckCircle2 className="h-4 w-4 text-ok" />
      Reading your account automatically from{" "}
      <code className="max-w-full break-all rounded bg-surface-2 px-1 text-fg">{source.path}</code>
      <span className="text-fg-subtle">({source.label})</span>
      <Link href="/setup" className="ml-1 text-accent hover:underline">
        Setup
      </Link>
    </div>
  );
}
