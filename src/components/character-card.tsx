import Link from "next/link";
import { Archive, Droplet, Moon } from "lucide-react";
import type { Character } from "@/lib/snapshot/schema";
import { isArchived } from "@/lib/snapshot/roster";
import { ALLIANCE_ACCENT, formatGold, timeAgo } from "@/lib/format";
import { Badge } from "./ui";

export function CharacterCard({ character: c }: { character: Character }) {
  const accent = ALLIANCE_ACCENT[c.alliance] ?? "var(--accent)";
  const seen = c.lastSeen;
  const archived = isArchived(c);

  return (
    <Link
      href={`/characters/${encodeURIComponent(c.id)}`}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface/70 p-4 transition-colors hover:border-accent/50 hover:bg-surface-2 ${
        archived ? "border-border/70 opacity-90" : "border-border"
      }`}
    >
      <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-fg group-hover:text-accent">{c.name}</div>
          <div className="mt-0.5 text-sm text-fg-muted">
            {c.race} {c.class}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-fg">
            {c.level >= 50 ? "Max" : `Lv ${c.level}`}
          </div>
          <div className="text-xs" style={{ color: accent }}>
            {c.alliance.split(" ")[0]}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {archived && (
          <Badge tone="muted">
            <Archive className="h-3 w-3" /> Archived
          </Badge>
        )}
        {c.vampire.isVampire && (
          <Badge tone="accent">
            <Droplet className="h-3 w-3" /> Vampire · Stage {c.vampire.stage}
          </Badge>
        )}
        {c.werewolf.isWerewolf && (
          <Badge tone="accent">
            <Moon className="h-3 w-3" /> Werewolf
          </Badge>
        )}
        {c.classMastery && <Badge tone="muted">Class Mastery</Badge>}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2 border-t border-border pt-2 text-xs text-fg-subtle">
        <span>
          {archived
            ? seen
              ? `Last known ${timeAgo(seen)}`
              : "Deleted from the live roster"
            : seen
              ? `Snapshot ${timeAgo(seen)}`
              : "Not logged in since install — log this character out to fill in"}
        </span>
        {seen ? (
          <span className="shrink-0 tabular-nums text-fg-muted">{formatGold(c.gold ?? 0)}</span>
        ) : null}
      </div>
    </Link>
  );
}
