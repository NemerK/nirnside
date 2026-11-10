import type { ReactNode } from "react";
import Link from "next/link";
import { Droplet, Moon } from "lucide-react";
import {
  overallWorkspacePct,
  type CharacterWorkspaceCard,
} from "@/lib/characters/workspace";
import { ALLIANCE_ACCENT, timeAgo } from "@/lib/format";
import { AtlasEmpty, AtlasMeter, AtlasPage } from "./ui";

export type RosterSort = "progress" | "name";

function sortCards(cards: CharacterWorkspaceCard[], sort: RosterSort): CharacterWorkspaceCard[] {
  const next = [...cards];
  if (sort === "name") {
    next.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    next.sort((a, b) => {
      const diff = overallWorkspacePct(b) - overallWorkspacePct(a);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }
  return next;
}

/**
 * Atlas character roster — progress that Classic kept on Dashboard, plus the
 * live roster cards. Opening a toon still goes to /characters/[id].
 */
export function AtlasRoster({
  cards,
  sort = "progress",
  accountCP = 0,
  action,
}: {
  cards: CharacterWorkspaceCard[];
  sort?: RosterSort;
  accountCP?: number;
  action?: ReactNode;
}) {
  const sorted = sortCards(cards, sort);

  return (
    <AtlasPage
      grain="Characters"
      title="Roster"
      subtitle="Progress workspace and live sheets — Dashboard rings now live here."
      action={
        <div className="flex flex-wrap items-center gap-2">
          {accountCP > 0 ? (
            <span className="rounded border border-accent/40 bg-accent-soft px-2 py-1 text-xs text-accent">
              CP {accountCP.toLocaleString("en-US")} · account-wide
            </span>
          ) : null}
          {action}
          <div className="inline-flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
            {(
              [
                ["progress", "Progress"],
                ["name", "Name"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={key === "progress" ? "/characters" : "/characters?sort=name"}
                className={`rounded px-2.5 py-1.5 text-xs ${
                  sort === key ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      }
    >
      <p className="mb-4 text-sm text-fg-muted">
        Classic{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Dashboard
        </Link>{" "}
        progress is folded into these cards. Open a character for the full workspace.
      </p>

      {sorted.length === 0 ? (
        <AtlasEmpty title="No characters yet">
          Install the addon, log a character out or{" "}
          <code className="rounded bg-surface-2 px-1">/reloadui</code>, then import.
        </AtlasEmpty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((card) => (
            <WorkspaceCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </AtlasPage>
  );
}

function WorkspaceCard({ card }: { card: CharacterWorkspaceCard }) {
  const accent = ALLIANCE_ACCENT[card.alliance] ?? "var(--accent)";
  const overall = overallWorkspacePct(card);

  return (
    <article
      className="atlas-panel flex flex-col overflow-hidden border-t-2 p-0 transition hover:border-accent/50"
      style={{ borderTopColor: accent }}
    >
      <Link
        href={`/characters/${encodeURIComponent(card.id)}`}
        className="flex flex-1 flex-col px-4 pb-3 pt-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="atlas-display truncate text-xl text-fg">{card.name}</h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              {card.race} {card.className}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-fg">{card.level >= 50 ? "Max" : `Lv ${card.level}`}</p>
            <p className="text-xs tabular-nums text-fg-subtle">
              {card.unknown ? "—" : `CP ${card.championPoints.toLocaleString("en-US")}`}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {card.unknown ? (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
              Unknown — not logged since install
            </span>
          ) : (
            <span className="rounded border border-border px-1.5 py-0.5 text-fg-subtle">{overall}% overall</span>
          )}
          {card.vampire ? (
            <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-fg-muted">
              <Droplet className="h-3 w-3" /> Vampire
            </span>
          ) : null}
          {card.werewolf ? (
            <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-fg-muted">
              <Moon className="h-3 w-3" /> Werewolf
            </span>
          ) : null}
          {card.classMastery ? (
            <span className="rounded border border-border px-1.5 py-0.5 text-fg-muted">Class Mastery</span>
          ) : null}
        </div>

        <div className="mt-4 space-y-2.5">
          <AtlasMeter
            label="Targets"
            done={card.targets.done}
            total={card.targets.total}
            unknown={card.unknown}
          />
          <AtlasMeter
            label="Research"
            done={card.research.done}
            total={card.research.total}
            unknown={card.unknown}
          />
          <AtlasMeter label="Motifs" done={card.motifs.done} total={card.motifs.total} unknown={card.unknown} />
        </div>

        <p className="mt-4 text-xs text-fg-subtle">
          {card.unknown
            ? "Log this character out to fill skills, craft knowledge, and targets."
            : `Snapshot ${timeAgo(card.lastSeen)}`}
        </p>
      </Link>
    </article>
  );
}
