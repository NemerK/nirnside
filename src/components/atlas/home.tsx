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

const BRASS = "#c8a35a";
const SETS = "#3a92ff";
const STYLES = "#a94ff5";
const RESEARCH = "var(--meter, #3dce7a)";
const MOTIFS = "#d8b13a";
const CLEARS = "#e6832b";
const TELVAR = "#5eb0ff";
const AP = "#3dce7a";

/**
 * One account window: a title plate, currency and roster slots, then the
 * progress that fits on screen. Planner goals and the full wallet stay on
 * their own pages.
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
  const progress: { label: string; href: string; done: number; total: number; tone: string; mark: ReactNode }[] = [];
  if (stats.showStickerbook) {
    progress.push({
      label: "Sets",
      href: "/collections?tab=sets",
      done: stats.stickerCollected,
      total: stats.stickerTotal,
      tone: SETS,
      mark: <PlatesIcon />,
    });
  }
  if (stats.showStyles) {
    progress.push({
      label: "Styles",
      href: "/collections?tab=styles",
      done: stats.stylesUnlocked,
      total: stats.stylesTotal,
      tone: STYLES,
      mark: <MaskIcon />,
    });
  }
  if (stats.showKnowledge) {
    progress.push({
      label: "Research",
      href: "/knowledge",
      done: stats.knowledge.researchKnown,
      total: stats.knowledge.researchTotal,
      tone: RESEARCH,
      mark: <AnvilIcon />,
    });
    progress.push({
      label: "Motifs",
      href: "/knowledge",
      done: stats.knowledge.motifKnown,
      total: stats.knowledge.motifTotal,
      tone: MOTIFS,
      mark: <ScrollIcon />,
    });
  }
  if (stats.showAchievements) {
    progress.push({
      label: "Clears",
      href: "/achievements",
      done: stats.pithkaDone,
      total: stats.pithkaTotal,
      tone: CLEARS,
      mark: <BannerIcon />,
    });
  }

  return (
    <section className="relative flex min-h-full flex-1 flex-col overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--home-trim)_55%,var(--border))] bg-surface shadow-[0_12px_40px_rgb(0_0_0/0.18)] [--home-trim:#c8a35a]">
      <h1 className="sr-only">{account.displayName}</h1>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--home-trim)] to-transparent" />
      <Corner className="left-1.5 top-1.5 border-l-2 border-t-2" />
      <Corner className="right-1.5 top-1.5 border-r-2 border-t-2" />
      <Corner className="bottom-1.5 left-1.5 border-b-2 border-l-2" />
      <Corner className="bottom-1.5 right-1.5 border-b-2 border-r-2" />

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-6">
        <Slot mark={<StarIcon />} label="Champion" value={stats.accountCP.toLocaleString("en-US")} tone={BRASS} />
        {stats.showCharacters ? (
          <Slot
            href="/characters"
            mark={<PartyIcon />}
            label="Roster"
            value={String(stats.characterCount)}
            hint={stats.archivedCount > 0 ? `${stats.archivedCount} archived` : "live"}
            tone={SETS}
          />
        ) : null}
        {stats.showHouses ? (
          <Slot
            href="/collections?tab=houses"
            mark={<HouseIcon />}
            label="Houses"
            value={String(stats.housesCount)}
            tone={STYLES}
          />
        ) : null}
        <Slot
          href="/inventory?view=currency"
          mark={<CoinIcon />}
          label="Gold"
          value={formatGold(currencies.gold)}
          tone={MOTIFS}
        />
        <Slot
          href="/inventory?view=currency"
          mark={<GemIcon />}
          label="Tel Var"
          value={formatNumber(currencies.telVar)}
          tone={TELVAR}
        />
        <Slot
          href="/inventory?view=currency"
          mark={<ShieldIcon />}
          label="Alliance"
          value={formatNumber(currencies.alliancePoints)}
          tone={AP}
        />
      </div>

      {progress.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-fg-muted">
          Progress modules are off. Turn them back on in{" "}
          <Link href="/setup" className="text-accent hover:underline">
            Setup
          </Link>
          .
        </p>
      ) : (
        <ul className="grid flex-1 gap-2 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5">
          {progress.map((row) => (
            <li key={row.label}>
              <ProgressCard {...row} />
            </li>
          ))}
        </ul>
      )}

      {account.guilds.length > 0 ? (
        <div className="mt-auto border-t border-border px-4 py-3">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.22em] text-fg-subtle">Guilds</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {account.guilds.map((guild) => (
              <li
                key={guild.name}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg/40 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-fg">{guild.name}</span>
                  {guild.rank ? <span className="block truncate text-xs text-fg-subtle">{guild.rank}</span> : null}
                </span>
                {guild.trader ? (
                  <span className="shrink-0 rounded border border-[color-mix(in_srgb,var(--home-trim)_50%,transparent)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--home-trim)]">
                    Trader
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
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
      <AccountOverview account={account} stats={stats} currencies={currencies} />
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span aria-hidden className={`pointer-events-none absolute h-3 w-3 border-[var(--home-trim)] ${className}`} />;
}

function Slot({
  href,
  mark,
  label,
  value,
  hint,
  tone,
}: {
  href?: string;
  mark: ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: string;
}) {
  const className =
    "flex min-w-0 items-center gap-3 rounded-md border border-border bg-bg/35 px-3 py-3 transition-colors hover:border-[color-mix(in_srgb,var(--home-trim)_45%,var(--border))]";
  const body = (
    <>
      <Mark tone={tone}>{mark}</Mark>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-fg-subtle">{label}</span>
        <span className="block truncate text-sm font-semibold tabular-nums text-fg">{value}</span>
        {hint ? <span className="block text-[11px] text-fg-subtle">{hint}</span> : null}
      </span>
    </>
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function ProgressCard({
  href,
  label,
  done,
  total,
  tone,
  mark,
}: {
  href: string;
  label: string;
  done: number;
  total: number;
  tone: string;
  mark: ReactNode;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : null;
  return (
    <Link
      href={href}
      className="flex h-full min-h-44 flex-col justify-between gap-4 rounded-md border border-border bg-bg/35 px-3.5 py-3.5 transition-colors hover:border-[color-mix(in_srgb,var(--slot)_50%,var(--border))]"
      style={{ ["--slot" as string]: tone }}
    >
      <span className="flex items-center gap-2.5">
        <Mark tone={tone}>{mark}</Mark>
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle">{label}</span>
      </span>
      <span className="text-4xl font-semibold tabular-nums leading-none" style={{ color: tone }}>
        {pct == null ? "—" : `${pct}%`}
      </span>
      <span>
        <Segments pct={pct ?? 0} tone={tone} />
        <span className="mt-1.5 block text-xs tabular-nums text-fg-muted">
          {total > 0 ? `${done.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}` : "not scanned"}
        </span>
      </span>
    </Link>
  );
}

function Mark({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-md border"
      style={{
        color: tone,
        borderColor: `color-mix(in srgb, ${tone} 50%, transparent)`,
        background: `color-mix(in srgb, ${tone} 14%, transparent)`,
      }}
    >
      {children}
    </span>
  );
}

function Segments({ pct, tone }: { pct: number; tone: string }) {
  const count = 12;
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * count);
  return (
    <span className="flex h-2 gap-[3px]" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="h-full flex-1 rounded-[1px]"
          style={{
            background: index < filled ? tone : "var(--meter-track, var(--surface-2))",
          }}
        />
      ))}
    </span>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      {children}
    </svg>
  );
}

function StarIcon() {
  return (
    <Icon>
      <path d="M12 3.2 14.2 9h6l-4.8 3.5 1.8 5.8L12 15.2 6.8 18.3 8.6 12.5 3.8 9h6L12 3.2Z" />
    </Icon>
  );
}

function PartyIcon() {
  return (
    <Icon>
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="16" cy="9" r="1.8" />
      <path d="M4.8 18.5c.6-2.6 2.4-4 4.2-4s3.6 1.4 4.2 4" />
      <path d="M13.2 14.6c1.2-.5 2.4-.4 3.4.2 1 .7 1.6 1.8 1.9 3.7" />
    </Icon>
  );
}

function HouseIcon() {
  return (
    <Icon>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M7 10.8V19h10v-8.2" />
      <path d="M10.5 19v-4.2h3V19" />
    </Icon>
  );
}

function CoinIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="7.2" />
      <path d="M12 8.2v7.6M9.8 10.2h3.2a1.6 1.6 0 0 1 0 3.2H10a1.6 1.6 0 0 0 0 3.2h3.4" />
    </Icon>
  );
}

function GemIcon() {
  return (
    <Icon>
      <path d="M8 5h8l4 5.2L12 20 4 10.2 8 5Z" />
      <path d="M4 10.2h16M8 5l4 5.2L16 5M12 10.2 12 20" />
    </Icon>
  );
}

function ShieldIcon() {
  return (
    <Icon>
      <path d="M12 3.5 19 6.2v6.1c0 3.6-2.7 6.4-7 8.2-4.3-1.8-7-4.6-7-8.2V6.2L12 3.5Z" />
      <path d="M9 12.2 11.1 14.3 15.2 10" />
    </Icon>
  );
}

function PlatesIcon() {
  return (
    <Icon>
      <path d="M8 7.5h11v11H8z" />
      <path d="M5 5.5h11v2" />
      <path d="M5 5.5v11h2" />
    </Icon>
  );
}

function MaskIcon() {
  return (
    <Icon>
      <path d="M4.5 9.5c2.2-3 12.8-3 15 0-1.2 6.2-4 9-7.5 9s-6.3-2.8-7.5-9Z" />
      <path d="M9 11.2h.1M15 11.2h.1" strokeLinecap="round" />
    </Icon>
  );
}

function AnvilIcon() {
  return (
    <Icon>
      <path d="M5 14h14l-1.2 2.4H6.2L5 14Z" />
      <path d="M8 14V9.5h8V14" />
      <path d="M7 9.5h10l-1-2.2H8L7 9.5Z" />
      <path d="M10.5 18.5h3" />
    </Icon>
  );
}

function ScrollIcon() {
  return (
    <Icon>
      <path d="M7 5.5h9.2A2.3 2.3 0 0 1 18.5 8v10.2a1.8 1.8 0 0 1-1.8 1.8H8.2A2.2 2.2 0 0 1 6 17.8V7.2A1.7 1.7 0 0 1 7.7 5.5" />
      <path d="M6 8.2h2.2" />
      <path d="M9.5 10.5h6M9.5 13.5h6M9.5 16.2h4" />
    </Icon>
  );
}

function BannerIcon() {
  return (
    <Icon>
      <path d="M7 3.8v16.4" />
      <path d="M7 5h10l-2.2 3.2L17 11.4H7" />
    </Icon>
  );
}
