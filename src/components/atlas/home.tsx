import type { ReactNode } from "react";
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

interface ProgressCell {
  label: string;
  done: number;
  total: number;
  href: string;
}

/**
 * Account home as a few grouped cards: who you are, the wallet, progress,
 * and guilds as their own tiles.
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
  const identity: { label: string; value: string; hint?: string; href?: string }[] = [
    { label: "Champion", value: stats.accountCP.toLocaleString("en-US") },
  ];
  if (stats.showCharacters) {
    identity.push({
      label: "Roster",
      value: String(stats.characterCount),
      hint: stats.archivedCount > 0 ? `${stats.archivedCount} archived` : undefined,
      href: "/characters",
    });
  }
  if (stats.showHouses) {
    identity.push({ label: "Houses", value: String(stats.housesCount), href: "/collections#houses" });
  }

  const wallet = [
    { label: "Gold", value: formatGold(currencies.gold), href: "/inventory?view=currency" },
    { label: "Tel Var", value: formatNumber(currencies.telVar), href: "/inventory?view=currency" },
    { label: "Alliance Points", value: formatNumber(currencies.alliancePoints), href: "/inventory?view=currency" },
  ];

  const progress: ProgressCell[] = [];
  if (stats.showStickerbook) {
    progress.push({ label: "Sets", done: stats.stickerCollected, total: stats.stickerTotal, href: "/collections#sets" });
  }
  if (stats.showStyles) {
    progress.push({ label: "Styles", done: stats.stylesUnlocked, total: stats.stylesTotal, href: "/collections#styles" });
  }
  if (stats.showKnowledge) {
    progress.push(
      { label: "Research", done: stats.knowledge.researchKnown, total: stats.knowledge.researchTotal, href: "/knowledge" },
      { label: "Motifs", done: stats.knowledge.motifKnown, total: stats.knowledge.motifTotal, href: "/knowledge" },
    );
  }
  if (stats.showAchievements) {
    progress.push({ label: "Clears", done: stats.pithkaDone, total: stats.pithkaTotal, href: "/achievements" });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{account.displayName}</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {account.region}
          {account.esoPlus ? " · ESO+" : ""}
          {account.lastSnapshot ? ` · Snapshot ${timeAgo(account.lastSnapshot)}` : ""}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Account</h2>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {identity.map((cell) => (
              <Tile key={cell.label} href={cell.href}>
                <div className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{cell.label}</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-fg">{cell.value}</div>
                {cell.hint ? <div className="text-[10px] text-fg-subtle">{cell.hint}</div> : null}
              </Tile>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {wallet.map((cell) => (
              <Tile key={cell.label} href={cell.href}>
                <div className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{cell.label}</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-fg">{cell.value}</div>
              </Tile>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Guilds</h2>
          {account.guilds.length === 0 ? (
            <p className="mt-3 text-sm text-fg-muted">No guilds in this snapshot.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {account.guilds.map((guild) => (
                <li key={guild.name} className="rounded-md border border-border bg-bg px-3 py-2">
                  <div className="truncate text-sm font-medium text-fg">{guild.name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-fg-muted">
                      {guild.rank ?? "Member"}
                    </span>
                    {guild.trader ? (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">Trader</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {progress.length > 0 ? (
        <section className="rounded-lg border border-border bg-surface p-3">
          <h2 className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Progress</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {progress.map((cell) => {
              const pct = cell.total > 0 ? Math.min(100, Math.round((cell.done / cell.total) * 100)) : 0;
              return (
                <Link key={cell.label} href={cell.href} className="rounded-md border border-border bg-bg px-3 py-2 hover:border-accent/40">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{cell.label}</span>
                    <span className="text-sm font-semibold tabular-nums text-fg">
                      {cell.total > 0 ? (
                        <>
                          {cell.done}
                          <span className="font-normal text-fg-subtle">/{cell.total}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Tile({ href, children }: { href?: string; children: ReactNode }) {
  const className = "rounded-md border border-border bg-bg px-3 py-2";
  if (href) {
    return (
      <Link href={href} className={`${className} block hover:border-accent/40`}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
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
