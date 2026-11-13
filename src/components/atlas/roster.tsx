import type { ReactNode } from "react";
import Link from "next/link";
import { Droplet, Moon } from "lucide-react";
import {
  overallWorkspacePct,
  type CharacterWorkspaceCard,
} from "@/lib/characters/workspace";
import { classColor, classIcon } from "@/lib/classes";
import { ALLIANCE_ACCENT, timeAgo } from "@/lib/format";
import { GameIcon } from "../game-icon";
import { AtlasEmpty, AtlasMeter, AtlasPage } from "./ui";
import { RosterList } from "./roster-list";

export type RosterSort = "progress" | "name";
export type RosterView = "cards" | "list";

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
  view = "cards",
  accountCP = 0,
  action,
}: {
  cards: CharacterWorkspaceCard[];
  sort?: RosterSort;
  view?: RosterView;
  accountCP?: number;
  action?: ReactNode;
}) {
  const sorted = sortCards(cards, sort);
  const listHref = "/characters?view=list";

  return (
    <AtlasPage
      title="Roster"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {view === "cards" && accountCP > 0 ? (
            <span className="rounded border border-accent/40 bg-accent-soft px-2 py-1 text-xs text-accent">
              CP {accountCP.toLocaleString("en-US")} · account-wide
            </span>
          ) : null}
          {action}
          <div className="inline-flex gap-0.5 rounded-md border border-border bg-surface p-0.5">
            {(
              [
                ["cards", "Cards", view === "cards" ? (sort === "name" ? "/characters?sort=name" : "/characters") : "/characters"],
                ["list", "List", listHref],
              ] as const
            ).map(([key, label, href]) => (
              <Link
                key={key}
                href={href}
                className={`rounded px-2.5 py-1.5 text-xs ${
                  view === key ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          {view === "cards" ? (
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
          ) : null}
        </div>
      }
    >
      {sorted.length === 0 ? (
        <AtlasEmpty title="No characters yet">
          Install the addon, log a character out or{" "}
          <code className="rounded bg-surface-2 px-1">/reloadui</code>, then import.
        </AtlasEmpty>
      ) : (
        view === "list" ? (
          <RosterList cards={cards} />
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((card) => (
            <WorkspaceCard key={card.id} card={card} />
          ))}
        </div>
        )
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
          <div className="flex min-w-0 items-center gap-2.5">
            <GameIcon name={card.className} icon={classIcon(card.className)} size={32} bare />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-fg">{card.name}</h2>
              <p className="mt-0.5 truncate text-sm text-fg-muted">
                {card.race}{" "}
                <span style={{ color: classColor(card.className) }}>{card.className}</span>
              </p>
            </div>
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
