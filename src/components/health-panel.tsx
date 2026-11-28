import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { HealthCheck } from "@/lib/game/health";

/**
 * Nirnside's own health check, at the top of Setup. Problems and notes are
 * spelled out with what fixes them; passing checks fold into one line.
 */
export function HealthPanel({ checks }: { checks: HealthCheck[] }) {
  const problems = checks.filter((c) => c.status === "problem");
  const notes = checks.filter((c) => c.status === "note");
  const passed = checks.filter((c) => c.status === "ok");
  const open = [...problems, ...notes];

  return (
    <section aria-labelledby="health-title" className="rounded-xl border border-border bg-surface">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id="health-title" className="text-sm font-semibold text-fg">
          Data health
        </h2>
        <p className="text-[13px] text-fg-muted">
          {problems.length
            ? `${problems.length} to fix`
            : notes.length
              ? `All consistent · ${notes.length} to note`
              : "All consistent"}
        </p>
      </header>
      {open.length > 0 ? (
        <ul className="divide-y divide-border">
          {open.map((c) => (
            <li key={c.id} className="flex gap-3 px-5 py-3">
              {c.status === "problem" ? (
                <AlertTriangle aria-label="Problem" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              ) : (
                <Info aria-label="Note" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              )}
              <div className="min-w-0 text-sm">
                <p className="font-medium text-fg">{c.title}</p>
                <p className="text-fg-muted">{c.detail}</p>
                {c.examples?.length ? (
                  <p className="mt-0.5 truncate text-[12px] text-fg-subtle" title={c.examples.join(", ")}>
                    {c.examples.join(" · ")}
                  </p>
                ) : null}
                {c.fix ? <p className="mt-1 text-[13px] text-fg">{c.fix}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {passed.length > 0 ? (
        <details className={open.length ? "border-t border-border" : ""}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] text-fg-muted hover:text-fg">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-ok" />
            {passed.length} {passed.length === 1 ? "check" : "checks"} passed
          </summary>
          <ul className="space-y-1 px-5 pb-3 pl-11 text-[13px] text-fg-muted">
            {passed.map((c) => (
              <li key={c.id}>
                <span className="text-fg">{c.title}:</span> {c.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
