import type { ReactNode } from "react";

/** A Party page title with a one-line purpose and an optional action. */
export function PageHead({ title, lead, action }: { title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[46px] leading-[1.02] text-fg">{title}</h1>
        {lead ? <p className="mt-2 max-w-[70ch] text-[15px] text-fg-muted">{lead}</p> : null}
      </div>
      {action}
    </header>
  );
}
