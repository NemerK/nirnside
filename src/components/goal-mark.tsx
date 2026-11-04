import { Check, Minus } from "lucide-react";
import { goalBarSegments } from "@/lib/goals/bar";
import type { GoalMarkView } from "@/lib/goals/views";

/** The rank itself, drawn as a bar. Gold is the mandatory rank. Blue is extra above it. */
export function GoalRankBar({ mark, compact = false }: { mark: GoalMarkView; compact?: boolean }) {
  const segments = goalBarSegments(mark);
  const height = compact ? "h-3" : "h-6";
  return (
    <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
      <div
        className={`relative ${height} min-w-[6rem] flex-1 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-border`}
        role="meter"
        aria-label={mark.label}
        aria-valuemin={0}
        aria-valuemax={mark.scale ?? 0}
        aria-valuenow={mark.rank ?? 0}
        aria-valuetext={mark.label}
      >
        {segments && segments.gold > 0 && (
          <div
            className="absolute inset-y-0 left-0"
            style={{ width: `${segments.gold * 100}%`, background: "var(--rank-mandatory)" }}
          />
        )}
        {segments && segments.blue > 0 && (
          <div
            className="absolute inset-y-0"
            style={{
              left: `${segments.split * 100}%`,
              width: `${segments.blue * 100}%`,
              background: "var(--rank-extra)",
            }}
          />
        )}
      </div>
      <span className={`shrink-0 text-right tabular-nums text-fg ${compact ? "text-xs" : "min-w-[8.5rem] text-sm"}`}>
        {mark.label}
      </span>
    </div>
  );
}

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
