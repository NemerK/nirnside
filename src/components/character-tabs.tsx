"use client";

import { useState, type ReactNode } from "react";
import { type CharacterTabId } from "@/lib/characters/sheet-tab";

const TABS: { id: CharacterTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "equipped", label: "Equipped" },
  { id: "setups", label: "Setups" },
  { id: "targets", label: "Targets" },
  { id: "scripts", label: "Scripts" },
  { id: "cp", label: "Champion Points" },
];

type TabId = CharacterTabId;

function writeTab(id: TabId) {
  const url = new URL(window.location.href);
  if (id === "overview") url.searchParams.delete("tab");
  else url.searchParams.set("tab", id);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(null, "", next);
  }
}

/** Each part of the character sheet stays on its own pane. */
export function CharacterTabs({
  initialTab = "overview",
  overview,
  equipped,
  setups,
  targets,
  scripts,
  champion,
}: {
  initialTab?: TabId;
  overview: ReactNode;
  equipped: ReactNode;
  setups: ReactNode;
  targets: ReactNode;
  scripts: ReactNode;
  champion: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const panels: Record<TabId, ReactNode> = { overview, equipped, setups, targets, scripts, cp: champion };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Character" className="mb-3 flex shrink-0 flex-wrap gap-1 border-b border-border">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setTab(item.id);
                writeTab(item.id);
              }}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                selected ? "border-accent font-medium text-fg" : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        {TABS.map((item) => (
          <div
            key={item.id}
            role="tabpanel"
            hidden={tab !== item.id}
            className="h-full min-h-0 overflow-y-auto"
          >
            {panels[item.id]}
          </div>
        ))}
      </div>
    </div>
  );
}
