/** Sections a dashboard card can open. One character, one slice of their progress. */
export const DASHBOARD_SECTIONS = ["skills", "crafting", "scribing", "knowledge", "champion", "targets"] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export type DashboardTargetDomain = "skillline" | "ability" | "script";

export function isDashboardSection(value: string | undefined): value is DashboardSection {
  return !!value && (DASHBOARD_SECTIONS as readonly string[]).includes(value);
}

export function isTargetDomain(value: string | undefined): value is DashboardTargetDomain {
  return value === "skillline" || value === "ability" || value === "script";
}

/** Dashboard URL that keeps the sort and opens one character's progress. */
export function dashboardHref(opts: {
  sort?: "progress" | "roster";
  char?: string | null;
  section?: DashboardSection | null;
  domain?: DashboardTargetDomain | null;
}): string {
  const q = new URLSearchParams();
  if (opts.sort === "roster") q.set("sort", "roster");
  if (opts.char) q.set("char", opts.char);
  if (opts.char && opts.section) q.set("section", opts.section);
  if (opts.char && opts.section === "targets" && opts.domain) q.set("domain", opts.domain);
  const query = q.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}
