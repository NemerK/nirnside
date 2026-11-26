import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Droplet, Moon } from "lucide-react";
import { Bar, Empty, Module } from "@/components/party/module";
import { RolePicker } from "@/components/role-picker";
import { ResetCountdown } from "@/components/reset-countdown";
import { getAccount, getCharacter, getDataSource } from "@/lib/db/queries";
import { getDb } from "@/lib/db";
import { listGoals } from "@/lib/db/goals";
import { listAssignments, listRoles } from "@/lib/db/roles";
import { rolesForCharacter } from "@/lib/roles/filter";
import { classColor } from "@/lib/classes";
import { ALLIANCE_ACCENT, formatNumber, qualityText, timeAgo } from "@/lib/format";
import { currentUnix, dailyResetHourUtc, nextEsoResetAt, type EsoRegion } from "@/lib/dailies/day";
import { communityPledgesForUnix, PLEDGE_GIVER_NAMES } from "@/lib/dailies/pledges";
import { presentCharacterDailies, WRIT_CRAFTS, WRIT_LABELS, type DailyCell } from "@/lib/dailies/present";
import { WORLD_BOSS_ZONES } from "@/lib/dailies/world-bosses";
import { toGoalSubject } from "@/lib/goals/progress";
import { targetTitle } from "@/lib/goals/review";
import { governs } from "@/lib/goals/effective";
import { buildGoalIndexes, characterGoalRows } from "@/lib/planner/data";
import { presentSheet, type GearPiece } from "@/lib/party/sheet";
import { formatTimeLeft } from "@/lib/today/present";
import type { ItemQuality } from "@/lib/snapshot/schema";

export const dynamic = "force-dynamic";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const DONE = new Set(["done", "cooldown"]);

