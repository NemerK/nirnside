import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { globalSearch, type SearchHit } from "@/lib/db/search";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();

  let results = { catalog: [] as SearchHit[], account: [] as SearchHit[], total: 0 };
  if (q) {
    try {
      results = globalSearch(q);
    } catch {
      // leave empty
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={q ? `Search: “${q}”` : "Search"} subtitle="One search across your account and the whole catalog." />

      {!q ? (
        <EmptyState title="Search everything" icon={<SearchIcon className="h-8 w-8" />}>
          Find sets, skills, Champion stars, scribing scripts, achievements, your characters (name, class, race, role)
          and items — all from one box in the header.
        </EmptyState>
      ) : results.total === 0 ? (
        <EmptyState title="No matches" icon={<SearchIcon className="h-8 w-8" />}>
          Nothing in your account or the catalog matches “{q}”.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {results.account.length > 0 && <Group title="Your account" hits={results.account} />}
          {results.catalog.length > 0 && <Group title="Catalog" hits={results.catalog} />}
        </div>
      )}
    </div>
  );
}

function Group({ title, hits }: { title: string; hits: SearchHit[] }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        {title} · {hits.length}
      </h2>
      <Card className="divide-y divide-border">
        {hits.map((h, i) => (
          <Link key={i} href={h.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50">
            <span className="w-28 shrink-0 text-xs uppercase tracking-wide text-fg-subtle">{h.kind}</span>
            <span className="flex-1 truncate font-medium text-fg">{h.name}</span>
            {h.detail && <span className="shrink-0 text-sm text-fg-muted">{h.detail}</span>}
          </Link>
        ))}
      </Card>
    </div>
  );
}
