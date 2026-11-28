import { EsoText } from "@/components/eso-text";
import { GameIcon } from "@/components/game-icon";
import { HoverTip } from "@/components/party/hover-tip";
import { findStat, type StatsReading, type StatValue } from "@/lib/game/stats";
import type { CharacterReading } from "@/lib/game/understand";

/**
 * The character sheet as the game's Stats window showed it at the last save,
 * and the skills slotted on each bar. Every number and name is the game's
 * (readCharacter → readStats); nothing here works a value out.
 */

/** The three pools, each with its recovery, as the Stats window pairs them. */
const POOLS = [
  { max: "magicka_max", regen: "magicka_regen_combat" },
  { max: "health_max", regen: "health_regen_combat" },
  { max: "stamina_max", regen: "stamina_regen_combat" },
] as const;

/** Advanced Stats people look for first, by the game's constant name. */
const HEADLINE_ADVANCED = ["critical_chance", "critical_damage"] as const;

function Value({ s, big = false }: { s: StatValue; big?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[12px] text-fg-subtle">{s.label}</dt>
      <dd className={`tabular-nums text-fg ${big ? "font-display text-[22px] leading-tight" : "text-[14px]"}`}>{s.text}</dd>
    </div>
  );
}

function Stats({ stats }: { stats: StatsReading }) {
  const poolKeys = new Set<string>(POOLS.flatMap((p) => [p.max, p.regen]));
  const pools = POOLS.map((p) => ({ max: findStat(stats, p.max), regen: findStat(stats, p.regen) })).filter((p) => p.max);
  const headline = HEADLINE_ADVANCED.map((k) => findStat(stats, k)).filter((s): s is StatValue => s != null);
  const rest = stats.main.filter((s) => !poolKeys.has(s.key));
  const tile = "rounded-lg border border-border/70 px-3 py-2";
  return (
    <div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {pools.map((p) => (
          <div key={p.max!.key} className={tile}>
            <Value s={p.max!} big />
            {p.regen ? (
              <p className="mt-0.5 text-[12px] text-fg-muted">
                <span className="tabular-nums text-fg">{p.regen.text}</span> recovery
              </p>
            ) : null}
          </div>
        ))}
        {headline.map((s) => (
          <div key={s.key} className={tile}>
            <Value s={s} big />
          </div>
        ))}
      </dl>
      {rest.length > 0 ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
          {rest.map((s) => (
            <Value key={s.key} s={s} />
          ))}
        </dl>
      ) : null}
      {stats.advanced.length > 0 ? (
        <details className="group mt-3">
          <summary className="cursor-pointer select-none text-[12px] text-fg-muted hover:text-fg">
            Advanced stats <span className="text-fg-subtle">({stats.advanced.reduce((n, g) => n + g.stats.length, 0)})</span>
          </summary>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.advanced.map((g) => (
              <section key={g.category}>
                <h3 className="mb-1 border-b border-border pb-1 text-[12px] font-medium text-fg-muted">{g.category}</h3>
                <dl className="space-y-0.5 text-[13px]">
                  {g.stats.map((s) => (
                    <div key={s.key} className="flex justify-between gap-3">
                      <dt className="truncate text-fg-muted">{s.label}</dt>
                      <dd className="shrink-0 tabular-nums text-fg">{s.text}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Bars({ bars }: { bars: NonNullable<CharacterReading["skillBars"]> }) {
  return (
    <div className="space-y-2">
      {bars.map((b) => (
        <div key={b.bar}>
          <p className="mb-1 text-[12px] text-fg-subtle">{b.bar === "front" ? "Front bar" : "Back bar"}</p>
          {b.skills.length === 0 ? (
            <p className="text-[12px] text-fg-subtle">Nothing slotted.</p>
          ) : (
            <ul className="flex gap-1.5">
              {b.skills.map((s) => (
                <li key={s.slot} className={s.ultimate ? "ml-1.5" : undefined}>
                  <HoverTip
                    tip={
                      <>
                        <span className="block font-medium text-fg">{s.name ?? "Unknown skill"}</span>
                        {s.line || s.ultimate ? (
                          <span className="block text-[12px] text-fg-subtle">
                            {[s.ultimate ? "Ultimate" : null, s.line].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                        {s.description ? (
                          <span className="mt-1.5 block text-fg-muted">
                            <EsoText text={s.description} />
                          </span>
                        ) : null}
                      </>
                    }
                  >
                    <span tabIndex={0} className="block cursor-default">
                      <GameIcon name={s.name ?? "?"} icon={s.icon ?? null} size={s.ultimate ? 40 : 36} />
                    </span>
                  </HoverTip>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export function CharacterSheet({ stats, bars }: { stats: StatsReading | null; bars: CharacterReading["skillBars"] }) {
  if (!stats && !bars) {
    return (
      <p className="text-[13px] text-fg-muted">
        Not saved yet. Stats and slotted skills arrive with Snapshot 0.9.46: log in once (or /reloadui) after updating.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_auto]">
      {stats ? <Stats stats={stats} /> : <p className="text-[13px] text-fg-muted">Stats not saved yet.</p>}
      {bars ? (
        <div className="xl:border-l xl:border-border xl:pl-5">
          <Bars bars={bars} />
        </div>
      ) : null}
    </div>
  );
}
