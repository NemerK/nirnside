import Link from "next/link";
import { Check } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { plannerScriptIcon } from "@/lib/icons/planner-icons";

const SLOTS = [
  { id: "focus", label: "Focus", edge: "#6aa8e0" },
  { id: "signature", label: "Signature", edge: "#d8b13a" },
  { id: "affix", label: "Affix", edge: "#b48ad8" },
] as const;

type SlotId = (typeof SLOTS)[number]["id"];

export interface CharacterScript {
  name: string;
  slot: SlotId;
  effect: string;
  known: boolean;
  /** Scanned GetCraftedAbilityScriptIcon, when the catalog has one. */
  icon?: string | null;
}

/** Every catalog script, with a check on the ones this character has learned. */
export function CharacterScripts({ scripts }: { scripts: CharacterScript[] }) {
  if (scripts.length === 0) {
    return <p className="text-sm text-fg-muted">No scribing scripts in the catalog yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link href="/encyclopedia/scribing" className="text-xs text-accent hover:underline">
          Combinations
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {SLOTS.map((slot) => {
          const list = scripts
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
                  <li key={script.name} className="flex items-center gap-2 px-3 py-1.5" title={script.effect || undefined}>
                    <GameIcon name={script.name} icon={script.icon ?? plannerScriptIcon(script.name)} size={22} bare />
                    <span className={`min-w-0 flex-1 truncate text-sm ${script.known ? "text-fg" : "text-fg-subtle"}`}>
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
    </div>
  );
}
