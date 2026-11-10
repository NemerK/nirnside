/**
 * Atlas information architecture — navigation grouped by data grain, not by
 * a flat feature list. Classic keeps its own flat NAV; this registry drives
 * the Atlas shell and the Collections hub.
 *
 * Module ids still match `TOGGLEABLE_MODULES` so Setup toggles keep working.
 * Dashboard is intentionally omitted from Atlas nav: its progress workspace
 * lives on Characters. Focus remains a redirect to Dashboard for old links.
 */

export type IaGrain = "account" | "characters" | "catalog" | "planning" | "system";

export interface IaNavItem {
  /** Module id used for hide/show, or a permanent system id. */
  id: string;
  label: string;
  href: string;
  /** One-line purpose, shown in Atlas chrome. */
  blurb: string;
  /** Permanent items (Home, Setup) ignore the modules off-list. */
  permanent?: boolean;
  /**
   * When set, this nav row is hidden only if every listed child module is off.
   * Used for Collections (stickerbook + styles + houses).
   */
  anyOf?: string[];
}

export interface IaGroup {
  id: IaGrain;
  label: string;
  blurb: string;
  items: IaNavItem[];
}

export const ATLAS_NAV: IaGroup[] = [
  {
    id: "system",
    label: "Overview",
    blurb: "Account pulse and local setup.",
    items: [
      {
        id: "home",
        label: "Home",
        href: "/",
        blurb: "Account pulse: wallets, guilds, goals, and what needs attention.",
        permanent: true,
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    blurb: "Shared across every character on this megaserver.",
    items: [
      {
        id: "inventory",
        label: "Inventory",
        href: "/inventory",
        blurb: "Bags, bank, craft bag, and the account wallet.",
      },
      {
        id: "collections",
        label: "Collections",
        href: "/collections",
        blurb: "Set pieces, outfit styles, and owned houses — one place.",
        anyOf: ["stickerbook", "styles", "houses"],
      },
      {
        id: "achievements",
        label: "Achievements",
        href: "/achievements",
        blurb: "Trial, dungeon, and arena clears as the game reports them.",
      },
      {
        id: "dailies",
        label: "Dailies",
        href: "/dailies",
        blurb: "Randoms, writs, pledges, and zone dailies by reset day.",
      },
    ],
  },
  {
    id: "characters",
    label: "Characters",
    blurb: "Per-toon sheets: skills, gear, craft knowledge, CP, scribing.",
    items: [
      {
        id: "characters",
        label: "Roster",
        href: "/characters",
        blurb: "Live roster with progress — open one for the full workspace.",
      },
      {
        id: "knowledge",
        label: "Craft knowledge",
        href: "/knowledge",
        blurb: "Research, motif chapters, recipes, and plans per character.",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    blurb: "The shared Tamriel encyclopedia, overlaid with your ownership.",
    items: [
      {
        id: "encyclopedia",
        label: "Encyclopedia",
        href: "/encyclopedia",
        blurb: "Sets, skills, Champion Points, and scribing.",
      },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    blurb: "Player-authored targets on top of the snapshot.",
    items: [
      {
        id: "planner",
        label: "Planner",
        href: "/planner",
        blurb: "Essential, optional, and completionist goals.",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    blurb: "Local machine only.",
    items: [
      {
        id: "setup",
        label: "Setup",
        href: "/setup",
        blurb: "Find ESO, install addons, choose modules and look.",
        permanent: true,
      },
    ],
  },
];

/** Whether an Atlas nav item should render given the player's module off-list. */
export function atlasItemVisible(item: IaNavItem, hidden: Set<string>): boolean {
  if (item.permanent) return true;
  if (item.anyOf?.length) return item.anyOf.some((id) => !hidden.has(id));
  return !hidden.has(item.id);
}
