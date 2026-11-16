"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "equipped", label: "Equipped" },
  { id: "setups", label: "Setups" },
  { id: "targets", label: "Targets" },
  { id: "scripts", label: "Scripts" },
  { id: "cp", label: "Champion Points" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Each part of the character sheet stays on its own pane. */
export function CharacterTabs({
  overview,
  equipped,
  setups,
  targets,
  scripts,
  champion,
}: {
  overview: ReactNode;
  equipped: ReactNode;
  setups: ReactNode;
  targets: ReactNode;
  scripts: ReactNode;
  champion: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("overview");
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
              onClick={() => setTab(item.id)}
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
