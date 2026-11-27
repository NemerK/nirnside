import Link from "next/link";

/** In-page tabs (views of one page). Links, so each view has its own address. */
export function SubTabs({ tabs, label }: { tabs: { href: string; label: string; on: boolean; note?: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="mb-4 flex flex-wrap gap-1 rounded-xl border border-border bg-surface/60 p-1 sm:inline-flex">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.on ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
            t.on ? "bg-accent-soft text-fg ring-1 ring-inset ring-accent/40" : "text-fg-muted hover:text-fg"
          }`}
        >
          {t.label}
          {t.note ? <span className="ml-1.5 tabular-nums text-fg-subtle">{t.note}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
