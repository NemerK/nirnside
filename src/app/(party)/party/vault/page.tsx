import Link from "next/link";
import { Bar, Empty, Module } from "@/components/party/module";
import { PageHead } from "@/components/party/page-head";
import { VaultNav } from "@/components/party/vault-nav";
import { getDb } from "@/lib/db";
import { getAccount, getCompletedAchievementIds, getDataSource, getOutfitStyles, getStickerbookStats } from "@/lib/db/queries";
import { ACCOUNT_CURRENCIES, canonicalizeCurrencies } from "@/lib/currencies";
import { formatNumber, locationLabel } from "@/lib/format";
import { accountAlliancePoints, accountTelVar, goldBreakdown } from "@/lib/snapshot/roster";
import { presentOutfitStyles, summarizeAccountKnowledge } from "@/lib/knowledge/present";
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

export default function VaultPage() {
  const account = safe(() => getAccount(), null);
  if (!account) {
    return (
      <div className="mx-auto max-w-[1320px]">
        <PageHead title="The Vault" lead="Nothing here yet. Log a character out with the addon on to fill it." />
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
  const daily = summarizeDailies(
    presentAccountDailies(dailiesCharacters(), now, { treatAsFresh: isSample, todayPledges: communityPledgesForUnix(now, region), region }),
  );
  const knowledge = summarizeAccountKnowledge(craftingCharacters());
  const styles = presentOutfitStyles(safe(() => getOutfitStyles(), []));
  const houses = account.houses ?? [];
  const mythics = account.mythics ?? [];

  return (
    <div className="mx-auto w-full max-w-[1320px]">
      <PageHead title="The Vault" lead={`What ${account.displayName} owns, shared by every character.`} />
      <VaultNav current="" />

      <section className="party-module mb-5 px-6 py-5">
        <h2 className="mb-4 font-display text-[24px] text-accent">Treasury</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className="text-[12.5px] text-fg-subtle">Gold</dt>
            <dd className="font-display text-[30px] leading-tight tabular-nums text-accent">{formatNumber(gold.total)}</dd>
            {gold.bank > 0 ? <dd className="text-[12px] text-fg-subtle">{formatNumber(gold.bank)} in the bank</dd> : null}
          </div>
          {shown.map((c) => (
            <div key={c.key}>
              <dt className="text-[12.5px] text-fg-subtle">{c.label}</dt>
              <dd className="font-display text-[30px] leading-tight tabular-nums text-fg">{formatNumber(wallet[c.key] ?? 0)}</dd>
            </div>
          ))}
        </dl>
        <Link href="/party/vault/inventory?view=currency" className="mt-4 inline-block text-[13px] text-accent hover:underline">
          Per character
        </Link>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Module title="Inventory" href="/party/vault/inventory" hrefLabel="Search bags">
          {bags.length === 0 ? (
            <Empty>No items captured yet.</Empty>
          ) : (
            <ul className="space-y-2 text-[14px]">
              {bags.map((b) => (
                <li key={b.location} className="flex justify-between gap-3">
                  <Link href={`/party/vault/inventory?location=${encodeURIComponent(b.location)}`} className="text-fg hover:text-accent">
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

        <Module title="Set collection" href="/party/vault/sets" hrefLabel="Open sets">
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

        <Module title="Achievements" href="/party/vault/achievements" hrefLabel="Open board">
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

        <Module title="Dailies" href="/party/vault/dailies" hrefLabel="Every character">
          {daily.scanned === 0 ? (
            <Empty>No character has logged out since the reset.</Empty>
          ) : (
            <ul className="space-y-3">
              <Tally label="Random dungeons" done={daily.randomsDone} total={daily.randomsTotal} />
              <Tally label="Crafting writs" done={daily.writsDone} total={daily.writsTotal} />
              <Tally label="Pledges" done={daily.pledgesDone} total={daily.pledgesTotal} />
              <Tally label="World bosses" done={daily.worldBossesDone} total={daily.worldBossesTotal} />
            </ul>
          )}
          <p className="mt-3 text-[12.5px] text-fg-subtle">
            {daily.scanned} of {daily.total} characters logged out since the reset.
          </p>
        </Module>

        <Module title="Crafting" href="/party/vault/crafting" hrefLabel="Who can craft it">
          <ul className="space-y-3">
            <Tally label="Traits researched" done={knowledge.researchKnown} total={knowledge.researchTotal} />
            <Tally label="Motif chapters" done={knowledge.motifKnown} total={knowledge.motifTotal} />
            <Tally label="Recipes" done={knowledge.recipeKnown} total={knowledge.recipeTotal} />
            <Tally label="Furnishing plans" done={knowledge.planKnown} total={knowledge.planTotal} />
          </ul>
          <p className="mt-3 text-[12.5px] text-fg-subtle">Totals across every character.</p>
        </Module>

        <Module title="Outfit styles" href="/party/vault/styles" hrefLabel="Open styles">
          <ul className="space-y-3">
            <Tally label="Unlocked" done={styles.unlocked} total={styles.total} />
          </ul>
        </Module>

        <Module title="Houses" href="/party/vault/houses" hrefLabel="Open houses">
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