function DailyRow({ label, cell }: { label: string; cell: DailyCell }) {
  const tone = DONE.has(cell.status)
    ? "text-ok"
    : cell.status === "accepted" || cell.status === "ready"
      ? "text-accent"
      : cell.status === "unknown"
        ? "text-fg-subtle"
        : "text-fg-muted";
  const word = DONE.has(cell.status)
    ? "Done"
    : cell.status === "ready"
      ? "Turn in"
      : cell.status === "accepted"
        ? "Picked up"
        : cell.status === "available"
          ? "Open"
          : "Unknown";
  return (
    <li className="flex items-center justify-between gap-3 text-[14px]">
      <span className="truncate text-fg">
        {label}
        {cell.dungeon ? <span className="ml-1.5 text-[12px] text-fg-subtle">{cell.dungeon}</span> : null}
      </span>
      <span className={`flex shrink-0 items-center gap-1 ${tone}`}>
        {DONE.has(cell.status) ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
        {word}
      </span>
    </li>
  );
}

function Piece({ p }: { p: GearPiece }) {
  return (
    <li className="rounded-xl border border-border bg-surface-2/60 px-3 py-2">
      <span className="block text-[11.5px] text-fg-subtle">{p.slot}</span>
      <span className={`block truncate text-[14px] ${qualityText(p.quality as ItemQuality | null)}`}>{p.name}</span>
      <span className="block truncate text-[12px] text-fg-subtle">{[p.trait, p.enchant].filter(Boolean).join(" · ") || " "}</span>
    </li>
  );
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
  const openTargets = targetRows.filter((r) => r.mark.state !== "done");

  const bags = safe(
    () =>
      getDb()
        .prepare(
          "SELECT COUNT(*) AS stacks, COALESCE(SUM(count), 0) AS items FROM items WHERE ownerCharacter = ? AND location != 'worn'",
        )
        .get(c.name) as { stacks: number; items: number },
    { stacks: 0, items: 0 },
  );

  const base = `/party/c/${encodeURIComponent(c.id)}`;

  return (
    <div className="mx-auto w-full max-w-[1320px]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-[52px] leading-[1.02] text-fg">{c.name}</h1>
          <p className="mt-2 text-[15px] text-fg-muted">
            {c.race} <span style={{ color }}>{c.class}</span> ·{" "}
            <span style={{ color: ALLIANCE_ACCENT[c.alliance] }}>{c.alliance}</span>
            {c.mundus ? <> · {c.mundus}</> : null}
            {known ? <span className="text-fg-subtle"> · last logout {timeAgo(c.lastSeen)}</span> : null}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
            {c.vampire.isVampire ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-fg-muted">
                <Droplet className="h-3.5 w-3.5 text-danger" /> Vampire, stage {c.vampire.stage}
              </span>
            ) : null}
            {c.werewolf.isWerewolf ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-fg-muted">
                <Moon className="h-3.5 w-3.5 text-info" /> Werewolf
              </span>
            ) : null}
            <RolePicker characterId={c.id} assigned={assigned} roles={roles} />
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3 text-right">
          <div>
            <dt className="text-[12px] text-fg-subtle">{c.level >= 50 ? "Champion Points" : "Level"}</dt>
            <dd className="font-display text-[34px] leading-none tabular-nums text-fg">
              {c.level >= 50 ? formatNumber(c.championPoints) : c.level}
            </dd>
          </div>
          {known ? (
            <div>
              <dt className="text-[12px] text-fg-subtle">Carried gold</dt>
              <dd className="font-display text-[34px] leading-none tabular-nums text-accent">{formatNumber(c.gold ?? 0)}</dd>
            </div>
          ) : null}
          {known && (c.alliancePoints ?? 0) > 0 ? (
            <div>
              <dt className="text-[12px] text-fg-subtle">Alliance Points</dt>
              <dd className="font-display text-[34px] leading-none tabular-nums text-fg">{formatNumber(c.alliancePoints ?? 0)}</dd>
            </div>
          ) : null}
        </dl>
      </header>

      {archived ? (
        <p className="mb-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-fg-muted">
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
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Module title="Worn now" href={`${base}/gear`} hrefLabel="Gear and setups" className="md:col-span-2 xl:col-span-2">
            {sheet.gear.body.length + sheet.gear.front.length + sheet.gear.back.length === 0 ? (
              <Empty>No gear captured on the last logout.</Empty>
            ) : (
              <div className="space-y-4">
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {sheet.gear.body.map((p) => (
                    <Piece key={`b-${p.slot}`} p={p} />
                  ))}
                </ul>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[12.5px] text-fg-subtle">Front bar</p>
                    <ul className="grid gap-2">{sheet.gear.front.map((p) => <Piece key={`f-${p.slot}`} p={p} />)}</ul>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[12.5px] text-fg-subtle">Back bar</p>
                    <ul className="grid gap-2">{sheet.gear.back.map((p) => <Piece key={`k-${p.slot}`} p={p} />)}</ul>
                  </div>
                </div>
                {sheet.gear.frontSets.length > 0 ? (
                  <p className="text-[13px] text-fg-muted">
                    Sets on the front bar:{" "}
                    {sheet.gear.frontSets.map((s, i) => (
                      <span key={s.name}>
                        {i > 0 ? ", " : null}
                        <span className="text-fg">{s.name}</span> {s.count}
                      </span>
                    ))}
                    {sheet.gear.backSets.length > 0 ? (
                      <>
                        . Back bar changes{" "}
                        {sheet.gear.backSets.map((s, i) => (
                          <span key={s.name}>
                            {i > 0 ? ", " : null}
                            <span className="text-fg">{s.name}</span> to {s.count}
                          </span>
                        ))}
                      </>
                    ) : null}
                    .
                  </p>
                ) : null}
              </div>
            )}
          </Module>

          <Module title="Today" href="/party/vault/dailies" hrefLabel="Every character">
            <ResetCountdown resetAt={nextEsoResetAt(now, region)} resetHourUtc={dailyResetHourUtc(region)} />
            {!dailies.scanned ? (
              <Empty>Not logged out since the reset, so today&apos;s dailies are unknown.</Empty>
            ) : (
              <ul className="mt-4 space-y-1.5">
                <DailyRow label="Random normal" cell={dailies.randomNormal} />
                <DailyRow label="Random veteran" cell={dailies.randomVeteran} />
                {WRIT_CRAFTS.filter((w) => dailies.writs[w].status !== "unknown").map((w) => (
                  <DailyRow key={w} label={`${WRIT_LABELS[w]} writ`} cell={dailies.writs[w]} />
                ))}
                {(Object.keys(PLEDGE_GIVER_NAMES) as (keyof typeof PLEDGE_GIVER_NAMES)[]).map((g) => (
                  <DailyRow key={g} label={`Pledge: ${PLEDGE_GIVER_NAMES[g].split(" ")[0]}`} cell={dailies.pledges[g]} />
                ))}
                {WORLD_BOSS_ZONES.filter((z) => dailies.worldBosses[z.id]?.status !== "unknown").map((z) => (
                  <DailyRow key={z.id} label={`World boss: ${z.name}`} cell={dailies.worldBosses[z.id]} />
                ))}
              </ul>
            )}
          </Module>

          <Module title="Skill lines" href={`${base}/skills`} hrefLabel="Abilities and morphs">
            <ul className="space-y-2.5">
              {sheet.lines.slice(0, 8).map((l) => (
                <li key={l.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[14px]">
                    <span className="truncate text-fg">
                      {l.name}
                      {l.subclassed ? <span className="ml-1.5 text-[12px] text-fg-subtle">subclass</span> : null}
                    </span>
                    <span className="tabular-nums text-fg-muted">
                      {l.rank}
                      {l.cap ? <span className="text-fg-subtle">/{l.cap}</span> : null}
                    </span>
                  </div>
                  {l.cap ? <Bar value={l.rank} max={l.cap} color={l.subclassed ? "var(--info)" : undefined} /> : null}
                </li>
              ))}
            </ul>
            {sheet.lines.length > 8 ? (
              <p className="mt-3 text-[13px] text-fg-subtle">and {sheet.lines.length - 8} more lines</p>
            ) : null}
          </Module>

          <Module title="Targets" href="/party/targets" hrefLabel="All targets">
            {targetRows.length === 0 ? (
              <Empty>
                No targets for {c.name}.{" "}
                <Link href="/party/compare" className="text-accent hover:underline">
                  Set one from Compare
                </Link>
                .
              </Empty>
            ) : openTargets.length === 0 ? (
              <p className="text-sm text-ok">Every target for {c.name} is met.</p>
            ) : (
              <ul className="space-y-2 text-[14px]">
                {openTargets.slice(0, 7).map((r) => (
                  <li key={r.goal.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-fg">{targetTitle(r.goal)}</span>
                    <span className="shrink-0 text-[13px] text-fg-muted">{r.mark.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </Module>

          <Module title="Champion stars" href={`${base}/champion`} hrefLabel="Full constellation">
            {sheet.champion.length === 0 ? (
              <Empty>No Champion Points captured.</Empty>
            ) : (
              <dl className="space-y-3 text-[14px]">
                {sheet.champion.map((d) => (
                  <div key={d.discipline}>
                    <dt className="flex justify-between text-[12.5px] text-fg-subtle">
                      <span>{d.discipline}</span>
                      <span className="tabular-nums">{formatNumber(d.spent)} spent</span>
                    </dt>
                    <dd className="mt-0.5 text-fg">{d.slotted.length > 0 ? d.slotted.join(", ") : "Nothing slotted"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Module>

          <Module title="Setups" href={`${base}/gear#setups`} hrefLabel="Open setups">
            {sheet.setups.length === 0 ? (
              <Empty>No Wizard&apos;s Wardrobe setups on this character.</Empty>
            ) : (
              <ul className="space-y-2 text-[14px]">
                {sheet.setups.map((s) => (
                  <li key={`${s.zone}-${s.page}`} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-fg">
                      {s.page}
                      <span className="text-fg-muted"> — {s.setups.join(", ")}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] text-fg-subtle">{s.zone}</span>
                  </li>
                ))}
              </ul>
            )}
          </Module>

          <Module title="Crafting" href={`${base}/crafting`} hrefLabel="Traits, motifs, recipes">
            {sheet.crafts.length === 0 ? (
              <Empty>No research captured yet.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {sheet.crafts.map((cr) => (
                  <li key={cr.craft}>
                    <div className="mb-1 flex justify-between text-[14px]">
                      <span className="text-fg">{cr.craft}</span>
                      <span className="tabular-nums text-fg-muted">
                        {cr.known}/{cr.total}
                        {cr.slots > 0 && cr.researching < cr.slots ? (
                          <span className="ml-2 text-accent">{cr.slots - cr.researching} idle</span>
                        ) : null}
                      </span>
                    </div>
                    <Bar value={cr.known} max={cr.total} />
                  </li>
                ))}
              </ul>
            )}
            {sheet.running.length > 0 ? (
              <ul className="mt-3 space-y-1 text-[13px]">
                {sheet.running.slice(0, 3).map((r) => (
                  <li key={`${r.craft}-${r.line}-${r.trait}`} className="flex justify-between gap-3">
                    <span className="truncate text-fg-muted">
                      {r.line} · {r.trait}
                    </span>
                    <span className={r.remaining === 0 ? "text-ok" : "tabular-nums text-fg-muted"}>{formatTimeLeft(r.remaining)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-[13px] text-fg-subtle">
              Motifs {sheet.motifs.known}/{sheet.motifs.total} · Recipes {sheet.recipes.known}/{sheet.recipes.total} · Plans{" "}
              {sheet.plans.known}/{sheet.plans.total}
            </p>
          </Module>

          <Module title="Companions">
            {sheet.companions.length === 0 ? (
              <Empty>No companions recruited.</Empty>
            ) : (
              <ul className="space-y-2 text-[14px]">
                {sheet.companions.map((x) => (
                  <li key={x.name} className="flex justify-between gap-3">
                    <span className="truncate text-fg">{x.name}</span>
                    <span className="shrink-0 text-fg-muted">
                      {x.rapport ? <span className="text-accent">{x.rapport}</span> : null} · level {x.level}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Module>

          <Module title="Bags" href={`/party/vault/inventory?owner=${encodeURIComponent(c.name)}`} hrefLabel="Open bags">
            <p className="font-display text-[30px] leading-none tabular-nums text-fg">{formatNumber(bags.items)}</p>
            <p className="mt-1 text-[13px] text-fg-muted">
              items in {formatNumber(bags.stacks)} stacks in the backpack. Bank and craft bag are in the Vault.
            </p>
            <p className="mt-3 text-[13px] text-fg-subtle">
              {sheet.scripts} scribing {sheet.scripts === 1 ? "script" : "scripts"} known.
            </p>
          </Module>
        </div>
      )}
    </div>
  );
}
