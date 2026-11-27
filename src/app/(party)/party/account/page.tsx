import Link from "next/link";
import { Bar, Empty, Module } from "@/components/party/module";
import { PageHead } from "@/components/party/page-head";
import { getDb } from "@/lib/db";
import { getAccount, getCompletedAchievementIds, getDataSource, getOutfitStyles, getStickerbookStats } from "@/lib/db/queries";
import { ACCOUNT_CURRENCIES, canonicalizeCurrencies } from "@/lib/currencies";
import { formatNumber, locationLabel } from "@/lib/format";
import { accountAlliancePoints, accountTelVar, goldBreakdown } from "@/lib/snapshot/roster";
import { presentOutfitStyles, presentResearch } from "@/lib/knowledge/present";
import { classColor } from "@/lib/classes";
import { timeAgo } from "@/lib/format";
import { currentUnix, type EsoRegion } from "@/lib/dailies/day";
import { communityPledgesForUnix } from "@/lib/dailies/pledges";
import { presentAccountDailies, summarizeDailies } from "@/lib/dailies/present";
import { PITHKA_TABS, allTrackedIds } from "@/lib/achievements/pithka";
import { craftingCharacters, dailiesCharacters, roster } from "@/lib/party/data";

export const dynamic = "force-dynamic";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function Tally({ label, done, total, href }: { label: string; done: number; total: number; href?: string }) {
  const body = (
    <>
      <div className="mb-1 flex justify-between gap-3 text-[14px]">
        <span className="text-fg">{label}</span>
        <span className="tabular-nums text-fg-muted">{total > 0 ? `${formatNumber(done)} / ${formatNumber(total)}` : "—"}</span>
      </div>
      <Bar value={done} max={total} />
    </>
  );
  return <li>{href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body}</li>;
}

