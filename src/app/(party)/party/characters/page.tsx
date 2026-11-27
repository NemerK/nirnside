import Link from "next/link";
import { Droplet, Moon } from "lucide-react";
import { PageHead } from "@/components/party/page-head";
import { GameIcon } from "@/components/game-icon";
import { classColor, classIcon } from "@/lib/classes";
import { ALLIANCE_ACCENT, formatNumber, timeAgo } from "@/lib/format";
import { compareLines, lightSubjects, roster } from "@/lib/party/data";
import { SubTabs } from "@/components/party/sub-tabs";
import { ProgressGrid } from "@/components/progress/progress-grid";
import { listGoals } from "@/lib/db/goals";
import { listRoles } from "@/lib/db/roles";
import { buildLineGrid } from "@/lib/progress/grid";
import { account, rosterRows } from "@/lib/party/overview";

type View = "cards" | "table" | "skills";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function RosterTable() {
  const rows = rosterRows(account());
  return (
    <div className="party-module overflow-hidden p-0">
      <div className="max-h-[calc(100dvh-13rem)] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface text-left text-[12px] text-fg-subtle">
            <tr className="border-b border-border">
              <th className="px-5 py-2 font-normal">Character</th>
              <th className="px-3 py-2 font-normal">Class</th>
              <th className="px-3 py-2 text-right font-normal">CP / level</th>
              <th className="px-3 py-2 text-right font-normal">Gold</th>
              <th className="px-3 py-2 font-normal">Today&apos;s dailies</th>
              <th className="px-3 py-2 font-normal">Research</th>
              <th className="px-5 py-2 text-right font-normal">Last logout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                <td className="px-5 py-2">
                  <Link href={`/party/c/${encodeURIComponent(r.id)}`} className="text-fg hover:text-accent">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2" style={{ color: classColor(r.className) ?? undefined }}>
                  {r.className}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                  {r.level >= 50 ? formatNumber(r.championPoints) : `Lv ${r.level}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-fg-muted">{r.gold == null ? "—" : formatNumber(r.gold)}</td>
                <td className="px-3 py-2">
                  {!r.dailies ? (
                    <span className="text-fg-subtle">Not since reset</span>
                  ) : r.dailies.total === 0 ? (
                    <span className="text-fg-subtle">—</span>
                  ) : (
                    <Link href="/party/dailies" className={r.dailies.done >= r.dailies.total ? "text-ok" : "text-fg hover:text-accent"}>
                      {r.dailies.done}/{r.dailies.total} done
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2">
                  {!r.research ? (
                    <span className="text-fg-subtle">—</span>
                  ) : r.research.finished > 0 || r.research.idle > 0 ? (
                    <Link href={`/party/c/${encodeURIComponent(r.id)}/crafting`} className="hover:underline">
                      {r.research.finished > 0 ? <span className="text-ok">{r.research.finished} finished</span> : null}
                      {r.research.finished > 0 && r.research.idle > 0 ? <span className="text-fg-subtle"> · </span> : null}
                      {r.research.idle > 0 ? <span className="text-accent">{r.research.idle} idle</span> : null}
                    </Link>
                  ) : (
                    <span className="text-fg-subtle">All slots busy</span>
                  )}
                </td>
                <td className="px-5 py-2 text-right text-fg-subtle">{r.lastSeen == null ? "not yet" : timeAgo(r.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkillGrid() {
  const characters = roster();
  const subjects = lightSubjects();
  const { lines, lineIndex } = compareLines(characters);
  const goals = safe(() => listGoals(), []);
  const roles = safe(() => listRoles(), []).map((r) => ({ id: r.id, name: r.name }));
  const grid = buildLineGrid({ subjects, lines, lineIndex, goals });
  // The grid scrolls inside the screen, so line and character names stay in view.
  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 12.5rem)" }}>
      <ProgressGrid grid={grid} goals={goals} roles={roles} />
    </div>
  );
}

export const dynamic = "force-dynamic";

/** Everyone on the account. Pick one to open their own pages. */
export default async function CharactersPage({ searchParams }: PageProps<"/party/characters">) {
  const sp = await searchParams;
  const view: View = sp.view === "table" || sp.view === "skills" ? sp.view : "cards";
  const characters = roster();
  const tabs = (
    <SubTabs
      label="Roster view"
      tabs={[
        { href: "/party/characters", label: "Cards", on: view === "cards" },
        { href: "/party/characters?view=table", label: "At a glance", on: view === "table" },
        { href: "/party/characters?view=skills", label: "Skill lines", on: view === "skills" },
      ]}
    />
  );
  const lead =
    view === "skills"
      ? "Every skill line for every character. Click a cell or a line to set a target."
      : view === "table"
        ? "Every character's gold, today's dailies and research in one table."
        : "Pick a character to open their skills, gear, Champion Points and crafting.";
  if (characters.length > 0 && view !== "cards") {
    return (
      <div className={`mx-auto w-full ${view === "skills" ? "max-w-[1600px]" : "max-w-[1400px]"}`}>
        <PageHead title="Roster" lead={lead} />
        {tabs}
        {view === "table" ? <RosterTable /> : <SkillGrid />}
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title="Roster" lead={lead} />
      {characters.length > 0 ? tabs : null}
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
