"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classColor } from "@/lib/classes";
import { CHARACTER_SECTIONS } from "@/lib/party/sections";
import { CharacterSwitcher } from "./character-switcher";
import { usePartyMembers } from "./party-shell";

/**
 * The top of every character page: who it is (with a switcher to anyone
 * else), and that character's sections. Switching keeps the section.
 */
export function CharacterBar({ id }: { id: string }) {
  const members = usePartyMembers();
  const pathname = usePathname();
  const router = useRouter();
  const base = `/party/c/${encodeURIComponent(id)}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const section = rest.replace(/^\//, "").split("/")[0] ?? "";
  const index = members.findIndex((m) => m.id === id);
  const current = index >= 0 ? members[index] : null;
  const hrefFor = (m: { id: string }) => `/party/c/${encodeURIComponent(m.id)}${rest}`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "[" && e.key !== "]") return;
      if (e.metaKey || e.ctrlKey || e.altKey || members.length < 2) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      const by = e.key === "]" ? 1 : -1;
      const next = members[(Math.max(index, 0) + by + members.length) % members.length];
      router.push(`/party/c/${encodeURIComponent(next.id)}${rest}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [members, index, rest, router]);

  const step = (by: number) => members[(Math.max(index, 0) + by + members.length) % members.length];
  const color = classColor(current?.className ?? "") ?? "var(--accent)";

  return (
    <div className="-mx-4 -mt-5 mb-5 border-b border-border/70 bg-bg/60 px-4 pt-3 backdrop-blur-md md:-mx-8 md:px-8" style={{ ["--hero" as string]: color }}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/party/characters" className="mr-1 text-[13px] text-fg-subtle hover:text-fg">
          Roster
        </Link>
        <span className="text-fg-subtle" aria-hidden>
          /
        </span>
        {members.length > 1 ? (
          <Link
            href={hrefFor(step(-1))}
            aria-label="Previous character"
            title="Previous character  [ "
            className="flex h-8 w-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface hover:text-fg"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : null}
        <CharacterSwitcher members={members} current={current} hrefFor={hrefFor} />
        {members.length > 1 ? (
          <Link
            href={hrefFor(step(1))}
            aria-label="Next character"
            title="Next character  ] "
            className="flex h-8 w-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface hover:text-fg"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      <nav aria-label="Character sections" className="mt-2 flex gap-1 overflow-x-auto">
        {CHARACTER_SECTIONS.map((s) => {
          const on = section === s.id;
          return (
            <Link
              key={s.id || "overview"}
              href={s.id ? `${base}/${s.id}` : base}
              aria-current={on ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-[13px] transition-colors ${
                on ? "border-[color:var(--hero)] text-fg" : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
