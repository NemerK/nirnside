"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { GameIcon } from "@/components/game-icon";
import { Badge } from "@/components/ui";
import { TIER_LABEL, type GoalTier } from "@/lib/goals/types";
import {
  skillsForLinePlan,
  type AbilityPlan,
  type LineSkillView,
} from "@/lib/planner/line-plan";

export interface LinePlanBook {
  maxRank: number | null;
  skills: LineSkillView[];
}

/** Opens the planned skills for one skill-line target. */
export function LinePlanButton({
  title,
  lineName,
  mandatoryRank,
  tier,
  book,
  plans,
}: {
  title: string;
  lineName: string;
  mandatoryRank: number;
  tier: GoalTier;
  book: LinePlanBook | undefined;
  plans: AbilityPlan[];
}) {
  const [open, setOpen] = useState(false);
  const maxRank = book?.maxRank ?? null;
  const result = skillsForLinePlan({
    skills: book?.skills ?? [],
    plans,
    lineName,
    mandatoryRank,
    maxRank,
    tier,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left text-sm font-medium text-fg hover:text-accent"
      >
        {title}
      </button>
      {open ? (
        <Modal title={lineName} onClose={() => setOpen(false)} maxWidthClass="max-w-md">
          <p className="mb-3 text-sm text-fg-muted">
            {result.implied
              ? `Mandatory rank is ${mandatoryRank}, the maximum for this line. Every skill counts as mandatory.`
              : result.skills.length > 0
                ? "Planned skills"
                : maxRank != null
                  ? `No skills planned. Mandatory rank is ${mandatoryRank} of ${maxRank}.`
                  : "No skills planned for this line."}
          </p>
          {result.skills.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {result.skills.map((skill) => (
                <li key={skill.name} className="flex items-center gap-2 px-3 py-1.5">
                  <GameIcon name={skill.name} icon={skill.icon} size={28} bare />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{skill.name}</span>
                  {skill.passive ? <span className="text-[10px] uppercase tracking-wide text-fg-subtle">Passive</span> : null}
                  <Badge tone={skill.tier === "essential" ? "accent" : "muted"}>{TIER_LABEL[skill.tier]}</Badge>
                  {skill.purchased === false ? <span className="text-[11px] text-fg-subtle">Not purchased</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
