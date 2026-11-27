import type { ReactNode } from "react";

/**
 * A Party page title. Kept to one short line so the data starts high on the
 * screen; the lead sits beside the title on wide screens.
 */
export function PageHead({ title, lead, action }: { title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-[28px] leading-tight text-fg">{title}</h1>
        {lead ? <p className="max-w-[80ch] text-[13px] text-fg-muted">{lead}</p> : null}
      </div>
      {action}
    </header>
  );
}
