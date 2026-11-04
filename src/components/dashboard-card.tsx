import Link from "next/link";
import {
  dashboardHref,
  type DashboardSection,
  type DashboardTargetDomain,
} from "@/lib/dashboard/href";
import { Card } from "./ui";

/**
 * One character's progress card. Pure presentational (server-rendered): the
 * page computes every number, this only draws. No client JavaScript.
 */

export interface DashboardRow {
  label: string;
  /** 0..100, already computed. */
  pct: number;
  /** e.g. "12/21 targets" or "214/324 traits". */
  detail: string;
  /** Which progress slice this bar opens. */
  section: DashboardSection;
  /** Narrows the Targets slice to one kind of goal. */
  domain?: DashboardTargetDomain;
}

export interface DashboardCardData {
  id: string;
  name: string;
  className: string;
  /** Level, or champion points once 50. */
  levelLabel: string;
  levelCaption: string;
  scanned: boolean;
  roles: string[];
  /** Overall completion against applicable targets; null when none apply. */
  overall: { pct: number; done: number; total: number } | null;
  rows: DashboardRow[];
}

export function DashboardCard({
  char,
  sort,
  selected,
  activeSection,
  activeDomain,
}: {
  char: DashboardCardData;
  sort: "progress" | "roster";
  selected: boolean;
  activeSection: DashboardSection | null;
  activeDomain: DashboardTargetDomain | null;
}) {
  const openSkills = dashboardHref({ sort, char: char.id, section: "skills" });
  return (
    <Card className={`p-4 transition-colors ${selected ? "border-accent/70 bg-accent-soft/30" : "hover:border-accent/40"}`}>
      <div className="flex items-center gap-4">
        <Link href={openSkills} aria-label={`Open ${char.name}`} className="shrink-0">
          <ProgressRing pct={char.overall ? char.overall.pct : null} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={openSkills}
            aria-current={selected && activeSection === "skills" && !activeDomain ? "page" : undefined}
            className="block truncate text-base font-semibold text-fg hover:text-accent hover:underline"
          >
            {char.name}
          </Link>
          <p className="truncate text-xs text-fg-subtle">
            {char.className} · {char.levelLabel} {char.levelCaption}
            {char.roles.length > 0 ? ` · ${char.roles.join(", ")}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {!char.scanned ? (
              <span className="text-fg-subtle">Not scanned yet</span>
            ) : char.overall ? (
              <>
                <span className="font-medium text-fg">{char.overall.done}</span>/{char.overall.total} targets done
              </>
            ) : (
              <span className="text-fg-subtle">No targets apply yet</span>
            )}
          </p>
        </div>
      </div>

      {char.rows.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {char.rows.map((row) => {
            const active =
              selected && activeSection === row.section && (row.domain ?? null) === (row.domain ? activeDomain : null);
            return (
              <li key={row.label}>
                <Link
                  href={dashboardHref({ sort, char: char.id, section: row.section, domain: row.domain })}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-md px-1.5 py-1 ${active ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                >
                  <div className="mb-0.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className={active ? "font-medium text-accent" : "text-fg-muted"}>{row.label}</span>
                    <span className="tabular-nums text-fg-subtle">
                      {row.detail} · <span className="text-fg-muted">{row.pct}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** A donut ring with the completion percentage in the middle. */
function ProgressRing({ pct, size = 64 }: { pct: number | null; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = pct == null ? 0 : (c * pct) / 100;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        style={{ stroke: "var(--border)" }}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ stroke: "var(--accent)" }}
      />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.24}
        fontWeight={600}
        style={{ fill: "var(--fg)" }}
      >
        {pct == null ? "—" : `${pct}%`}
      </text>
    </svg>
  );
}
