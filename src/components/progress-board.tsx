import Link from "next/link";
import { accountMandatory, type CharacterWorkspaceCard } from "@/lib/characters/workspace";
import { classColor, classIcon } from "@/lib/classes";
import { GameIcon } from "./game-icon";
import { Card } from "./ui";

/**
 * Mandatory completion for the account, with the other tracks kept beside it.
 * Motifs are account-wide: a chapter known on one character is enough.
 */
export function ProgressBoard({
  cards,
  motifs,
}: {
  cards: CharacterWorkspaceCard[];
  motifs: { known: number; total: number };
}) {
  const account = accountMandatory(cards);
  const withGoals = cards.filter((card) => !card.unknown && card.mandatoryTargets.total > 0).length;
  const rows = [...cards].sort(byWork);

  return (
    <div className="space-y-4">
      <Card as="section" className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Mandatory</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums tracking-tight text-fg">
              {account.total > 0 ? `${account.pct}%` : "—"}
            </p>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-fg-muted">
            {account.total > 0 ? (
              <>
                <span className="font-medium text-fg">
                  {account.done} of {account.total}
                </span>{" "}
                essential goals
                {withGoals > 0 ? ` across ${withGoals} ${withGoals === 1 ? "character" : "characters"}` : ""}.
                Optional goals, extra ranks, research, and motifs are listed below and do not move this number.
              </>
            ) : (
              <>
                No essential goals yet.{" "}
                <Link href="/planner" className="text-accent hover:underline">
                  Add them in the Planner
                </Link>{" "}
                and this number starts from those only.
              </>
            )}
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${account.total > 0 ? account.pct : 0}%` }} />
        </div>
        {(account.unknownCount ?? 0) > 0 ? (
          <p className="mt-2 text-xs text-fg-subtle">
            {account.unknownCount} mandatory {account.unknownCount === 1 ? "goal is" : "goals are"} still unknown
            until those characters log out. They are not counted as missing.
          </p>
        ) : null}
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-medium text-fg">Characters</h2>
        <Card className="divide-y divide-border">
          <div className="hidden grid-cols-[minmax(9rem,14rem)_1fr_9.5rem] gap-4 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-fg-subtle sm:grid">
            <span>Character</span>
            <span>Mandatory</span>
            <span>Extra</span>
          </div>
          <ul>
            {rows.map((card) => (
              <li key={card.id}>
                <Link
                  href={`/characters/${encodeURIComponent(card.id)}`}
                  className="grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70 sm:grid-cols-[minmax(9rem,14rem)_1fr_9.5rem] sm:items-center"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <GameIcon name={card.className} icon={classIcon(card.className)} size={28} bare />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-fg">{card.name}</span>
                      <span className="block truncate text-xs" style={{ color: classColor(card.className) }}>
                        {card.className}
                      </span>
                    </span>
                  </span>
                  <CharacterMandatory card={card} />
                  <span className="text-xs text-fg-muted">
                    <span className="mb-0.5 block text-[11px] uppercase tracking-wide text-fg-subtle sm:hidden">
                      Extra
                    </span>
                    {beside(card)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <p className="mt-2 text-xs text-fg-subtle">
          Research stays on the character who is doing it. It is not part of the percentage.
        </p>
      </section>

      <Card as="section" className="px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-fg">Motifs, once per account</h2>
          <Link href="/knowledge?tab=motifs" className="text-xs text-accent hover:underline">
            Chapters
          </Link>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">
          A chapter counts when any character knows it. Learning the same chapter on another character does not raise
          this.
        </p>
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-fg-subtle">Chapters</span>
            <span className="tabular-nums text-fg">
              {motifs.total > 0 ? `${motifs.known}/${motifs.total} · ${Math.round((motifs.known / motifs.total) * 100)}%` : "Not scanned"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${motifs.total > 0 ? Math.round((motifs.known / motifs.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function CharacterMandatory({ card }: { card: CharacterWorkspaceCard }) {
  const tally = card.mandatoryTargets;
  const pct = card.unknown || tally.total <= 0 ? 0 : tally.pct;
  const label = card.unknown
    ? "Not scanned"
    : tally.total > 0
      ? `${tally.done}/${tally.total} · ${pct}%`
      : "None set";
  return (
    <span className="block min-w-0">
      <span className="mb-1 flex items-baseline justify-between gap-3 text-xs">
        <span className="text-fg-subtle sm:hidden">Mandatory</span>
        <span className="tabular-nums text-fg sm:ml-auto">{label}</span>
      </span>
      {tally.total > 0 ? (
        <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      {card.research.total > 0 ? (
        <span className="mt-1 block text-[11px] tabular-nums text-fg-subtle">
          Research {card.research.done}/{card.research.total}
        </span>
      ) : null}
      {(tally.unknownCount ?? 0) > 0 ? (
        <span className="mt-1 block text-[11px] text-fg-subtle">
          {tally.unknownCount} still unknown
        </span>
      ) : null}
    </span>
  );
}

function beside(card: CharacterWorkspaceCard): string {
  if (card.unknown) return "—";
  if (card.beyond.total <= 0) return "No extra goals";
  return `${card.beyond.done}/${card.beyond.total}`;
}

function byWork(a: CharacterWorkspaceCard, b: CharacterWorkspaceCard): number {
  const rank = (card: CharacterWorkspaceCard) => {
    if (card.unknown) return 2;
    if (card.mandatoryTargets.total <= 0) return 1;
    return 0;
  };
  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  if (a.mandatoryTargets.pct !== b.mandatoryTargets.pct) return a.mandatoryTargets.pct - b.mandatoryTargets.pct;
  return a.name.localeCompare(b.name);
}
