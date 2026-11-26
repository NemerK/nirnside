import Link from "next/link";
import type { ReactNode } from "react";

/** One module on a Party page: a title, an optional way into its full page, then its summary. */
export function Module({
  title,
  href,
  hrefLabel = "Open",
  className = "",
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`party-module flex min-w-0 flex-col px-5 pb-5 pt-4 ${className}`}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[22px] leading-tight text-fg">{title}</h2>
        {href ? (
          <Link href={href} className="shrink-0 text-[13px] text-accent hover:underline">
            {hrefLabel}
          </Link>
        ) : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

/** A thin progress bar. Gold while short, green when complete. */
export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const done = max > 0 && value >= max;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-meter-track" aria-hidden>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color ?? (done ? "var(--ok)" : "var(--meter)") }}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-fg-subtle">{children}</p>;
}
