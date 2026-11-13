import Link from "next/link";
import { Check } from "lucide-react";

const SLOTS = [
  { id: "focus", label: "Focus", edge: "#6aa8e0" },
  { id: "signature", label: "Signature", edge: "#d8b13a" },
  { id: "affix", label: "Affix", edge: "#b48ad8" },
] as const;

type SlotId = (typeof SLOTS)[number]["id"];

export interface CharacterScript {
  name: string;
  slot: SlotId | null;
  effect: string;
  known: boolean;
}

/** Every catalog script, with a check on the ones this character has learned. */
export function CharacterScripts({ scripts }: { scripts: CharacterScript[] }) {
  const placed = scripts.filter((script) => script.slot != null);
  const other = scripts.filter((script) => script.slot == null);

  if (placed.length === 0 && other.length === 0) {
    return <p className="text-sm text-fg-muted">No scribing scripts in the catalog yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link href="/encyclopedia/scribing" className="text-xs text-accent hover:underline">
          Combinations
        </Link>
      </div>
      {placed.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {SLOTS.map((slot) => {
            const list = placed
              .filter((script) => script.slot === slot.id)
              .sort((a, b) => a.name.localeCompare(b.name));
            const learned = list.filter((script) => script.known).length;
            return (
              <section key={slot.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                <div
                  className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2"
                  style={{ borderTop: `2px solid ${slot.edge}` }}
                >
                  <h2 className="text-sm font-medium text-fg">{slot.label}</h2>
                  <span className="text-xs tabular-nums text-fg-subtle">
                    {learned}/{list.length}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {list.map((script) => (
                    <li key={script.name} className="flex items-center justify-between gap-2 px-3 py-1.5" title={script.effect || undefined}>
                      <span className={`min-w-0 truncate text-sm ${script.known ? "text-fg" : "text-fg-subtle"}`}>
                        {script.name}
                      </span>
                      {script.known ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-ok" aria-label="Learned" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
      {other.length > 0 ? (
        <section className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
            <h2 className="text-sm font-medium text-fg">Unsorted</h2>
            <span className="text-xs tabular-nums text-fg-subtle">{other.length}</span>
          </div>
          <ul className="divide-y divide-border">
            {other.map((script) => (
              <li key={script.name} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0 truncate text-sm text-fg">{script.name}</span>
                <Check className="h-3.5 w-3.5 shrink-0 text-ok" aria-label="Learned" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
