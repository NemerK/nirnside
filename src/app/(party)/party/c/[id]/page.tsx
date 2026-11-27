import Link from "next/link";
import { notFound } from "next/navigation";
import { Droplet, Moon } from "lucide-react";
import { Bar, Empty, Module } from "@/components/party/module";
import { RolePicker } from "@/components/role-picker";
import { ResetCountdown } from "@/components/reset-countdown";
import { getAccount, getCharacter, getDataSource } from "@/lib/db/queries";
import { listGoals } from "@/lib/db/goals";
import { listAssignments, listRoles } from "@/lib/db/roles";
import { rolesForCharacter } from "@/lib/roles/filter";
import { classColor } from "@/lib/classes";
import { ALLIANCE_ACCENT, formatNumber, timeAgo } from "@/lib/format";
import { currentUnix, dailyResetHourUtc, nextEsoResetAt, type EsoRegion } from "@/lib/dailies/day";
import { communityPledgesForUnix, PLEDGE_GIVER_NAMES } from "@/lib/dailies/pledges";
import { presentCharacterDailies, WRIT_CRAFTS, WRIT_LABELS, type DailyCell } from "@/lib/dailies/present";
import { WORLD_BOSS_ZONES } from "@/lib/dailies/world-bosses";
import { toGoalSubject } from "@/lib/goals/progress";
import { governs } from "@/lib/goals/effective";
import { buildGoalIndexes, characterGoalRows } from "@/lib/planner/data";
import { presentSheet } from "@/lib/party/sheet";
import { EquippedPanel, type EquippedPiece, type EquippedSet } from "@/components/party/equipped-panel";
import { HoverTip } from "@/components/party/hover-tip";
import { TodayPanel, type TodayRow } from "@/components/party/today-panel";
import { DAILY_TRACKABLES, trackedFor } from "@/lib/party/daily-tracking";
import { getDailyTracking } from "@/lib/db/daily-tracking";
import { getCPStars, setHref } from "@/lib/db/catalog-queries";
import { loadSetHover } from "@/lib/catalog/hover-sets";
import { toPartyHref } from "@/lib/party/links";
import { presentResearch } from "@/lib/knowledge/present";
import { skillLineCap } from "@/lib/skills/line-cap";
import { TIER_LABEL, type GoalTier } from "@/lib/goals/types";
import { formatTimeLeft } from "@/lib/today/present";
import type { Character } from "@/lib/snapshot/schema";

export const dynamic = "force-dynamic";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const ARMOR_SLOTS = ["Head", "Shoulders", "Chest", "Hands", "Waist", "Legs", "Feet"];
const JEWELRY_SLOTS = ["Neck", "Ring 1", "Ring 2"];
const SLOT_ALIAS: Record<string, string> = { necklace: "Neck", hand: "Hands", gloves: "Hands", belt: "Waist", shoulder: "Shoulders" };

function slotKey(slot: string): string {
  const s = slot.trim();
  return SLOT_ALIAS[s.toLowerCase()] ?? s.replace(/\b\w/g, (m) => m.toUpperCase());
}

const DISCIPLINE_COLOR: Record<string, string> = {
  craft: "var(--cp-craft)",
  warfare: "var(--cp-warfare)",
  fitness: "var(--cp-fitness)",
};

const TIER_COLOR: Record<GoalTier, string> = {
  essential: "var(--rank-mandatory)",
  optional: "var(--rank-extra)",
  completionist: "var(--rank-completionist)",
};

function todayState(status: DailyCell["status"]): TodayRow["state"] {
  if (status === "done" || status === "cooldown") return "done";
  if (status === "ready") return "ready";
  if (status === "accepted") return "accepted";
  if (status === "available") return "open";
  return "unknown";
}

