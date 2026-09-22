"use client";

import { useState } from "react";
import { parseEsoMarkup, type EsoIcon } from "@/lib/text/eso-markup";

function TooltipIcon({ icon }: { icon: EsoIcon }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/icon?p=${encodeURIComponent(icon.path)}`}
      alt=""
      width={16}
      height={16}
      onError={() => setFailed(true)}
      className="rounded-sm"
      style={{
        display: "inline-block",
        width: "1em",
        height: "1em",
        margin: "0 0.15em",
        verticalAlign: "-0.15em",
      }}
    />
  );
}

/** In-game tooltip text: `|c` colors and `|t` icons, not raw codes. */
export function EsoText({ text, className = "" }: { text: string; className?: string }) {
  const runs = parseEsoMarkup(text);
  if (runs.length === 0) return null;
  return (
    <span className={`whitespace-pre-line ${className}`}>
      {runs.map((run, i) => {
        if (run.icon) return <TooltipIcon key={i} icon={run.icon} />;
        if (run.color) {
          return (
            <span key={i} style={{ color: run.color }}>
              {run.text}
            </span>
          );
        }
        return <span key={i}>{run.text}</span>;
      })}
    </span>
  );
}
