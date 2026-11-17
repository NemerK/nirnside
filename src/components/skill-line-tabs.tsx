"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "line", label: "Skill line" },
  { id: "roster", label: "Roster" },
] as const;

export type SkillLineTabId = (typeof TABS)[number]["id"];

function writeTab(id: SkillLineTabId) {
  const url = new URL(window.location.href);
  if (id === "line") url.searchParams.delete("tab");
  else url.searchParams.set("tab", id);
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(null, "", next);
  }
}

/** The skill line and the account roster each stay on their own pane. */
export function SkillLineTabs({
  initial = "line",
  line,
  roster,
}: {
  initial?: SkillLineTabId;
  line: ReactNode;
  roster: ReactNode;
}) {
  const [tab, setTab] = useState<SkillLineTabId>(initial);
  const panels: Record<SkillLineTabId, ReactNode> = { line, roster };

  return (
    <div>
      <div role="tablist" aria-label="Skill line" className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`skill-line-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`skill-line-panel-${item.id}`}
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
      {TABS.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`skill-line-panel-${item.id}`}
          aria-labelledby={`skill-line-tab-${item.id}`}
          hidden={tab !== item.id}
        >
          {panels[item.id]}
        </div>
      ))}
    </div>
  );
}
