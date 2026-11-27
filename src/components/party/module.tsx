import Link from "next/link";
import type { ReactNode } from "react";

/** One module on a Party page: a title, an optional way into its full page, then its summary. */
export function Module({
  title,
  href,
  hrefLabel = "Open",
  meta,
  className = "",
  children,
}: {
  title: string;
  /** The module's full page. The title links there too. */
  href?: string;
  hrefLabel?: string;
  /** A short fact beside the title ("12 of 45 maxed"). */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`party-module flex min-w-0 flex-col px-4 pb-4 pt-3 ${className}`}>
      <header className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="flex min-w-0 items-baseline gap-2 font-display text-[18px] leading-tight text-fg">
          {href ? (
            <Link href={href} className="hover:text-accent">
              {title}
            </Link>
          ) : (
            title
          )}
          {meta ? <span className="truncate font-sans text-[12px] text-fg-subtle">{meta}</span> : null}
        </h2>
        {href ? (
          <Link href={href} className="shrink-0 text-[12px] text-accent hover:underline">
            {hrefLabel}
          </Link>
        ) : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

/** "and 12 more", linking to where they all are. */
export function More({ count, href, noun = "more" }: { count: number; href?: string; noun?: string }) {
  if (count <= 0) return null;
  const text = `+ ${count} ${noun}`;
  return href ? (
    <Link href={href} className="mt-2 inline-block text-[12px] text-fg-subtle hover:text-accent">
      {text}
    </Link>
  ) : (
    <p className="mt-2 text-[12px] text-fg-subtle">{text}</p>
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
