import { Bar } from "@/components/party/module";
import { SKYSHARDS_PER_POINT } from "@/lib/game/skills";
import type { CharacterReading } from "@/lib/game/understand";
import { formatTimeLeft } from "@/lib/today/present";

/**
 * What the character had on them at the last save: running effects, riding
 * training, unspent skill points and backpack space. Every value is read by
 * the game model (readCharacter) and counted down from the save.
 */
export function CharacterStatus({ reading }: { reading: CharacterReading }) {
  const timed = reading.buffs.filter((b) => !b.mundus && b.remaining != null);
  const lasting = reading.buffs.filter((b) => !b.mundus && b.remaining == null);
  const riding = reading.riding;
  const bag = reading.backpack;
  const tile = "min-w-0 rounded-lg border border-border/70 px-3 py-2.5";
  const head = "mb-1.5 text-[12px] text-fg-subtle";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className={tile}>
        <p className={head}>Running effects</p>
        {timed.length === 0 ? (
          <p className="text-[13px] text-fg-muted">{reading.buffs.length === 0 ? "None saved yet." : "Nothing on a timer."}</p>
        ) : (
          <ul className="space-y-1 text-[13px]">
            {timed.map((b) => (
              <li key={b.name} className="flex items-baseline justify-between gap-3">
                <span className={`truncate ${b.expired ? "text-fg-subtle line-through" : "text-fg"}`}>{b.name}</span>
                <span className={`shrink-0 tabular-nums ${b.expired ? "text-fg-subtle" : "text-fg-muted"}`}>
                  {b.expired ? "ran out" : formatTimeLeft(b.remaining)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {lasting.length > 0 ? (
          <p className="mt-1.5 truncate text-[12px] text-fg-subtle" title={lasting.map((b) => b.name).join(", ")}>
            Always on: {lasting.map((b) => b.name).join(", ")}
          </p>
        ) : null}
      </div>

      <div className={tile}>
        <p className={head}>Riding</p>
        {!riding ? (
          <p className="text-[13px] text-fg-muted">Not saved yet.</p>
        ) : riding.complete ? (
          <p className="text-[13px] text-fg">
            Fully trained <span className="text-fg-muted">· speed, stamina and carrying at {riding.speed.max}</span>
          </p>
        ) : (
          <>
            <ul className="space-y-1.5 text-[13px]">
              {(
                [
                  ["Speed", riding.speed],
                  ["Stamina", riding.stamina],
                  ["Carrying", riding.capacity],
                ] as const
              ).map(([label, s]) => (
                <li key={label}>
                  <div className="flex justify-between">
                    <span className="text-fg-muted">{label}</span>
                    <span className="tabular-nums text-fg">
                      {s.now}
                      {s.max != null ? <span className="text-fg-subtle">/{s.max}</span> : null}
                    </span>
                  </div>
                  {s.max != null ? <Bar value={s.now} max={s.max} /> : null}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12px] text-fg-muted">
              {riding.lessonReady
                ? "Lesson ready at a stablemaster"
                : riding.lessonIn != null
                  ? `Next lesson in ${formatTimeLeft(riding.lessonIn)}`
                  : "Next lesson time not saved"}
            </p>
          </>
        )}
      </div>

      <div className={tile}>
        <p className={head}>Skill points</p>
        {reading.skillPoints == null ? (
          <p className="text-[13px] text-fg-muted">Not saved yet.</p>
        ) : (
          <p className="font-display text-[24px] leading-none tabular-nums text-fg">
            {reading.skillPoints}
            <span className="ml-1.5 font-sans text-[13px] text-fg-muted">unspent</span>
          </p>
        )}
        {reading.skyshards != null ? (
          <p className="mt-1.5 text-[12px] text-fg-muted">
            Skyshards: {reading.skyshards} of {SKYSHARDS_PER_POINT} toward the next point
          </p>
        ) : null}
      </div>

      <div className={tile}>
        <p className={head}>Backpack</p>
        {!bag ? (
          <p className="text-[13px] text-fg-muted">Not saved yet.</p>
        ) : (
          <>
            <p className="text-[13px] text-fg">
              <span className="font-display text-[24px] leading-none tabular-nums">{bag.used}</span>
              <span className="text-fg-muted"> of {bag.size} slots</span>
            </p>
            <div className="mt-1.5">
              <Bar value={bag.used} max={bag.size} color="var(--meter)" />
            </div>
            <p className="mt-1.5 text-[12px] text-fg-muted">
              {bag.size - bag.used === 0 ? "Full" : `${bag.size - bag.used} free`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