/** Armor, jewelry and both bars as tiles, with set counts and bonuses for the hover card. */
function presentEquipped(c: Character) {
  const hover = safe(() => loadSetHover().briefs, []);
  const brief = (name: string | null) => (name ? hover.find((b) => b.name.toLowerCase() === name.toLowerCase()) : undefined);
  const isWeapon = (e: Character["equipped"][number]) => e.bar != null || /hand|weapon|poison/i.test(e.slot);
  const body = c.equipped.filter((e) => !isWeapon(e));
  const front = c.equipped.filter((e) => isWeapon(e) && e.bar !== "back");
  const back = c.equipped.filter((e) => e.bar === "back");
  const count = (list: typeof c.equipped) => {
    const m = new Map<string, number>();
    for (const e of list) if (e.setName) m.set(e.setName, (m.get(e.setName) ?? 0) + (/two/i.test(e.slot) ? 2 : 1));
    return m;
  };
  const withFront = count([...body, ...front]);
  const withBack = count([...body, ...back]);
  const hrefFor = (name: string | null, setId?: number | null) =>
    name || setId != null ? toPartyHref(safe(() => setHref({ name, setId: setId ?? null }), "")) || null : null;

  const tile = (e: Character["equipped"][number], label: string, counts: Map<string, number>): EquippedPiece => {
    const b = brief(e.setName);
    return {
      slot: e.slot,
      label,
      name: e.name,
      icon: e.icon ?? null,
      quality: e.quality ?? null,
      trait: e.trait ?? null,
      enchant: e.enchant ?? null,
      setName: e.setName ?? null,
      setHref: hrefFor(e.setName ?? null, e.setId),
      setCount: e.setName ? (counts.get(e.setName) ?? 0) : 0,
      setMax: b?.maxEquip ?? 0,
      bonuses: b?.bonuses ?? [],
    };
  };
  const bySlot = new Map(body.map((e) => [slotKey(e.slot), e]));
  const fill = (slots: string[], label = (s: string) => s) =>
    slots.map((s) => {
      const e = bySlot.get(s);
      return e ? tile(e, label(s), withFront) : { empty: label(s) };
    });
  const bar = (list: typeof c.equipped, counts: Map<string, number>) => {
    const main = list.find((e) => /main|two/i.test(e.slot)) ?? list[0];
    const off = list.find((e) => e !== main);
    const two = main && /two/i.test(main.slot);
    return [
      main ? tile(main, two ? "Two-handed" : "Main hand", counts) : { empty: "Main hand" },
      ...(two ? [] : [off ? tile(off, "Off hand", counts) : { empty: "Off hand" }]),
    ];
  };
  const names = [...new Set([...withFront.keys(), ...withBack.keys()])];
  const sets: EquippedSet[] = names
    .map((name) => ({
      name,
      href: hrefFor(name),
      front: withFront.get(name) ?? 0,
      back: withBack.get(name) !== withFront.get(name) ? (withBack.get(name) ?? 0) : null,
      max: brief(name)?.maxEquip ?? 0,
    }))
    .sort((a, b) => b.front - a.front || a.name.localeCompare(b.name));
  return {
    armor: fill(ARMOR_SLOTS),
    jewelry: fill(JEWELRY_SLOTS),
    front: bar(front, withFront),
    back: bar(back, withBack),
    sets,
    any: c.equipped.length > 0,
  };
}

