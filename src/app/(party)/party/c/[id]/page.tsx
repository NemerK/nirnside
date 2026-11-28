import { countDown } from "@/lib/game/addons";
import { idleSlots as idleSlots_ } from "@/lib/game/research";
import { ARMOR_SLOTS, SLOT_LABEL, type WornSlot } from "@/lib/game/equipment";
import { baseSetName } from "@/lib/game/loadout";
import { readCharacter, type CharacterReading } from "@/lib/game/understand";
import { abilityLines, classLines, gameRules, lineCap, mundusTexts, resetClock } from "@/lib/db/game-knowledge";
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
import { currentUnix, dailyResetHourUtc, nextEsoResetAt } from "@/lib/game/daily-reset";
import { communityPledgesForUnix, PLEDGE_GIVER_NAMES } from "@/lib/game/pledges";
import { presentCharacterDailies, type DailyCell } from "@/lib/dailies/present";
import { WRIT_CRAFTS, WRIT_LABELS } from "@/lib/game/writs";
import { WORLD_BOSS_ZONES } from "@/lib/game/world-bosses";
import { toGoalSubject } from "@/lib/goals/progress";
import { governs } from "@/lib/goals/effective";
import { buildGoalIndexes, characterGoalRows } from "@/lib/planner/data";
import { presentSheet } from "@/lib/party/sheet";
import { EquippedPanel, type EquippedPiece, type EquippedSet } from "@/components/party/equipped-panel";
import { HoverTip } from "@/components/party/hover-tip";
import { TodayPanel, type TodayRow } from "@/components/party/today-panel";
import { CharacterStatus } from "@/components/party/character-status";
import { CharacterSheet as SheetPanel } from "@/components/party/character-sheet";
import { EsoText } from "@/components/eso-text";
import { DAILY_TRACKABLES, trackedFor } from "@/lib/party/daily-tracking";
import { getDailyTracking } from "@/lib/db/daily-tracking";
import { getCPStars, setHref } from "@/lib/db/catalog-queries";
import { loadSetHover } from "@/lib/catalog/hover-sets";
import { toPartyHref } from "@/lib/party/links";
import { presentResearch } from "@/lib/knowledge/present";
import { TIER_COLOR, TIER_LABEL, type GoalTier } from "@/lib/goals/types";
import { constellationColor } from "@/lib/ui/game-colors";
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

function todayState(status: DailyCell["status"]): TodayRow["state"] {
  if (status === "done" || status === "cooldown") return "done";
  if (status === "ready") return "ready";
  if (status === "accepted") return "accepted";
  if (status === "available") return "open";
  return "unknown";
}

/** Labels for the jewelry tiles. */
const JEWELRY_TILES: [WornSlot, string][] = [
  ["necklace", "Neck"],
  ["ring1", "Ring 1"],
  ["ring2", "Ring 2"],
];

/**
 * Armor, jewelry and both bars as tiles, with set counts and bonuses for the
 * hover card. Slots, bars and set counts come from the game model's reading
 * (worn slots by parseWornSlot; body pieces count on both bars, two-handers
 * count twice, perfected and normal pieces are one set).
 */
