import type { ReactNode } from "react";
import Link from "next/link";
import { formatGold, formatNumber } from "@/lib/format";
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

/**
 * One account window: identity, currencies, and the progress that fits on screen.
 * Planner goals, the wallet table, and the catalog live on their own pages.
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
  const rows: { label: string; href: string; done: number; total: number }[] = [];
  if (stats.showStickerbook) {
    rows.push({
      label: "Sets",
      href: "/collections?tab=sets",
      done: stats.stickerCollected,
      total: stats.stickerTotal,
    });
  }
  if (stats.showStyles) {
    rows.push({
      label: "Styles",
      href: "/collections?tab=styles",
      done: stats.stylesUnlocked,
      total: stats.stylesTotal,
    });
  }
  if (stats.showKnowledge) {
    rows.push({
      label: "Research",
      href: "/knowledge",
      done: stats.knowledge.researchKnown,
      total: stats.knowledge.researchTotal,
    });
    rows.push({
      label: "Motifs",
      href: "/knowledge",
      done: stats.knowledge.motifKnown,
      total: stats.knowledge.motifTotal,
    });
  }
  if (stats.showAchievements) {
    rows.push({
      label: "Clears",
      href: "/achievements",
      done: stats.pithkaDone,
      total: stats.pithkaTotal,
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="h-0.5 bg-[var(--meter,#3dce7a)]" aria-hidden />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Chip>CP {stats.accountCP.toLocaleString("en-US")}</Chip>
          {stats.showCharacters ? (
            <Link href="/characters" className="rounded-md border border-border px-2 py-0.5 text-xs text-fg-muted hover:text-fg">
              {stats.characterCount} character{stats.characterCount === 1 ? "" : "s"}
              {stats.archivedCount > 0 ? ` · ${stats.archivedCount} archived` : ""}
            </Link>
          ) : null}
          {stats.showHouses ? (
            <Link href="/collections?tab=houses" className="rounded-md border border-border px-2 py-0.5 text-xs text-fg-muted hover:text-fg">
              {stats.housesCount} house{stats.housesCount === 1 ? "" : "s"}
            </Link>
          ) : null}
        </div>
        <Link href="/inventory?view=currency" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-fg-muted hover:text-fg">
          <span>{formatGold(currencies.gold)}</span>
          <span>{formatNumber(currencies.telVar)} TV</span>
          <span>{formatNumber(currencies.alliancePoints)} AP</span>
        </Link>
      </div>
      {account.guilds.length > 0 ? (
        <p className="border-b border-border px-4 py-2 text-xs text-fg-muted">
          {account.guilds.map((guild, index) => (
            <span key={guild.name}>
              {index > 0 ? <span className="text-fg-subtle"> · </span> : null}
              <span className="text-fg">{guild.name}</span>
              {guild.rank ? <span className="text-fg-subtle"> {guild.rank}</span> : null}
              {guild.trader ? <span className="text-[var(--meter,#3dce7a)]"> Trader</span> : null}
            </span>
          ))}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-fg-muted">
          Progress modules are off. Turn them back on in{" "}
          <Link href="/setup" className="text-accent hover:underline">
            Setup
          </Link>
          .
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.label} className="border-b border-border last:border-b-0">
              <ProgressRow {...row} />
            </li>
          ))}
        </ul>
      )}
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
  return (
    <div className="atlas-page mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col">
      <h1 className="sr-only">{account.displayName}</h1>
      <AccountOverview account={account} stats={stats} currencies={currencies} />
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-md border border-border px-2 py-0.5 text-xs text-fg">{children}</span>;
}

function ProgressRow({
  href,
  label,
  done,
  total,
}: {
  href: string;
  label: string;
  done: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <Link
      href={href}
      className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.75rem] items-center gap-3 px-4 py-2.5 hover:bg-surface-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_3rem_6.5rem]"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-[var(--meter-track,#3e4858)]">
        <span className="block h-full rounded-full bg-[var(--meter,#3dce7a)]" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right text-sm font-medium tabular-nums text-[var(--meter,#3dce7a)]">
        {total > 0 ? `${pct}%` : "—"}
      </span>
      <span className="hidden text-right text-xs tabular-nums text-fg-muted sm:block">
        {total > 0 ? `${done.toLocaleString("en-US")}/${total.toLocaleString("en-US")}` : ""}
      </span>
    </Link>
  );
}
