"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Set and trait for "Who can craft it?". Choosing one updates the grid straight away. */
export function CraftCheckControls({
  sets,
  set,
  traits,
  trait,
}: {
  sets: { name: string; traitsNeeded: number | null }[];
  set: string;
  traits: string[];
  trait: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function change(key: "set" | "trait", value: string) {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  // Grouped by how many traits they need, the way crafters think about them.
  const byTraits = new Map<number, string[]>();
  for (const s of sets) {
    const n = s.traitsNeeded ?? 0;
    byTraits.set(n, [...(byTraits.get(n) ?? []), s.name]);
  }
  const groups = [...byTraits.entries()].sort((a, b) => a[0] - b[0]);

  const select = "rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px] text-fg focus:border-accent focus:outline-none";
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[12.5px] text-fg-subtle">Crafted set</span>
        <select value={set} onChange={(e) => change("set", e.target.value)} className={select}>
          {groups.map(([n, names]) => (
            <optgroup key={n} label={n ? `${n} traits` : "Traits not known"}>
              {names.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[12.5px] text-fg-subtle">With trait</span>
        <select value={trait} onChange={(e) => change("trait", e.target.value)} className={select}>
          <option value="">Any trait</option>
          {traits.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {pending ? <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-fg-subtle" aria-label="Updating" /> : null}
    </div>
  );
}
