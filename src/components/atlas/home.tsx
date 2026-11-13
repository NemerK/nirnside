import Link from "next/link";
import { formatGold, formatNumber, timeAgo } from "@/lib/format";
import type { KnowledgeAccountSummary } from "@/lib/knowledge/present";

export interface AtlasHomeAccount {
  displayName: string;
  region: string;
  esoPlus: boolean;
  lastSnapshot: number | null;
  guilds: { name: string; rank: string | null; trader: boolean }[];
}

export interface AtlasHomeStats {
  characterCount: number;
  archivedCount: number;
  accountCP: number;
  stickerCollected: number;
  stickerTotal: number;
  housesCount: number;
  knowledge: KnowledgeAccountSummary;
  stylesUnlocked: number;
  stylesTotal: number;
  pithkaDone: number;
  pithkaTotal: number;
  showCharacters: boolean;
  showStickerbook: boolean;
  showStyles: boolean;
  showHouses: boolean;
  showKnowledge: boolean;
  showAchievements: boolean;
}

export interface AtlasHomeCurrencies {
  gold: number;
  telVar: number;
  alliancePoints: number;
}

interface StripCell {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  done?: number;
  total?: number;
}

/**
 * Account home in the same quiet cards as the rest of Nirnside: a fact strip,
 * the progress that fits on one row, then guilds.
 */
export function AccountOverview({
  account,
  stats,
  currencies,
}: {
  account: AtlasHomeAccount;
  stats: AtlasHomeStats;
  currencies: AtlasHomeCurrencies;
}) {
  const facts: StripCell[] = [
    { label: "Champion", value: stats.accountCP.toLocaleString("en-US") },
  ];
  if (stats.showCharacters) {
    facts.push({
      label: "Roster",
      value: String(stats.characterCount),
      hint: stats.archivedCount > 0 ? `${stats.archivedCount} archived` : undefined,
      href: "/characters",
    });
  }
  if (stats.showHouses) {
    facts.push({
      label: "Houses",
      value: String(stats.housesCount),
      href: "/collections#houses",
    });
  }
  facts.push(
    { label: "Gold", value: formatGold(currencies.gold), href: "/inventory?view=currency" },
    { label: "Tel Var", value: formatNumber(currencies.telVar), href: "/inventory?view=currency" },
    { label: "Alliance Points", value: formatNumber(currencies.alliancePoints), href: "/inventory?view=currency" },
  );

  const progress: StripCell[] = [];
  if (stats.showStickerbook) {
    progress.push({
      label: "Sets",
      value: stats.stickerTotal > 0 ? `${stats.stickerCollected}/${stats.stickerTotal}` : "—",
      done: stats.stickerCollected,
      total: stats.stickerTotal,
      href: "/collections#sets",
    });
  }
  if (stats.showStyles) {
    progress.push({
      label: "Styles",
      value: stats.stylesTotal > 0 ? `${stats.stylesUnlocked}/${stats.stylesTotal}` : "—",
      done: stats.stylesUnlocked,
      total: stats.stylesTotal,
      href: "/collections#styles",
    });
  }
  if (stats.showKnowledge) {
    progress.push(
      {
        label: "Research",
        value: stats.knowledge.researchTotal > 0 ? `${stats.knowledge.researchKnown}/${stats.knowledge.researchTotal}` : "—",
        done: stats.knowledge.researchKnown,
        total: stats.knowledge.researchTotal,
        href: "/knowledge",
      },
      {
        label: "Motifs",
        value: stats.knowledge.motifTotal > 0 ? `${stats.knowledge.motifKnown}/${stats.knowledge.motifTotal}` : "—",
        done: stats.knowledge.motifKnown,
        total: stats.knowledge.motifTotal,
        href: "/knowledge",
      },
    );
  }
  if (stats.showAchievements) {
    progress.push({
      label: "Clears",
      value: stats.pithkaTotal > 0 ? `${stats.pithkaDone}/${stats.pithkaTotal}` : "—",
      done: stats.pithkaDone,
      total: stats.pithkaTotal,
      href: "/achievements",
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{account.displayName}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {account.region}
          {account.esoPlus ? " · ESO+" : ""}
          {account.lastSnapshot ? ` · Snapshot ${timeAgo(account.lastSnapshot)}` : ""}
        </p>
      </header>

      <FactStrip cells={facts} />
      {progress.length > 0 ? <FactStrip cells={progress} meters /> : null}

      {account.guilds.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <h2 className="border-b border-border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
            Guilds
          </h2>
          <ul className="divide-y divide-border">
            {account.guilds.map((guild) => (
              <li key={guild.name} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-fg">{guild.name}</span>
                <span className="shrink-0 text-xs text-fg-subtle">
                  {guild.rank ?? "Member"}
                  {guild.trader ? " · trader" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FactStrip({ cells, meters = false }: { cells: StripCell[]; meters?: boolean }) {
  return (
    <div className={`mb-3 flex overflow-hidden rounded-lg border border-border bg-surface ${meters ? "" : ""}`}>
      {cells.map((cell, index) => {
        const pct = cell.total && cell.total > 0 ? Math.min(100, Math.round(((cell.done ?? 0) / cell.total) * 100)) : 0;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{cell.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">{cell.value}</span>
            </div>
            {cell.hint ? <p className="mt-0.5 truncate text-[10px] text-fg-subtle">{cell.hint}</p> : null}
            {meters ? (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
              </div>
            ) : null}
          </>
        );
        const className = `min-w-0 flex-1 px-3 py-1.5 ${index > 0 ? "border-l border-border" : ""} ${
          cell.href ? "hover:bg-surface-2/60" : ""
        }`;
        return cell.href ? (
          <Link key={cell.label} href={cell.href} className={className}>
            {inner}
          </Link>
        ) : (
          <div key={cell.label} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function AtlasHome({
  account,
  stats,
  currencies,
}: {
  account: AtlasHomeAccount;
  stats: AtlasHomeStats;
  currencies: AtlasHomeCurrencies;
}) {
  return <AccountOverview account={account} stats={stats} currencies={currencies} />;
}
