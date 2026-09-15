import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getGrimoires, getScripts } from "@/lib/db/catalog-queries";
import { knownScriptNames } from "@/lib/db/overlay";
import { getCatalogMeta } from "@/lib/catalog/import";
import { PageHeader } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
import { ScribingMatrix, type GrimoireLite, type ScriptLite } from "@/components/scribing-matrix";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

export default function ScribingPage() {
  const meta = safe(() => getCatalogMeta());
  const scriptMap = new Map<string, ScriptLite>();
  for (const { entry } of safe(() => getScripts()) ?? []) {
    scriptMap.set(entry.id, { id: entry.id, name: entry.name, effect: entry.effect });
  }
  const resolve = (ids: string[]) => ids.map((id) => scriptMap.get(id)).filter((x): x is ScriptLite => !!x);

  const grimoires: GrimoireLite[] = (safe(() => getGrimoires()) ?? []).map(({ entry }) => ({
    id: entry.id,
    name: entry.name,
    skillLine: entry.skillLine,
    description: entry.description,
    focus: resolve(entry.focusScripts),
    signature: resolve(entry.signatureScripts),
    affix: resolve(entry.affixScripts),
  }));

  const known = Array.from(safe(() => knownScriptNames()) ?? new Set<string>());

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/encyclopedia" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Encyclopedia
      </Link>
      <PageHeader
        title="Scribing"
        subtitle="Every grimoire and its full Focus × Signature × Affix combination matrix. Scripts your account knows are marked."
        action={meta ? <SourceBadge source={meta.source as CatalogSource} /> : undefined}
      />
      <CatalogScanCallout source={meta?.source as CatalogSource | undefined} />
      {grimoires.length === 0 ? (
        <p className="text-sm text-fg-muted">No grimoires in the catalog yet.</p>
      ) : (
        <ScribingMatrix grimoires={grimoires} knownScripts={known} />
      )}
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
