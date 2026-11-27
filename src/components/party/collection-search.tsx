"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

/**
 * Search that lives in the URL, so the server can look through every
 * category and open the one the set is in. Typing waits a moment before it
 * asks; clearing goes back to the category you were on.
 */
export function CollectionSearch({ placeholder, initial }: { placeholder: string; initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Follow the URL when it changes from elsewhere (a category link clears the
  // search), but not while it is catching up with what is being typed.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    if (initial !== value.trim()) setValue(initial);
  }

  function push(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next.trim()) sp.set("q", next.trim());
    else sp.delete("q");
    sp.delete("page");
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  function change(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push(next), 250);
  }

  return (
    <div className="relative min-w-[200px] flex-1">
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-fg-subtle" />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      )}
      <input
        value={value}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") push(value);
          if (e.key === "Escape") change("");
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-8 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => change("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-subtle hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