export default async function CharacterSheet({ params }: PageProps<"/party/c/[id]">) {
  const { id } = await params;
  const c = safe(() => getCharacter(decodeURIComponent(id)), null);
  if (!c) notFound();

  const now = currentUnix();
  const account = safe(() => getAccount(), null);
  const region: EsoRegion = account?.region === "NA" ? "NA" : "EU";
  const isSample = safe(() => getDataSource(), null)?.kind === "sample";
  const color = classColor(c.class) ?? "#b46ad4";
  const known = c.lastSeen != null;
  const archived = c.archivedAt != null;
  const sheet = presentSheet(c, now);
  const roles = safe(() => listRoles(), []);
  const assigned = safe(() => rolesForCharacter(c.id, roles, listAssignments()), []);

  const dailies = presentCharacterDailies(c, now, {
    treatAsFresh: isSample,
    todayPledges: communityPledgesForUnix(now, region),
    region,
  });

  // Targets: only build the class-validity indexes when there is something to judge.
  const goals = safe(() => listGoals(), []);
  const subject = toGoalSubject(c, assigned.map((r) => r.id), true);
  // Only the target that governs this character: their own beats a class or
  // role one, which beats an everyone one (same rule as Targets and Compare).
  const targetRows =
    goals.length > 0
      ? safe(() => characterGoalRows(goals, subject, buildGoalIndexes()), []).filter((r) =>
          governs(r.goal, goals, subject),
        )
      : [];


  const base = `/party/c/${encodeURIComponent(c.id)}`;

  // Skill lines, by what you set out to do: each line's governing target
  // (mandatory, then extra, then completionist), then lines with no target.
  const lineByName = new Map(sheet.lines.map((l) => [l.name.toLowerCase(), l]));
  const lineTargets = targetRows.filter((r) => r.goal.domain === "skillline");
  const targeted = new Set(lineTargets.map((r) => r.goal.target.toLowerCase()));
  const tierGroups = (["essential", "optional", "completionist"] as GoalTier[]).map((tier) => {
    const rows = lineTargets
      .filter((r) => r.goal.tier === tier)
      .map((r) => {
        const line = lineByName.get(r.goal.target.toLowerCase());
        const need = Math.max(r.goal.targetRank, r.goal.extraRank ?? 0) || line?.cap || skillLineCap(r.goal.target) || 0;
        return { name: r.goal.target, rank: line?.rank ?? 0, need, found: !!line && r.mark.state !== "undiscovered", done: r.mark.state === "done" };
      })
      .sort((x, y) => Number(x.done) - Number(y.done) || x.rank / (x.need || 1) - y.rank / (y.need || 1));
    return { tier, rows, left: rows.filter((r) => !r.done).length };
  }).filter((g) => g.rows.length > 0);
  const untargeted = sheet.lines
    .filter((l) => !targeted.has(l.name.toLowerCase()) && l.cap != null && l.rank < l.cap && (!l.subclassed || l.cap))
    .sort((x, y) => x.rank / (x.cap ?? 1) - y.rank / (y.cap ?? 1));
  const capped = sheet.lines.filter((l) => l.cap != null);
  const maxed = capped.filter((l) => l.rank >= (l.cap ?? 0)).length;
  const lineHref = (name: string) => `${base}/skills?line=${encodeURIComponent(name)}`;

  // Today: the dailies this character tracks.
  const tracking = trackedFor(safe(() => getDailyTracking(), { account: null, characters: {} }), c.id);
  const todayRows: TodayRow[] = [
    { key: "random-normal", label: "Random normal", detail: dailies.randomNormal.dungeon ?? null, state: todayState(dailies.randomNormal.status) },
    { key: "random-veteran", label: "Random veteran", detail: dailies.randomVeteran.dungeon ?? null, state: todayState(dailies.randomVeteran.status) },
    ...WRIT_CRAFTS.map((w) => ({ key: `writ-${w}`, label: `${WRIT_LABELS[w]} writ`, detail: null, state: todayState(dailies.writs[w].status) })),
    ...(Object.keys(PLEDGE_GIVER_NAMES) as (keyof typeof PLEDGE_GIVER_NAMES)[]).map((g) => ({
      key: `pledge-${g}`,
      label: `Pledge: ${PLEDGE_GIVER_NAMES[g].split(" ")[0]}`,
      detail: dailies.pledges[g].dungeon ?? null,
      state: todayState(dailies.pledges[g].status),
    })),
    ...WORLD_BOSS_ZONES.map((z) => ({
      key: `boss-${z.id}`,
      label: `World boss: ${z.name}`,
      detail: null,
      state: todayState(dailies.worldBosses[z.id]?.status ?? "unknown"),
    })),
  ];

  // Champion Points: slotted stars in their discipline's color, with what each does.
  const starText = new Map(
    safe(() => getCPStars(), []).map((r) => [r.entry.name.toLowerCase(), r.entry.description] as const),
  );

  // Research: every slot, running or idle. Research keeps going after logout.
  const research = presentResearch(c.research);
  const elapsed = c.lastSeen != null ? Math.max(0, now - c.lastSeen) : 0;
  const running = research.inProgress.map((r) => ({ ...r, left: r.remainingSeconds == null ? null : Math.max(0, r.remainingSeconds - elapsed) }));
  const idleSlots = research.crafts.reduce((n, cr) => n + Math.max(0, cr.maxSlots - cr.researching), 0);
  const equipped = presentEquipped(c);

  const stat = (label: string, value: string, tone = "text-fg") => (
    <div className="text-right">
      <dt className="text-[11px] text-fg-subtle">{label}</dt>
      <dd className={`font-display text-[22px] leading-none tabular-nums ${tone}`}>{value}</dd>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-tight text-fg">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-fg-muted">
            <span>
              {c.race} <span style={{ color }}>{c.class}</span> ·{" "}
              <span style={{ color: ALLIANCE_ACCENT[c.alliance] }}>{c.alliance}</span>
              {c.mundus ? <> · {c.mundus}</> : null}
              {known ? <span className="text-fg-subtle"> · last logout {timeAgo(c.lastSeen)}</span> : null}
            </span>
            {c.vampire.isVampire ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[12px]">
                <Droplet className="h-3 w-3 text-danger" /> Vampire {c.vampire.stage}
              </span>
            ) : null}
            {c.werewolf.isWerewolf ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[12px]">
                <Moon className="h-3 w-3 text-info" /> Werewolf
              </span>
            ) : null}
            <RolePicker characterId={c.id} assigned={assigned} roles={roles} />
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-7 gap-y-2">
          {c.level >= 50 ? stat("Champion Points", formatNumber(c.championPoints)) : stat("Level", String(c.level))}
          {known ? stat("Gold", formatNumber(c.gold ?? 0), "text-gold") : null}
          {known && (c.alliancePoints ?? 0) > 0 ? stat("Alliance Points", formatNumber(c.alliancePoints ?? 0)) : null}
          {known && (c.telVar ?? 0) > 0 ? stat("Tel Var", formatNumber(c.telVar ?? 0)) : null}
        </dl>
      </header>

      {archived ? (
        <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-fg-muted">
          This character was deleted from the game. You&apos;re seeing their last-known sheet; their gold and bags no
          longer count towards the account.
        </p>
      ) : null}

      {!known ? (
        <div className="party-module px-6 py-10 text-center">
          <h2 className="font-display text-3xl text-fg">Waiting for {c.name}</h2>
          <p className="mx-auto mt-3 max-w-lg text-fg-muted">
            Nirnside only knows a character after they log out (or <code className="rounded bg-surface-2 px-1">/reloadui</code>) with the
            Nirnside Snapshot addon on. Log in on {c.name} once and their skills, gear, research and dailies fill in here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <Module title="Equipped" href={`${base}/gear`} hrefLabel="Gear and setups" meta="hover a piece" className="md:col-span-2 xl:col-span-5">
            {equipped.any ? (
              <EquippedPanel armor={equipped.armor} jewelry={equipped.jewelry} front={equipped.front} back={equipped.back} sets={equipped.sets} />
            ) : (
              <Empty>No gear captured on the last logout.</Empty>
            )}
          </Module>

          <Module
            title="Skill lines"
            href={`${base}/skills`}
            hrefLabel="All skills"
            meta={capped.length > 0 ? `${maxed} of ${capped.length} maxed` : undefined}
            className="xl:col-span-4"
          >
            {sheet.lines.length === 0 ? (
              <Empty>No skill lines captured yet.</Empty>
            ) : (
              <div className="max-h-[23rem] space-y-3 overflow-y-auto pr-1">
                {tierGroups.map((g) => (
                  <section key={g.tier}>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: TIER_COLOR[g.tier] }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_COLOR[g.tier] }} aria-hidden />
                      {TIER_LABEL[g.tier]}
                      <span className="text-fg-subtle">· {g.left === 0 ? "all met" : `${g.left} left`}</span>
                    </h3>
                    <ul className="space-y-1.5">
                      {g.rows
                        .filter((r) => !r.done)
                        .map((r) => (
                          <li key={r.name}>
                            <Link href={lineHref(r.name)} className="group -mx-1 block rounded-md px-1 py-0.5 hover:bg-surface-2/70">
                              <span className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                                <span className="truncate text-fg group-hover:text-accent">{r.name}</span>
                                <span className="shrink-0 tabular-nums text-fg-muted">
                                  {r.found ? (
                                    <>
                                      {r.rank}
                                      <span className="text-fg-subtle">/{r.need}</span>
                                    </>
                                  ) : (
                                    <span className="text-fg-subtle">not found yet</span>
                                  )}
                                </span>
                              </span>
                              <Bar value={r.found ? r.rank : 0} max={r.need || 1} color={TIER_COLOR[g.tier]} />
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
                {untargeted.length > 0 ? (
                  <details className="group/more" open={tierGroups.length === 0}>
                    <summary className="cursor-pointer list-none text-[12px] text-fg-subtle hover:text-fg">
                      <span className="mr-1 inline-block transition-transform group-open/more:rotate-90">›</span>
                      No target · {untargeted.length} unfinished
                    </summary>
                    <ul className="mt-1.5 space-y-1.5">
                      {untargeted.map((l) => (
                        <li key={l.name}>
                          <Link href={lineHref(l.name)} className="group -mx-1 block rounded-md px-1 py-0.5 hover:bg-surface-2/70">
                            <span className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                              <span className="truncate text-fg-muted group-hover:text-accent">{l.name}</span>
                              <span className="shrink-0 tabular-nums text-fg-subtle">
                                {l.rank}/{l.cap}
                              </span>
                            </span>
                            <Bar value={l.rank} max={l.cap ?? 1} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {tierGroups.length === 0 && untargeted.length === 0 ? (
                  <p className="text-[13px] text-ok">Every skill line is maxed.</p>
                ) : null}
                {tierGroups.length === 0 ? (
                  <p className="text-[12px] text-fg-subtle">
                    No targets for {c.name} yet.{" "}
                    <Link href="/party/planner" className="text-accent hover:underline">
                      Set some in the Planner
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            )}
          </Module>

          <Module
            title="Today"
            href="/party/dailies"
            hrefLabel="Everyone"
            meta={<ResetCountdown compact resetAt={nextEsoResetAt(now, region)} resetHourUtc={dailyResetHourUtc(region)} />}
            className="xl:col-span-3"
          >
            <TodayPanel
              characterId={c.id}
              characterName={c.name}
              rows={todayRows}
              scanned={dailies.scanned}
              trackables={DAILY_TRACKABLES}
              tracked={tracking.keys}
              own={tracking.own}
            />
          </Module>

          <Module title="Champion Points" href={`${base}/champion`} hrefLabel="Constellations" meta="hover a star" className="md:col-span-2 xl:col-span-7">
            {sheet.champion.length === 0 ? (
              <Empty>No Champion Points captured.</Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {sheet.champion.map((d) => {
                  const tone = DISCIPLINE_COLOR[d.discipline.toLowerCase()] ?? "var(--fg-muted)";
                  return (
                    <section key={d.discipline}>
                      <h3 className="mb-2 flex items-baseline justify-between gap-2 border-b pb-1.5" style={{ borderColor: `color-mix(in srgb, ${tone} 35%, transparent)` }}>
                        <span className="text-[13px] font-medium" style={{ color: tone }}>
                          {d.discipline}
                        </span>
                        <span className="text-[12px] tabular-nums text-fg-subtle">{formatNumber(d.spent)} spent</span>
                      </h3>
                      {d.slotted.length === 0 ? (
                        <p className="text-[12px] text-fg-subtle">Nothing slotted</p>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {d.slotted.map((star) => (
                            <li key={star}>
                              <HoverTip
                                tip={
                                  <>
                                    <span className="block font-medium" style={{ color: tone }}>
                                      {star}
                                    </span>
                                    <span className="mt-1 block text-fg-muted">
                                      {starText.get(star.toLowerCase()) || "No description in the Library yet. A catalog scan in game adds it."}
                                    </span>
                                  </>
                                }
                              >
                                <span
                                  tabIndex={0}
                                  className="inline-block cursor-default rounded-lg px-2 py-1 text-[12px] text-fg"
                                  style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 35%, transparent)` }}
                                >
                                  {star}
                                </span>
                              </HoverTip>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </Module>

          <Module
            title="Research"
            href={`${base}/crafting`}
            hrefLabel="Traits, motifs, recipes"
            meta={research.crafts.length > 0 ? (idleSlots > 0 ? `${idleSlots} idle ${idleSlots === 1 ? "slot" : "slots"}` : "every slot busy") : undefined}
            className="xl:col-span-5"
          >
            {research.crafts.length === 0 ? (
              <Empty>No research captured yet.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {research.crafts.map((cr) => {
                  const mine = running.filter((r) => r.craftName === cr.name);
                  const idle = Math.max(0, cr.maxSlots - mine.length);
                  return (
                    <li key={cr.name}>
                      <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                        <span className="text-fg">{cr.name}</span>
                        <span className="text-[12px] tabular-nums text-fg-subtle">
                          {cr.known}/{cr.total} traits
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {mine.map((r) => (
                          <span
                            key={`${r.line}-${r.trait}`}
                            className={`rounded-md px-2 py-0.5 text-[12px] ${r.left === 0 ? "bg-ok/15 text-ok" : "bg-surface-2 text-fg-muted"}`}
                            title={`${r.line} ${r.trait}`}
                          >
                            {r.line} · {r.trait}{" "}
                            <span className="tabular-nums">{r.left === 0 ? "done" : r.left == null ? "" : formatTimeLeft(r.left)}</span>
                          </span>
                        ))}
                        {Array.from({ length: idle }, (_, i) => (
                          <span key={`idle-${i}`} className="rounded-md border border-dashed border-info/50 px-2 py-0.5 text-[12px] text-info">
                            Idle slot
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Module>

          {sheet.setups.length > 0 ? (
            <Module title="Setups" href={`${base}/gear#setups`} hrefLabel="Wizard's Wardrobe" className="md:col-span-2 xl:col-span-12">
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 xl:grid-cols-3">
                {sheet.setups.map((st) => (
                  <li key={`${st.zone}-${st.page}`} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-fg">
                      {st.page}
                      <span className="text-fg-muted"> · {st.setups.filter((n) => n && n.toLowerCase() !== "empty").join(", ") || "empty"}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-fg-subtle">{st.zone}</span>
                  </li>
                ))}
              </ul>
            </Module>
          ) : null}
        </div>
      )}
    </div>
  );
}
