import type { ReactNode } from "react";
import Link from "next/link";

/** Atlas page chrome — quiet headings, same type as the rest of the app. */
export function AtlasPage({
  grain,
  title,
  subtitle,
  action,
  children,
}: {
  grain: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="atlas-page mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col">
      <header className="mb-6 shrink-0">
        <p className="mb-1 text-xs font-medium text-fg-subtle">{grain}</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-2xl text-sm text-fg-muted">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function AtlasPanel({
  children,
  className = "",
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return <As className={`atlas-panel ${className}`}>{children}</As>;
}

export function AtlasStat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-medium text-fg-subtle">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-fg tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="atlas-stat block transition hover:border-accent/50">
        {inner}
      </Link>
    );
  }
  return <div className="atlas-stat">{inner}</div>;
}

export function AtlasMeter({
  label,
  done,
  total,
  unknown,
}: {
  label: string;
  done: number;
  total: number;
  unknown?: boolean;
}) {
  const pct = unknown || total <= 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-fg-subtle">{label}</span>
        <span className="tabular-nums text-fg-muted">
          {unknown ? "?" : total > 0 ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all ${unknown ? "bg-border-strong" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AtlasEmpty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <AtlasPanel className="px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      {children ? <div className="mx-auto mt-3 max-w-md text-sm text-fg-muted">{children}</div> : null}
    </AtlasPanel>
  );
}
