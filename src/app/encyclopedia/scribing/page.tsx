import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getGrimoires, getScripts } from "@/lib/db/catalog-queries";
import { knownScriptNames } from "@/lib/db/overlay";
import { getCatalogMeta } from "@/lib/catalog/import";
import { PageFrame, PageHeader } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
import { ScribingMatrix, type GrimoireLite, type ScriptLite } from "@/components/scribing-matrix";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

export default function ScribingPage() {
  const meta = safe(() => getCatalogMeta());
  const book: ScriptLite[] = (safe(() => getScripts()) ?? []).map(({ entry }) => ({
    id: entry.id,
    name: entry.name,
    effect: entry.effect,
    slot: entry.slot,
    icon: entry.icon,
  }));
  const scriptMap = new Map(book.map((s) => [s.id, s]));
  const resolve = (ids: string[]) => ids.map((id) => scriptMap.get(id)).filter((x): x is ScriptLite => !!x);

  const grimoires: GrimoireLite[] = (safe(() => getGrimoires()) ?? []).map(({ entry }) => ({
    id: entry.id,
    name: entry.name,
    skillLine: entry.skillLine,
    description: entry.description,
    icon: entry.icon,
    focus: resolve(entry.focusScripts),
    signature: resolve(entry.signatureScripts),
    affix: resolve(entry.affixScripts),
  }));

  const known = Array.from(safe(() => knownScriptNames()) ?? new Set<string>());

  return (
    <PageFrame>
      <Link href="/encyclopedia" className="mb-4 inline-flex shrink-0 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Encyclopedia
      </Link>
      <PageHeader
        title="Scribing"
        subtitle="The live script book, grouped by slot. Scripts your account knows are marked. A grimoire lists only the scripts it is known to accept."
        action={meta ? <SourceBadge source={meta.source as CatalogSource} /> : undefined}
      />
      <CatalogScanCallout source={meta?.source as CatalogSource | undefined} />
      {grimoires.length === 0 ? (
        <p className="text-sm text-fg-muted">No grimoires in the catalog yet.</p>
      ) : (
        <ScribingMatrix grimoires={grimoires} knownScripts={known} book={book} />
      )}
    </PageFrame>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