export default function AccountPage() {
  const account = safe(() => getAccount(), null);
  if (!account) {
    return (
      <div className="mx-auto max-w-[1320px]">
        <PageHead title="Account" lead="Nothing here yet. Log a character out with the addon on to fill it." />
      </div>
    );
  }
  const characters = roster();
  const gold = goldBreakdown({ characters, bankGold: account.currencies?.bankGold ?? 0, legacyGold: account.gold });
  const wallet: Record<string, number> = {
    ...canonicalizeCurrencies(account.currencies),
    alliancePoints: accountAlliancePoints({ characters, legacyAlliancePoints: account.currencies?.alliancePoints }),
    telVar: accountTelVar({ characters, legacyTelVar: account.currencies?.telVar }),
  };
  const shown = ACCOUNT_CURRENCIES.filter((c) => c.always || (wallet[c.key] ?? 0) > 0);

  const bags = safe(
    () =>
      getDb()
        .prepare("SELECT location, COUNT(*) AS stacks, COALESCE(SUM(count), 0) AS items FROM items GROUP BY location ORDER BY items DESC")
        .all() as { location: string; stacks: number; items: number }[],
    [],
  );
  const sticker = safe(() => getStickerbookStats(), { total: 0, collected: 0, sets: 0 });
  const closest = safe(
    () =>
      getDb()
        .prepare("SELECT name, collected, total FROM stickerbook WHERE collected < total ORDER BY (total - collected) ASC, name ASC LIMIT 4")
        .all() as { name: string; collected: number; total: number }[],
    [],
  );
  const done = new Set(safe(() => getCompletedAchievementIds(), []));
  const achievementTabs = PITHKA_TABS.map((t) => {
    const ids = allTrackedIds(t.rows);
    return { label: t.id, done: ids.filter((id) => done.has(id)).length, total: ids.length };
  });

  const now = currentUnix();
  const region: EsoRegion = account.region === "NA" ? "NA" : "EU";
  const isSample = safe(() => getDataSource(), null)?.kind === "sample";
  const dailyRows = presentAccountDailies(dailiesCharacters(), now, {
    treatAsFresh: isSample,
    todayPledges: communityPledgesForUnix(now, region),
    region,
  });
  const dailyBy = new Map(dailyRows.map((r) => [r.characterId, summarizeDailies([r])]));
  const researchBy = new Map(
    craftingCharacters().map((c) => {
      const r = presentResearch(c.research);
      const idle = r.crafts.reduce((n, cr) => n + Math.max(0, cr.maxSlots - cr.researching), 0);
      // Research keeps running after logout: count what has finished since.
      const elapsed = c.lastSeen != null ? Math.max(0, now - c.lastSeen) : 0;
      const ready = r.inProgress.filter((x) => x.remainingSeconds != null && x.remainingSeconds - elapsed <= 0).length;
      return [c.id, { idle, ready }];
    }),
  );
  const styles = presentOutfitStyles(safe(() => getOutfitStyles(), []));
  const houses = account.houses ?? [];
  const mythics = account.mythics ?? [];

  return (
    <div className="mx-auto w-full max-w-[1320px]">
      <PageHead
        title={account.displayName}
        lead={`${account.region}${account.esoPlus ? " · ESO Plus" : ""} · ${characters.length} characters · updated ${timeAgo(account.lastSnapshot)}`}
      />

      <section className="party-module mb-4 px-5 py-4">
        <dl className="flex flex-wrap gap-x-9 gap-y-3">
          <div>
            <dt className="text-[12px] text-fg-subtle">Gold, bank and every wallet</dt>
            <dd className="font-display text-[26px] leading-tight tabular-nums text-accent">{formatNumber(gold.total)}</dd>
            {gold.bank > 0 ? <dd className="text-[12px] text-fg-subtle">{formatNumber(gold.bank)} in the bank</dd> : null}
          </div>
          {shown.map((c) => (
            <div key={c.key}>
              <dt className="text-[12px] text-fg-subtle">{c.label}</dt>
              <dd className="font-display text-[26px] leading-tight tabular-nums text-fg">{formatNumber(wallet[c.key] ?? 0)}</dd>
            </div>
          ))}
          <div className="self-end">
            <Link href="/party/account/inventory?view=currency" className="text-[13px] text-accent hover:underline">
              Per character
            </Link>
          </div>
        </dl>
      </section>

      <section className="party-module mb-4 overflow-hidden p-0">
        <header className="flex items-baseline justify-between gap-3 px-5 pb-2 pt-3">
          <h2 className="font-display text-[18px] text-fg">Characters</h2>
          <span className="flex gap-4 text-[12px]">
            <Link href="/party/across/dailies" className="text-accent hover:underline">
              Dailies for everyone
            </Link>
            <Link href="/party/across/skills" className="text-accent hover:underline">
              Skill lines for everyone
            </Link>
          </span>
        </header>
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface text-left text-[12px] text-fg-subtle">
              <tr className="border-b border-border">
                <th className="px-5 py-1.5 font-normal">Character</th>
                <th className="px-3 py-1.5 font-normal">Class</th>
                <th className="px-3 py-1.5 text-right font-normal">CP / level</th>
                <th className="px-3 py-1.5 text-right font-normal">Gold</th>
                <th className="px-3 py-1.5 font-normal">Today&apos;s dailies</th>
                <th className="px-3 py-1.5 font-normal">Research</th>
                <th className="px-5 py-1.5 text-right font-normal">Last logout</th>
              </tr>
            </thead>
            <tbody>
              {characters.map((c) => {
                const d = dailyBy.get(c.id);
                const done = d ? d.randomsDone + d.writsDone + d.pledgesDone + d.worldBossesDone : 0;
                const total = d ? d.randomsTotal + d.writsTotal + d.pledgesTotal + d.worldBossesTotal : 0;
                const r = researchBy.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                    <td className="px-5 py-1.5">
                      <Link href={`/party/c/${encodeURIComponent(c.id)}`} className="text-fg hover:text-accent">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5" style={{ color: classColor(c.class) ?? undefined }}>
                      {c.class}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-fg-muted">
                      {c.level >= 50 ? formatNumber(c.championPoints) : `Lv ${c.level}`}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-fg-muted">
                      {c.lastSeen == null ? "—" : formatNumber(c.gold ?? 0)}
                    </td>
                    <td className="px-3 py-1.5">
                      {!d || d.scanned === 0 ? (
                        <span className="text-fg-subtle">Not since reset</span>
                      ) : total === 0 ? (
                        <span className="text-fg-subtle">—</span>
                      ) : (
                        <span className={done >= total ? "text-ok" : "text-fg"}>
                          {done}/{total} done
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {!r ? (
                        <span className="text-fg-subtle">—</span>
                      ) : r.ready > 0 || r.idle > 0 ? (
                        <span>
                          {r.ready > 0 ? <span className="text-ok">{r.ready} finished</span> : null}
                          {r.ready > 0 && r.idle > 0 ? <span className="text-fg-subtle"> · </span> : null}
                          {r.idle > 0 ? <span className="text-accent">{r.idle} idle</span> : null}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">All slots busy</span>
                      )}
                    </td>
                    <td className="px-5 py-1.5 text-right text-fg-subtle">
                      {c.lastSeen == null ? "not yet" : timeAgo(c.lastSeen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Module title="Inventory" href="/party/account/inventory" hrefLabel="Search bags">
          {bags.length === 0 ? (
            <Empty>No items captured yet.</Empty>
          ) : (
            <ul className="space-y-2 text-[14px]">
              {bags.map((b) => (
                <li key={b.location} className="flex justify-between gap-3">
                  <Link href={`/party/account/inventory?location=${encodeURIComponent(b.location)}`} className="text-fg hover:text-accent">
                    {locationLabel(b.location)}
                  </Link>
                  <span className="tabular-nums text-fg-muted">
                    {formatNumber(b.items)} <span className="text-fg-subtle">in {formatNumber(b.stacks)} stacks</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Module>

        <Module title="Set collection" href="/party/account/sets" hrefLabel="Open sets">
          <ul className="space-y-3">
            <Tally label="Pieces collected" done={sticker.collected} total={sticker.total} />
          </ul>
          {closest.length > 0 ? (
            <>
              <p className="mb-1.5 mt-4 text-[12.5px] text-fg-subtle">Closest to complete</p>
              <ul className="space-y-1.5 text-[14px]">
                {closest.map((s) => (
                  <li key={s.name} className="flex justify-between gap-3">
                    <span className="truncate text-fg">{s.name}</span>
                    <span className="shrink-0 tabular-nums text-fg-muted">{s.total - s.collected} to go</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </Module>

        <Module title="Achievements" href="/party/account/achievements" hrefLabel="Open board">
          <ul className="space-y-3">
            {achievementTabs.map((t) => (
              <Tally key={t.label} label={t.label} done={t.done} total={t.total} />
            ))}
          </ul>
        </Module>

        <Module title="Mythics">
          {mythics.length === 0 ? (
            <Empty>No mythic leads captured.</Empty>
          ) : (
            <ul className="space-y-3">
              {mythics.map((m) => {
                const got = m.leads.filter((l) => l.recovered).length;
                const lead = m.leads.find((l) => l.hasLead && !l.recovered);
                return (
                  <li key={m.setId}>
                    <div className="mb-1 flex justify-between gap-3 text-[14px]">
                      <span className="truncate text-fg">{m.name}</span>
                      <span className="tabular-nums text-fg-muted">
                        {got}/{m.leads.length}
                      </span>
                    </div>
                    <Bar value={got} max={m.leads.length} color={m.collected ? "var(--ok)" : "var(--color-q-mythic)"} />
                    {lead?.zone ? <p className="mt-1 text-[12.5px] text-fg-subtle">Lead in hand: {lead.zone}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Module>

        <Module title="Outfit styles" href="/party/account/styles" hrefLabel="Open styles">
          <ul className="space-y-3">
            <Tally label="Unlocked" done={styles.unlocked} total={styles.total} />
          </ul>
        </Module>

        <Module title="Houses" href="/party/account/houses" hrefLabel="Open houses">
          {houses.length === 0 ? (
            <Empty>No houses owned.</Empty>
          ) : (
            <ul className="space-y-2 text-[14px]">
              {houses.map((h) => (
                <li key={h.collectibleId} className="flex justify-between gap-3">
                  <span className="truncate text-fg">
                    {h.name}
                    {h.primary ? <span className="ml-1.5 text-[12px] text-accent">primary</span> : null}
                  </span>
                  <span className="shrink-0 text-fg-subtle">{h.location}</span>
                </li>
              ))}
            </ul>
          )}
        </Module>

        <Module title="Guilds">
          {(account.guilds ?? []).length === 0 ? (
            <Empty>No guilds captured.</Empty>
          ) : (
            <ul className="space-y-2 text-[14px]">
              {(account.guilds ?? []).map((g) => (
                <li key={g.name} className="flex justify-between gap-3">
                  <span className="truncate text-fg">{g.name}</span>
                  <span className="shrink-0 text-fg-muted">
                    {g.trader ? <span className="text-ok">Has a trader</span> : null}
                    {g.trader && g.rank ? " · " : null}
                    {g.rank}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Module>
      </div>
    </div>
  );
}
