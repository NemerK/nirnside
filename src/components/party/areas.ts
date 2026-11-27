/**
 * Party's navigation, grouped the way Atlas groups it: by whose data it is.
 * Module ids match Setup's on/off switches (lib/modules.ts).
 */

export type PartyIcon =
  | "home"
  | "bag"
  | "layers"
  | "trophy"
  | "calendar"
  | "users"
  | "book"
  | "library"
  | "list"
  | "swords"
  | "settings";

export interface PartyNavItem {
  id: string;
  label: string;
  href: string;
  icon: PartyIcon;
  /** Addresses that light this item up (prefixes). */
  match: string[];
  permanent?: boolean;
  /** Hidden only if every listed module is switched off. */
  anyOf?: string[];
}

export interface PartyNavGroup {
  label: string;
  items: PartyNavItem[];
}

export const PARTY_NAV: PartyNavGroup[] = [
  {
    label: "Overview",
    items: [{ id: "home", label: "Profile", href: "/party", icon: "home", match: ["/party"], permanent: true }],
  },
  {
    label: "Account",
    items: [
      { id: "inventory", label: "Inventory", href: "/party/inventory", icon: "bag", match: ["/party/inventory"] },
      {
        id: "collections",
        label: "Collections",
        href: "/party/collections",
        icon: "layers",
        match: ["/party/collections"],
        anyOf: ["stickerbook", "styles", "houses"],
      },
      { id: "achievements", label: "Achievements", href: "/party/achievements", icon: "trophy", match: ["/party/achievements"] },
      { id: "dailies", label: "Dailies", href: "/party/dailies", icon: "calendar", match: ["/party/dailies"] },
    ],
  },
  {
    label: "Characters",
    items: [
      { id: "characters", label: "Roster", href: "/party/characters", icon: "users", match: ["/party/characters", "/party/c/"] },
      { id: "knowledge", label: "Craft knowledge", href: "/party/knowledge", icon: "book", match: ["/party/knowledge"] },
    ],
  },
  {
    label: "Catalog",
    items: [{ id: "encyclopedia", label: "Library", href: "/party/library", icon: "library", match: ["/party/library"] }],
  },
  {
    label: "Planning",
    items: [
      { id: "planner", label: "Planner", href: "/party/planner", icon: "list", match: ["/party/planner"] },
      { id: "builds", label: "Builds", href: "/party/builds", icon: "swords", match: ["/party/builds"] },
    ],
  },
  {
    label: "System",
    items: [{ id: "setup", label: "Setup", href: "/party/setup", icon: "settings", match: ["/party/setup"], permanent: true }],
  },
];

export function navItemVisible(item: PartyNavItem, disabled: Set<string>): boolean {
  if (item.permanent) return true;
  if (item.anyOf?.length) return item.anyOf.some((id) => !disabled.has(id));
  return !disabled.has(item.id);
}

export function navItemActive(item: PartyNavItem, pathname: string): boolean {
  return item.match.some((m) =>
    m === "/party" ? pathname === "/party" : m.endsWith("/") ? pathname.startsWith(m) : pathname === m || pathname.startsWith(`${m}/`),
  );
}

/** Collections' tabs. */
export const COLLECTION_TABS = [
  { id: "sets", label: "Set collection" },
  { id: "styles", label: "Outfit styles" },
  { id: "houses", label: "Houses" },
] as const;
export type CollectionTab = (typeof COLLECTION_TABS)[number]["id"];

/** Every section the shared section module renders. */
export type VaultSection = "inventory" | "sets" | "achievements" | "dailies" | "crafting" | "styles" | "houses" | "";
