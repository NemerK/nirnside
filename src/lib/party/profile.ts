/**
 * Your Party profile: what others will see once friends and sharing arrive
 * with the web version. Stored locally now, in a shape a server can sync.
 */

export type Visibility = "private" | "friends" | "public";
export type ShowcaseSize = "half" | "full";
/** Who is looking at the profile: you, a friend, or anyone with the link. */
export type Viewer = "me" | "friend" | "public";

export interface ShowcaseModuleDef {
  id: string;
  label: string;
  /** What it shows, for the "add a module" list. */
  blurb: string;
  visibility: Visibility;
  size: ShowcaseSize;
}

/** Every module the profile can show, in the default order. */
export const SHOWCASE_MODULES: ShowcaseModuleDef[] = [
  { id: "characters", label: "Characters", blurb: "Everyone on the account, with class and Champion Points.", visibility: "public", size: "full" },
  { id: "wearing", label: "Wearing now", blurb: "The sets your main character has on.", visibility: "public", size: "half" },
  { id: "achievements", label: "Trials, dungeons and arenas", blurb: "Clears, as the game reports them.", visibility: "public", size: "half" },
  { id: "collections", label: "Collections", blurb: "Set pieces, mythics and outfit styles collected.", visibility: "friends", size: "half" },
  { id: "companions", label: "Companions", blurb: "Companions you've unlocked, with level and rapport.", visibility: "friends", size: "half" },
  { id: "houses", label: "Houses", blurb: "Houses you own, with their photos.", visibility: "public", size: "half" },
  { id: "guilds", label: "Guilds", blurb: "Your guilds and ranks.", visibility: "friends", size: "half" },
  { id: "plan", label: "Plan progress", blurb: "How far each character is towards your targets.", visibility: "friends", size: "half" },
  { id: "treasury", label: "Treasury", blurb: "Gold, account currencies and bank space.", visibility: "private", size: "half" },
  { id: "dailies", label: "Today", blurb: "Today's dailies for every character.", visibility: "private", size: "half" },
];

const DEF = new Map(SHOWCASE_MODULES.map((m) => [m.id, m]));

export interface ShowcaseItem {
  id: string;
  visibility: Visibility;
  size: ShowcaseSize;
}

export interface PartyProfile {
  status: string;
  /** The character the profile leads with; null picks the last one played. */
  mainCharacterId: string | null;
  /** Shown modules, in order. Modules not listed are hidden. */
  showcase: ShowcaseItem[];
}

export const STATUS_MAX = 140;

export function defaultProfile(): PartyProfile {
  return {
    status: "",
    mainCharacterId: null,
    showcase: SHOWCASE_MODULES.map(({ id, visibility, size }) => ({ id, visibility, size })),
  };
}

const VIS = new Set<Visibility>(["private", "friends", "public"]);
const SIZES = new Set<ShowcaseSize>(["half", "full"]);

/** Accept anything (stored JSON, a request body) and return a valid profile. */
export function normalizeProfile(raw: unknown): PartyProfile {
  const base = defaultProfile();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const status = typeof r.status === "string" ? r.status.replace(/\s+/g, " ").trim().slice(0, STATUS_MAX) : "";
  const main = typeof r.mainCharacterId === "string" && r.mainCharacterId.length <= 200 ? r.mainCharacterId : null;
  let showcase = base.showcase;
  if (Array.isArray(r.showcase)) {
    const seen = new Set<string>();
    showcase = [];
    for (const it of r.showcase) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const def = typeof o.id === "string" ? DEF.get(o.id) : undefined;
      if (!def || seen.has(def.id)) continue;
      seen.add(def.id);
      showcase.push({
        id: def.id,
        visibility: VIS.has(o.visibility as Visibility) ? (o.visibility as Visibility) : def.visibility,
        size: SIZES.has(o.size as ShowcaseSize) ? (o.size as ShowcaseSize) : def.size,
      });
    }
  }
  return { status, mainCharacterId: main, showcase };
}

/** Whether a viewer may see a module with this visibility. */
export function canSee(viewer: Viewer, visibility: Visibility): boolean {
  if (viewer === "me") return true;
  if (viewer === "friend") return visibility !== "private";
  return visibility === "public";
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "Only me",
  friends: "Friends",
  public: "Everyone",
};
