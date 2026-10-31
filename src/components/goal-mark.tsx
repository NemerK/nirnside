import { Check, Minus } from "lucide-react";
import type { GoalMarkView } from "@/lib/goals/views";

/** One character's mark against a target. "—" means it can never apply here. */
export function GoalMark({ mark }: { mark: GoalMarkView }) {
  if (mark.state === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent">
        <Check className="h-3.5 w-3.5" /> {mark.label}
      </span>
    );
  }
  if (mark.state === "short") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
        <Minus className="h-3.5 w-3.5" /> {mark.label}
      </span>
    );
  }
  if (mark.state === "notapplicable") {
    return (
      <span
        className="text-xs text-fg-subtle/60"
        title={mark.reason ? `Not applicable — ${mark.reason}` : "Not applicable"}
      >
        —
      </span>
    );
  }
  return <span className="text-xs text-fg-subtle">{mark.label}</span>;
}
