import type { ReactNode } from "react";
import { parseEsoMarkup } from "@/lib/text/eso-markup";

/** In-game tooltip text, with `|c` colors as real color instead of raw codes. */
export function EsoText({ text, className = "" }: { text: string; className?: string }): ReactNode {
  const runs = parseEsoMarkup(text);
  if (runs.length === 0) return null;
  return (
    <span className={`whitespace-pre-line ${className}`}>
      {runs.map((run, i) =>
        run.color ? (
          <span key={i} style={{ color: run.color }}>
            {run.text}
          </span>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </span>
  );
}
