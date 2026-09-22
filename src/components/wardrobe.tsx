"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Shirt, Sparkles, Star, Utensils } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import { Modal } from "@/components/modal";
import type { Wardrobe as WardrobeData, WardrobeSetup, WardrobeZone } from "@/lib/snapshot/schema";
import { qualityText } from "@/lib/format";
import { copySetupImage, downloadSetupImage, type SetupImageMeta } from "@/lib/wardrobe/setup-image";

function GearRow({ piece, hrefForSet }: { piece: WardrobeSetup["gear"][number]; hrefForSet: Record<string, string> }) {
  const setLink = piece.setName ? hrefForSet[piece.setName.toLowerCase()] : undefined;
  return (
    <div className="flex items-center gap-2">
      <GameIcon name={piece.name || piece.slot} icon={piece.icon} size={26} />
      <div className="min-w-0">
        <div className={`truncate text-xs font-medium ${piece.quality ? qualityText(piece.quality) : "text-fg"}`}>
          {piece.name || piece.slot}
          {piece.mythic && <span className="ml-1 text-[10px] uppercase tracking-wider text-q-mythic">Mythic</span>}
        </div>
        <div className="flex flex-wrap gap-1 text-[10px] text-fg-subtle">
          <span>{piece.slot}</span>
          {piece.setName &&
            (setLink ? (
              <Link href={setLink} className="text-accent hover:underline">
                · {piece.setName}
              </Link>
            ) : (
              <span>· {piece.setName}</span>
            ))}
          {piece.trait && <span>· {piece.trait}</span>}
        </div>
      </div>
    </div>
  );
}

