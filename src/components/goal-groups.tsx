"use client";

import type { ReactNode } from "react";
import { classIcon } from "@/lib/classes";
import type { GoalGroup } from "@/lib/planner/goal-groups";
import { GameIcon } from "./game-icon";

/** Category, then class, then skill line. Class crests mark a class group. */
export function GroupedTargets<T>({
  groups,
  getKey,
  renderItem,
}: {
  groups: GoalGroup<T>[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  if (groups.length === 0) return null;
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const crest = group.className ? classIcon(group.className) : undefined;
        return (
          <section key={group.key}>
            <div className="mb-2 flex items-center gap-2">
              {crest ? <GameIcon name={group.title} icon={crest} size={18} bare /> : null}
              <h3 className="text-sm font-medium text-fg">{group.title}</h3>
            </div>
            <div className="space-y-2">
              {group.sections.map((section) => (
                <div key={section.key} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <div className="border-b border-border bg-surface-2/70 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                    {section.title}
                  </div>
                  <div className="divide-y divide-border">{section.items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
