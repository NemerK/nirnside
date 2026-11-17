/** Where an in-page link left off, so the next screen can return in one step. */

const CHARACTER_TAB_LABEL: Record<string, string> = {
  equipped: "Equipped",
  setups: "Setups",
  targets: "Targets",
  scripts: "Scripts",
  cp: "Champion Points",
};

const DASHBOARD_SECTION_LABEL: Record<string, string> = {
  skills: "Skills",
  crafting: "Crafting",
  scribing: "Scribing",
  knowledge: "Knowledge",
  champion: "Champion Points",
  targets: "Targets",
};

const SECTION_LABEL: Record<string, string> = {
  "": "Home",
  dashboard: "Dashboard",
  planner: "Planner",
  characters: "Characters",
  inventory: "Inventory",
  stickerbook: "Stickerbook",
  knowledge: "Knowledge",
  styles: "Styles",
  dailies: "Dailies",
  houses: "Houses",
  achievements: "Achievements",
  encyclopedia: "Encyclopedia",
  collections: "Collections",
  setup: "Setup",
  search: "Search",
};

export type ActivityPlace = {
  href: string;
  label: string;
};

/** First path segment. Home is an empty section. */
export function activitySection(href: string): string {
  const path = href.split(/[?#]/)[0] || "/";
  return path.split("/").filter(Boolean)[0] ?? "";
}

/** An in-page link that opens a different part of the app, not a child of this one. */
export function leavesActivity(fromHref: string, toHref: string): boolean {
  const toPath = toHref.split(/[?#]/)[0] || "";
  if (!toPath.startsWith("/")) return false;
  return activitySection(fromHref) !== activitySection(toHref);
}

/** A short name for the page being left, using its heading when that is the useful part. */
export function activityLabel(href: string, heading: string | null): string {
  const path = href.split(/[?#]/)[0] || "/";
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1).split("#")[0] : "";
  const params = new URLSearchParams(query);
  const title = heading?.replace(/\s+/g, " ").trim() ?? "";
  const section = activitySection(path);

  if (section === "characters" && path.split("/").filter(Boolean).length > 1) {
    const who = title || "Character";
    const tab = CHARACTER_TAB_LABEL[params.get("tab") ?? ""];
    return tab ? `${who} · ${tab}` : who;
  }

  if (section === "dashboard") {
    const part = DASHBOARD_SECTION_LABEL[params.get("section") ?? ""];
    return part ? `Dashboard · ${part}` : "Dashboard";
  }

  if (title && title.length <= 60) return title;
  return SECTION_LABEL[section] ?? "Previous page";
}
