import type { ReactNode } from "react";
import Link from "next/link";
import { AtlasEmpty, AtlasPage, AtlasPanel, AtlasStat } from "./ui";
import { timeAgo } from "@/lib/format";
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
  itemCount: number;
  accountCP: number;
  stickerPct: number;
  stickerCollected: number;
  stickerTotal: number;
  housesCount: number;
  knowledge: KnowledgeAccountSummary;
  stylesUnlocked: number;
  stylesTotal: number;
  pithkaDone: number;
  pithkaTotal: number;
  showCharacters: boolean;
  showInventory: boolean;
  showStickerbook: boolean;
  showStyles: boolean;
  showHouses: boolean;
  showKnowledge: boolean;
  showAchievements: boolean;
  showDailies: boolean;
  showEncyclopedia: boolean;
}

/**
 * Atlas account overview — same data as Classic Home, regrouped by grain.
 * Wallet and goals arrive as pre-rendered nodes so existing boards stay intact.
 */
export function AtlasHome({
  account,
  stats,
  wallet,
  goals,
}: {
  account: AtlasHomeAccount;
  stats: AtlasHomeStats;
  wallet?: ReactNode;
  goals?: ReactNode;
}) {
  const knowledgePct = stats.knowledge.motifTotal
    ? Math.round((stats.knowledge.motifKnown / stats.knowledge.motifTotal) * 100)
    : null;
  const stylesPct = stats.stylesTotal
    ? Math.round((stats.stylesUnlocked / stats.stylesTotal) * 100)
    : null;

  const pulse: { label: string; value: ReactNode; hint?: string; href?: string }[] = [];
  if (stats.showCharacters) {
    pulse.push({
      label: "Roster",
      value: stats.characterCount,
      hint: stats.archivedCount > 0 ? `${stats.archivedCount} archived` : "live characters",
      href: "/characters",
    });
  }
  pulse.push({
    label: "Champion Points",
    value: stats.accountCP.toLocaleString("en-US"),
    hint: "account-wide",
  });
  if (stats.showInventory) {
    pulse.push({
      label: "Inventory",
      value: stats.itemCount.toLocaleString("en-US"),
      hint: "stacks across bags",
      href: "/inventory",
    });
  }
  if (stats.showStickerbook) {
    pulse.push({
      label: "Set pieces",
      value: stats.stickerTotal ? `${stats.stickerPct}%` : "—",
      hint: stats.stickerTotal
        ? `${stats.stickerCollected}/${stats.stickerTotal} collected`
        : "stickerbook empty",
      href: "/collections?tab=sets",
    });
  }
  if (stats.showStyles) {
    pulse.push({
      label: "Outfit styles",
      value: stylesPct != null ? `${stylesPct}%` : "—",
      hint: stats.stylesTotal
        ? `${stats.stylesUnlocked}/${stats.stylesTotal} unlocked`
        : "none listed",
      href: "/collections?tab=styles",
    });
  }
  if (stats.showHouses) {
    pulse.push({
      label: "Houses",
      value: stats.housesCount,
      hint: "owned residences",
      href: "/collections?tab=houses",
    });
  }
  if (stats.showKnowledge) {
    pulse.push({
      label: "Craft knowledge",
      value: knowledgePct != null ? `${knowledgePct}%` : "Board",
      hint: stats.knowledge.motifTotal
        ? `${stats.knowledge.motifKnown}/${stats.knowledge.motifTotal} motif chapters`
        : "research, motifs, recipes",
      href: "/knowledge",
    });
  }
  if (stats.showAchievements) {
    pulse.push({
      label: "Achievements",
      value: stats.pithkaTotal ? `${stats.pithkaDone}/${stats.pithkaTotal}` : "Board",
      hint: "Pithka-tracked clears",
      href: "/achievements",
    });
  }
  if (stats.showDailies) {
    pulse.push({
      label: "Dailies",
      value: "Board",
      hint: "randoms, writs, pledges",
      href: "/dailies",
    });
  }
  if (stats.showEncyclopedia) {
    pulse.push({
      label: "Encyclopedia",
      value: "Catalog",
      hint: "sets, skills, CP, scribing",
      href: "/encyclopedia",
    });
  }

  return (
    <AtlasPage
      title={account.displayName}
      subtitle={`${account.region}${account.esoPlus ? " · ESO+" : ""} · snapshot ${timeAgo(account.lastSnapshot)}`}
    >
      {pulse.length === 0 ? (
        <AtlasEmpty title="Nothing on the pulse yet">
          Turn modules back on in{" "}
          <Link href="/setup" className="text-accent hover:underline">
            Setup
          </Link>{" "}
          or import a snapshot.
        </AtlasEmpty>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {pulse.map((s) => (
            <AtlasStat key={s.label} label={s.label} value={s.value} hint={s.hint} href={s.href} />
          ))}
        </div>
      )}

      {wallet ? (
        <AtlasPanel className="mb-8">
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 className="atlas-display text-lg text-fg">Wallet</h2>
            <Link href="/inventory?view=currency" className="text-xs text-fg-subtle hover:text-accent">
              Full table
            </Link>
          </div>
          {wallet}
        </AtlasPanel>
      ) : null}

      {goals ? <div className="mb-8">{goals}</div> : null}

      {account.guilds.length > 0 ? (
        <AtlasPanel>
          <h2 className="atlas-display mb-3 text-lg text-fg">Guilds</h2>
          <ul className="flex flex-wrap gap-2">
            {account.guilds.map((g) => (
              <li
                key={g.name}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-fg"
              >
                <span>{g.name}</span>
                {g.rank ? <span className="text-xs text-fg-subtle">{g.rank}</span> : null}
                {g.trader ? (
                  <span className="rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                    Trader
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </AtlasPanel>
      ) : null}
    </AtlasPage>
  );
}