function presentEquipped(c: Character, reading: CharacterReading) {
  const hover = safe(() => loadSetHover().briefs, []);
  const brief = (name: string | null) => (name ? hover.find((b) => b.name.toLowerCase() === name.toLowerCase()) : undefined);
  const { loadout } = reading;
  const worn = c.equipped.map((e, i) => ({ e, piece: loadout.pieces[i] }));
  const countsFor = (bar: "front" | "back") => new Map(loadout.sets.map((s) => [s.name.toLowerCase(), s[bar]]));
  const withFront = countsFor("front");
  const withBack = countsFor("back");
  const countOf = (counts: Map<string, number>, setName: string | null | undefined) =>
    setName ? (counts.get(baseSetName(setName).toLowerCase()) ?? 0) : 0;
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
      traitText: e.traitText ?? null,
      armor: e.armor ?? null,
      weaponPower: e.weaponPower ?? null,
      charges: e.maxCharges ? { now: e.charges ?? 0, max: e.maxCharges } : null,
      setName: e.setName ?? null,
      setHref: hrefFor(e.setName ?? null, e.setId),
      setCount: countOf(counts, e.setName),
      setMax: b?.maxEquip ?? 0,
      bonuses: b?.bonuses ?? [],
    };
  };

  const onBody = new Map(worn.filter((w) => w.piece.bar == null && w.piece.slot).map((w) => [w.piece.slot!, w.e]));
  const fill = (slots: [WornSlot, string][]) =>
    slots.map(([slot, label]) => {
      const e = onBody.get(slot);
      return e ? tile(e, label, withFront) : { empty: label };
    });
  const bar = (which: "front" | "back", counts: Map<string, number>) => {
    const list = worn.filter((w) => w.piece.bar === which);
    const main = list.find((w) => w.piece.slot === "mainhand" || w.piece.weight === 2) ?? list[0];
    const off = list.find((w) => w !== main);
    const two = !!main && main.piece.weight === 2;
    return [
      main ? tile(main.e, two ? "Two-handed" : "Main hand", counts) : { empty: "Main hand" },
      ...(two ? [] : [off ? tile(off.e, "Off hand", counts) : { empty: "Off hand" }]),
    ];
  };
  const sets: EquippedSet[] = loadout.sets
    .map((set) => ({
      name: set.name,
      href: hrefFor(set.name, set.setId),
      front: set.front,
      back: set.back !== set.front ? set.back : null,
      max: brief(set.name)?.maxEquip ?? 0,
    }))
    .sort((a, b) => b.front - a.front || a.name.localeCompare(b.name));
  return {
    armor: fill(ARMOR_SLOTS.map((slot) => [slot, SLOT_LABEL[slot]])),
    jewelry: fill(JEWELRY_TILES),
    front: bar("front", withFront),
    back: bar("back", withBack),
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
  // The game's reset hour from the save; the megaserver's reference hour until then.
  const region = resetClock(account?.region === "NA" ? "NA" : "EU");
  const isSample = safe(() => getDataSource(), null)?.kind === "sample";
  const color = classColor(c.class) ?? "#b46ad4";
  const known = c.lastSeen != null;
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
        const need = Math.max(r.goal.targetRank, r.goal.extraRank ?? 0) || line?.cap || lineCap(r.goal.target) || 0;
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
    // Riding on its own timer; left out once every skill is trained.
    ...(dailies.riding.status === "done"
      ? []
      : [
          {
            key: "riding",
            label: "Riding lesson",
            detail:
              dailies.riding.status === "cooldown" && dailies.riding.remainingSeconds != null
                ? `next in ${Math.ceil(dailies.riding.remainingSeconds / 3600)}h`
                : null,
            state: todayState(dailies.riding.status),
          },
        ]),
  ];

  // Champion Points: slotted stars in their discipline's color, with what each does.
  const starText = new Map(
    safe(() => getCPStars(), []).map((r) => [r.entry.name.toLowerCase(), r.entry.description] as const),
  );
  // What each star's points give now, as the Champion window says it (snapshot 0.9.46+).
  const starBonus = new Map(
    c.champion.flatMap((d) => d.stars).filter((s) => s.bonus).map((s) => [s.name.toLowerCase(), { bonus: s.bonus!, points: s.points }] as const),
  );

  // Research: every slot, running or idle. Research keeps going after logout.
  const research = presentResearch(c.research);
  const elapsed = c.lastSeen != null ? Math.max(0, now - c.lastSeen) : 0;
  const running = research.inProgress.map((r) => ({ ...r, left: countDown(r.remainingSeconds, elapsed) }));
  const idleSlots = research.crafts.reduce((n, cr) => n + idleSlots_(cr), 0);
  // One reading of the character through the game model.
  // The game's caps and timers from the latest save (reference until then).
  const rules = gameRules();
  const reading = readCharacter(c, safe(classLines, new Map()), safe(abilityLines, new Map()), { rules, mundus: safe(mundusTexts, []), companions: safe(() => getAccount()?.companions ?? [], []) }, now);
  const equipped = presentEquipped(c, reading);

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
              {reading.mundus.blessings.map((m) => (
                <span key={m.name}>
                  {" · "}
                  {m.text || m.amount ? (
                    <HoverTip
                      tip={
                        <>
                          {m.amount ? <span className="block text-[13px] font-medium tabular-nums text-fg">{m.amount}</span> : null}
                          {m.text ? (
                            <span className="mt-0.5 block text-[13px] text-fg-muted">
                              <EsoText text={m.text} />
                            </span>
                          ) : null}
                          {m.amountFrom === "catalog" ? (
                            <span className="mt-1 block text-[12px] text-fg-subtle">The stone&apos;s base amount; this character&apos;s own shows after its next save.</span>
                          ) : null}
                        </>
                      }
                    >
                      <span className="cursor-help underline decoration-dotted underline-offset-2">{m.name}</span>
                    </HoverTip>
                  ) : (
                    m.name
                  )}
                </span>
              ))}
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

          <Module
            title="On the character"
            meta={c.lastSeen != null ? `as of the last save, ${timeAgo(c.lastSeen)}` : undefined}
            className="md:col-span-2 xl:col-span-12"
          >
            <CharacterStatus reading={reading} skyshardsPerPoint={rules.skyshardsPerPoint} />
          </Module>

          <Module
            title="Character sheet"
            meta={reading.stats ? "as the game's Stats window showed it at the save" : undefined}
            className="md:col-span-2 xl:col-span-12"
          >
            <SheetPanel stats={reading.stats} bars={reading.skillBars} />
          </Module>

          <Module title="Champion Points" href={`${base}/champion`} hrefLabel="Constellations" meta="hover a star" className="md:col-span-2 xl:col-span-7">
            {sheet.champion.length === 0 ? (
              <Empty>No Champion Points captured.</Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {sheet.champion.map((d) => {
                  const tone = constellationColor(d.discipline) ?? "var(--fg-muted)";
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
                                      {starText.get(star.toLowerCase()) ? (
                                        <EsoText text={starText.get(star.toLowerCase())!} />
                                      ) : (
                                        "No description in the Library yet. A catalog scan in game adds it."
                                      )}
                                    </span>
                                    {starBonus.get(star.toLowerCase()) ? (
                                      <span className="mt-1.5 block border-t border-border pt-1.5 text-fg">
                                        <span className="text-fg-subtle">With {starBonus.get(star.toLowerCase())!.points} points: </span>
                                        <EsoText text={starBonus.get(star.toLowerCase())!.bonus} />
                                      </span>
                                    ) : null}
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
                  const idle = idleSlots_({ ...cr, researching: mine.length });
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
