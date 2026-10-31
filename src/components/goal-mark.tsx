import { Check, Minus } from "lucide-react";
import type { Goal, LineProgress } from "@/lib/goals/types";
import { progressLabel } from "@/lib/goals/progress";

/** One character's mark against a target. "—" means it can never apply here. */
export function GoalMark({ progress, goal }: { progress: LineProgress; goal: Goal }) {
  const label = progressLabel(progress, { targetRank: goal.targetRank, domain: goal.domain });
  if (progress.state === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent">
        <Check className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  if (progress.state === "short") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
        <Minus className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  if (progress.state === "notapplicable") {
    return (
      <span className="text-xs text-fg-subtle/60" title={progress.reason ? `Not applicable — ${progress.reason}` : "Not applicable"}>
        —
      </span>
    );
  }
  return <span className="text-xs text-fg-subtle">{label}</span>;
}
