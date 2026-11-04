"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { BookOpen, FlaskConical, ListChecks, ScrollText, Star, Swords, X } from "lucide-react";
import { classIcon } from "@/lib/classes";
import {
  dashboardHref,
  type DashboardSection,
  type DashboardTargetDomain,
} from "@/lib/dashboard/href";
import { GameIcon } from "./game-icon";

const SECTIONS: { id: DashboardSection; label: string; icon: typeof Swords }[] = [
  { id: "skills", label: "Skills", icon: Swords },
  { id: "crafting", label: "Crafting", icon: FlaskConical },
  { id: "scribing", label: "Scribing", icon: ScrollText },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "champion", label: "Champion", icon: Star },
  { id: "targets", label: "Targets", icon: ListChecks },
];

const DOMAINS: { id: DashboardTargetDomain | null; label: string }[] = [
  { id: null, label: "All" },
  { id: "skillline", label: "Skill lines" },
  { id: "ability", label: "Abilities" },
  { id: "script", label: "Scripts" },
];

function ScrollTo({ token, children }: { token: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "start" });
  }, [token]);
  return (
    <section ref={ref} className="mb-4 scroll-mt-2">
      {children}
    </section>
  );
}

/**
 * The opened character. Section chips pick which slice of their snapshot to
 * read; the panel under them is that slice in full.
 */
export function DashboardDetail({
  sort,
  character,
  section,
  domain,
  summaries,
  scanned,
  children,
}: {
  sort: "progress" | "roster";
  character: {
    id: string;
    name: string;
    className: string;
    race: string;
    alliance: string;
    levelLabel: string;
    levelCaption: string;
    roles: string[];
    overall: { pct: number; done: number; total: number } | null;
  };
  section: DashboardSection;
  domain: DashboardTargetDomain | null;
  summaries: Record<DashboardSection, string>;
  scanned: boolean;
  children: ReactNode;
}) {
  return (
    <ScrollTo token={`${character.id}:${section}:${domain ?? ""}`}>
      <div className="overflow-hidden rounded-xl border border-accent/40 bg-surface/80 shadow-[0_0_0_1px_var(--accent-soft)]">
        <div className="flex flex-wrap items-start gap-4 border-b border-border/70 bg-accent-soft/40 px-4 py-4 sm:px-5">
          <GameIcon name={character.className} icon={classIcon(character.className)} size={56} bare lit />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-fg">{character.name}</h2>
                <p className="mt-0.5 truncate text-sm text-fg-muted">
                  {character.race} · {character.className} · {character.alliance}
                </p>
                <p className="mt-1 text-xs text-fg-subtle">
                  {character.levelLabel} {character.levelCaption}
                  {character.roles.length > 0 ? ` · ${character.roles.join(", ")}` : ""}
                  {character.overall
                    ? ` · ${character.overall.done}/${character.overall.total} targets`
                    : ""}
                </p>
              </div>
              <Link
                href={dashboardHref({ sort })}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-fg-muted hover:text-fg"
              >
                <X className="h-3.5 w-3.5" />
                All characters
              </Link>
            </div>
            {!scanned && (
              <p className="mt-2 text-sm text-fg">
                This character hasn&apos;t been snapshotted yet. Log them out, or ReloadUI, and the sections fill from
                the game.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
          {SECTIONS.map((item) => {
            const active = item.id === section;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={dashboardHref({ sort, char: character.id, section: item.id })}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg border px-3 py-2 transition ${
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
                <span className={`mt-1 block truncate text-sm ${active ? "text-fg" : "text-fg"}`}>
                  {summaries[item.id]}
                </span>
              </Link>
            );
          })}
        </div>

        {section === "targets" && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-3">
            {DOMAINS.map((item) => {
              const active = item.id === domain;
              return (
                <Link
                  key={item.label}
                  href={dashboardHref({
                    sort,
                    char: character.id,
                    section: "targets",
                    domain: item.id,
                  })}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-accent/60 bg-accent-soft font-medium text-accent"
                      : "border-border text-fg-muted hover:text-fg"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="border-t border-border/70 px-3 py-4 sm:px-5">{children}</div>
      </div>
    </ScrollTo>
  );
}
