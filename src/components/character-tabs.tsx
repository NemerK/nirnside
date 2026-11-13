"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "equipped", label: "Equipped" },
  { id: "targets", label: "Targets" },
  { id: "scripts", label: "Scripts" },
  { id: "cp", label: "Champion Points" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Overview, equipped, targets, scripts, and champion points each stay on their own pane. */
export function CharacterTabs({
  overview,
  equipped,
  targets,
  scripts,
  champion,
}: {
  overview: ReactNode;
  equipped: ReactNode;
  targets: ReactNode;
  scripts: ReactNode;
  champion: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  const panels: Record<TabId, ReactNode> = { overview, equipped, targets, scripts, cp: champion };

  return (
    <div>
      <div role="tablist" aria-label="Character" className="mb-4 flex gap-1 border-b border-border">
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
      {TABS.map((item) => (
        <div key={item.id} role="tabpanel" hidden={tab !== item.id}>
          {panels[item.id]}
        </div>
      ))}
    </div>
  );
}
