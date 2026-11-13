import Link from "next/link";

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
}

/** The scripts this character knows, split into the three scribing slots. */
export function CharacterScripts({ scripts }: { scripts: CharacterScript[] }) {
  if (scripts.length === 0) {
    return <p className="text-sm text-fg-muted">No scribing scripts captured for this character yet.</p>;
  }

  const other = scripts.filter((script) => script.slot == null);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-fg-muted">
          <span className="font-semibold tabular-nums text-fg">{scripts.length}</span> known
        </p>
        <Link href="/encyclopedia/scribing" className="text-xs text-accent hover:underline">
          Combinations
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {SLOTS.map((slot) => {
          const list = scripts
            .filter((script) => script.slot === slot.id)
            .sort((a, b) => a.name.localeCompare(b.name));
          return (
            <section key={slot.id} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div
                className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2"
                style={{ borderTop: `2px solid ${slot.edge}` }}
              >
                <h2 className="text-sm font-medium text-fg">{slot.label}</h2>
                <span className="text-xs tabular-nums text-fg-subtle">{list.length}</span>
              </div>
              {list.length > 0 ? (
                <ul className="divide-y divide-border">
                  {list.map((script) => (
                    <li key={script.name} className="px-3 py-1.5" title={script.effect || undefined}>
                      <span className="block truncate text-sm text-fg">{script.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-xs text-fg-subtle">None known</p>
              )}
            </section>
          );
        })}
      </div>
      {other.length > 0 ? (
        <section className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
            <h2 className="text-sm font-medium text-fg">Unsorted</h2>
            <span className="text-xs tabular-nums text-fg-subtle">{other.length}</span>
          </div>
          <ul className="divide-y divide-border">
            {other.map((script) => (
              <li key={script.name} className="px-3 py-1.5 text-sm text-fg">
                {script.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
