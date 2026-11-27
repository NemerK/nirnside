"use client";

import { useEffect, useState } from "react";

function parts(seconds: number): { h: number; m: number } {
  const s = Math.max(0, seconds);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) };
}

/** Time until the daily reset, ticking once a minute. */
export function ResetCountdown({
  resetAt,
  resetHourUtc,
  compact = false,
}: {
  resetAt: number;
  resetHourUtc: number;
  /** One short line, for a card header. */
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = resetAt - now;
  const { h, m } = parts(left);
  if (compact) {
    return (
      <span className="text-[12px] tabular-nums text-fg-muted" aria-live="polite" title={`Daily reset at ${String(resetHourUtc).padStart(2, "0")}:00 UTC`}>
        {left <= 0 ? "Reset now" : `Reset in ${h}h ${String(m).padStart(2, "0")}m`}
      </span>
    );
  }
  return (
    <div className="sm:text-right" aria-live="polite">
      <p className="font-display text-[44px] font-semibold leading-none tabular-nums text-fg">
        {left <= 0 ? (
          "Reset"
        ) : (
          <>
            {h}
            <span className="text-[26px] text-fg-subtle">h</span> {String(m).padStart(2, "0")}
            <span className="text-[26px] text-fg-subtle">m</span>
          </>
        )}
      </p>
      <p className="mt-1.5 text-[13px] text-fg-muted">
        until the daily reset at {String(resetHourUtc).padStart(2, "0")}:00 UTC
      </p>
    </div>
  );
}