function SkillBar({ bar }: { bar: WardrobeSetup["bars"][number] }) {
  const filled = bar.skills.filter((s) => s.name);
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-fg-subtle">
        {bar.bar === "front" ? "Front bar" : "Back bar"}
      </div>
      {filled.length === 0 ? (
        <div className="text-[11px] text-fg-subtle">No skills saved</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {filled.map((s, i) => (
            <span key={`${s.name}-${i}`} className="flex items-center gap-1" title={s.name}>
              <GameIcon name={s.name} icon={s.icon} size={24} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type CopyState = "idle" | "working" | "copied" | "downloaded";

function SetupCard({
  setup,
  hrefForSet,
  meta,
}: {
  setup: WardrobeSetup;
  hrefForSet: Record<string, string>;
  meta: SetupImageMeta;
}) {
  const gear = setup.gear.filter((g) => g.name || g.slot);
  const [state, setState] = useState<CopyState>("idle");

  async function copyImage() {
    if (state === "working") return;
    setState("working");
    const ok = await copySetupImage(setup, meta);
    if (ok) {
      setState("copied");
    } else {
      // Clipboard refused (permissions / browser) — hand them a file instead.
      await downloadSetupImage(setup, meta);
      setState("downloaded");
    }
    window.setTimeout(() => setState("idle"), 1800);
  }

  async function download() {
    await downloadSetupImage(setup, meta);
  }

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-fg">{setup.name || "Unnamed setup"}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copyImage}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-fg-muted transition hover:border-border-strong hover:text-fg"
            title="Copy this setup as an image to paste to a friend"
          >
            {state === "copied" ? (
              <>
                <Check className="h-3 w-3 text-ok" /> Copied
              </>
            ) : state === "downloaded" ? (
              <>
                <Check className="h-3 w-3 text-ok" /> Saved image
              </>
            ) : state === "working" ? (
              <>
                <Copy className="h-3 w-3 animate-pulse" /> …
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" /> Copy image
              </>
            )}
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center rounded-md border border-border p-1 text-fg-muted transition hover:border-border-strong hover:text-fg"
            title="Download this setup as a PNG"
          >
            <Download className="h-3 w-3" />
          </button>
        </div>
      </div>

      {gear.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-subtle">
            <Shirt className="h-3 w-3" /> Gear
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {gear.map((g, i) => (
              <GearRow key={`${g.slot}-${i}`} piece={g} hrefForSet={hrefForSet} />
            ))}
          </div>
        </div>
      )}

      {setup.bars.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {setup.bars.map((b) => (
            <SkillBar key={b.bar} bar={b} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {setup.cp.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-fg-muted">
            <Star className="h-3 w-3 text-accent" />
            {setup.cp.slice(0, 6).join(", ")}
            {setup.cp.length > 6 ? ` +${setup.cp.length - 6}` : ""}
          </div>
        )}
        {setup.food?.name && (
          <div className="flex items-center gap-1 text-[11px] text-fg-muted">
            <Utensils className="h-3 w-3 text-accent" /> {setup.food.name}
          </div>
        )}
      </div>
    </Card>
  );
}

function ZonePanel({
  zone,
  hrefForSet,
  character,
}: {
  zone: WardrobeZone;
  hrefForSet: Record<string, string>;
  character: string;
}) {
  const pages = zone.pages.filter((p) => p.setups.some((s) => s.name || s.gear.length || s.bars.length));
  if (pages.length === 0) return null;
  return (
    <div className="space-y-4">
      {pages.map((page, pi) => {
        const pageName = page.name || `Page ${pi + 1}`;
        return (
          <div key={`${page.name}-${pi}`}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-fg">{pageName}</span>
              <span className="text-xs text-fg-subtle">
                {page.setups.length} setup{page.setups.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {page.setups.map((s, si) => (
                <SetupCard
                  key={`${s.name}-${si}`}
                  setup={s}
                  hrefForSet={hrefForSet}
                  meta={{ character, zone: zone.name || zone.tag, page: pageName }}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function countSetups(wardrobe: WardrobeData): number {
  let n = 0;
  for (const z of wardrobe.zones) for (const p of z.pages) n += p.setups.length;
  return n;
}

export function Wardrobe({
  wardrobe,
  hrefForSet = {},
  characterName = "Character",
}: {
  wardrobe: WardrobeData | null | undefined;
  hrefForSet?: Record<string, string>;
  characterName?: string;
  characterId?: string | null;
}) {
  const zones = (wardrobe?.zones ?? []).filter((z) =>
    z.pages.some((p) => p.setups.some((s) => s.name || s.gear.length || s.bars.length)),
  );
  const [open, setOpen] = useState(false);
  const [zoneTag, setZoneTag] = useState(zones[0]?.tag ?? "");
  if (!wardrobe || zones.length === 0) return null;
  const zone = zones.find((z) => z.tag === zoneTag) ?? zones[0];
  const total = countSetups({ ...wardrobe, zones });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg transition hover:border-accent/50 hover:bg-surface-2"
      >
        <Sparkles className="h-4 w-4 text-accent" />
        Wizard&apos;s Wardrobe
        <span className="text-xs text-fg-subtle">
          {zones.length} zone{zones.length === 1 ? "" : "s"} · {total} setup{total === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <Modal title="Wizard's Wardrobe" onClose={() => setOpen(false)} maxWidthClass="max-w-4xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Badge tone="muted">
              <Sparkles className="h-3 w-3" /> From the Wizard&apos;s Wardrobe addon
              {wardrobe.accountWide ? " · account-wide" : ""}
            </Badge>
            <span className="text-xs text-fg-subtle">Click a setup&apos;s Copy image to paste it to a friend.</span>
          </div>

          {zones.length > 1 && (
            <div role="tablist" aria-label="Wardrobe zone" className="mb-3 flex flex-wrap gap-1">
              {zones.map((z) => (
                <button
                  key={z.tag}
                  type="button"
                  role="tab"
                  aria-selected={z.tag === zone.tag}
                  onClick={() => setZoneTag(z.tag)}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    z.tag === zone.tag
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  {z.name || z.tag}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <ZonePanel zone={zone} hrefForSet={hrefForSet} character={characterName} />
          </div>
        </Modal>
      )}
    </>
  );
}
