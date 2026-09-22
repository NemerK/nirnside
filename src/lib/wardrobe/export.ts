import type { Wardrobe, WardrobePage, WardrobeSetup, WardrobeZone } from "../snapshot/schema";

/** What slice of a character's wardrobe an export covers. */
export type WardrobeExportScope = "wardrobe" | "zone" | "page" | "setup";

export type WardrobeExportContext = {
  character: { id?: string | null; name: string };
  zone?: { tag: string; name: string } | null;
  page?: { name: string } | null;
  setup?: { name: string } | null;
};

/**
 * A portable, self-describing snapshot of a Wizard's Wardrobe setup (or a page,
 * a zone, or the whole container). It carries only this one character's own
 * setups — the user chooses to share it. There is no server and nothing is
 * uploaded; the app just hands the user a file / clipboard text to send.
 */
export type WardrobeExport = {
  app: "Nirnside";
  kind: "wizards-wardrobe";
  version: 1;
  exportedAt: string;
  scope: WardrobeExportScope;
  character: { id?: string | null; name: string };
  /** Human-readable trail so a recipient sees where it came from. */
  path: { zone?: string; zoneTag?: string; page?: string; setup?: string };
  data: Wardrobe | WardrobeZone | WardrobePage | WardrobeSetup;
};

export function buildWardrobeExport(
  scope: WardrobeExportScope,
  data: Wardrobe | WardrobeZone | WardrobePage | WardrobeSetup,
  ctx: WardrobeExportContext,
  now: Date = new Date(),
): WardrobeExport {
  const path: WardrobeExport["path"] = {};
  if (ctx.zone) {
    path.zone = ctx.zone.name;
    path.zoneTag = ctx.zone.tag;
  }
  if (ctx.page) path.page = ctx.page.name;
  if (ctx.setup) path.setup = ctx.setup.name;

  return {
    app: "Nirnside",
    kind: "wizards-wardrobe",
    version: 1,
    exportedAt: now.toISOString(),
    scope,
    character: { id: ctx.character.id ?? null, name: ctx.character.name },
    path,
    data,
  };
}

/** Filesystem-safe token from an arbitrary label. */
function slug(value: string | undefined | null, fallback: string): string {
  const s = (value ?? "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return s || fallback;
}

/** A stable, readable filename for an export, e.g. `nirnside-sings-cloudrest-tank-trash.json`. */
export function wardrobeExportFilename(scope: WardrobeExportScope, ctx: WardrobeExportContext): string {
  const parts = ["nirnside", slug(ctx.character.name, "character"), "wardrobe"];
  if (scope !== "wardrobe" && ctx.zone) parts.push(slug(ctx.zone.tag || ctx.zone.name, "zone"));
  if ((scope === "page" || scope === "setup") && ctx.page) parts.push(slug(ctx.page.name, "page"));
  if (scope === "setup" && ctx.setup) parts.push(slug(ctx.setup.name, "setup"));
  return `${parts.join("-")}.json`;
}

/** Pretty JSON text for download / clipboard. */
export function wardrobeExportText(payload: WardrobeExport): string {
  return JSON.stringify(payload, null, 2);
}
