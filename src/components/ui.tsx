import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <As className={`rounded-xl border border-border bg-surface/70 ${className}`}>{children}</As>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{children}</h2>
  );
}

export function Badge({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "ok" | "danger" | "muted";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "border-border text-fg-muted",
    accent: "border-accent/40 bg-accent-soft text-accent",
    ok: "border-ok/40 text-ok",
    danger: "border-danger/40 text-danger",
    muted: "border-border text-fg-subtle",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="text-fg-subtle">{icon}</div>}
      <h3 className="text-lg font-medium text-fg">{title}</h3>
      {children && <div className="max-w-md text-sm text-fg-muted">{children}</div>}
    </Card>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-fg-subtle">{label}</div>
      <div className="mt-1 text-xl font-semibold text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-fg-muted">{hint}</div>}
    </Card>
  );
}

export function TileLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-border bg-surface/70 p-5 transition-colors hover:border-accent/50 hover:bg-surface-2"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-fg group-hover:text-accent">{title}</span>
        <span className="mt-0.5 block text-sm text-fg-muted">{description}</span>
      </span>
    </Link>
  );
}
