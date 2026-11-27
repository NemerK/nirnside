import Link from "next/link";
import { Droplet, Moon } from "lucide-react";
import { PageHead } from "@/components/party/page-head";
import { GameIcon } from "@/components/game-icon";
import { classColor, classIcon } from "@/lib/classes";
import { ALLIANCE_ACCENT, formatNumber, timeAgo } from "@/lib/format";
import { roster } from "@/lib/party/data";

export const dynamic = "force-dynamic";

/** Everyone on the account. Pick one to open their own pages. */
export default function CharactersPage() {
  const characters = roster();
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead
        title="Characters"
        lead="What each character has on their own: skills, gear, Champion Points, research, dailies. Pick one."
      />
      {characters.length === 0 ? (
        <p className="party-module px-6 py-10 text-center text-fg-muted">
          No characters yet. Log one out in game with the Nirnside Snapshot addon on.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {characters.map((c) => {
            const color = classColor(c.class) ?? "var(--fg-muted)";
            const known = c.lastSeen != null;
            return (
              <li key={c.id}>
                <Link
                  href={`/party/c/${encodeURIComponent(c.id)}`}
                  className="party-module flex items-center gap-3 px-4 py-3 transition-colors hover:border-border-strong"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${known ? "" : "opacity-60"}`}
                    style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, boxShadow: `inset 0 0 0 1px ${color}` }}
                  >
                    <GameIcon name={c.class} icon={classIcon(c.class)} size={30} bare />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${known ? "text-fg" : "text-fg-muted"}`}>{c.name}</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-fg-muted">
                      <span style={{ color }}>{c.class}</span>
                      <span className="text-fg-subtle">·</span>
                      <span>{c.race}</span>
                      {c.vampire?.isVampire ? <Droplet className="h-3 w-3 text-danger" aria-label="Vampire" /> : null}
                      {c.werewolf?.isWerewolf ? <Moon className="h-3 w-3 text-info" aria-label="Werewolf" /> : null}
                    </span>
                    <span className="block text-[12px] text-fg-subtle">
                      <span style={{ color: ALLIANCE_ACCENT[c.alliance] }}>{c.alliance}</span> ·{" "}
                      {known ? `last logout ${timeAgo(c.lastSeen)}` : "not logged out yet"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-[20px] leading-none tabular-nums text-fg">
                      {c.level >= 50 ? formatNumber(c.championPoints) : c.level}
                    </span>
                    <span className="text-[11px] text-fg-subtle">{c.level >= 50 ? "CP" : "level"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
