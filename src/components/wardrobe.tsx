"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Download, Shirt, Sparkles, Star, Utensils } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import type { Wardrobe as WardrobeData, WardrobePage, WardrobeSetup, WardrobeZone } from "@/lib/snapshot/schema";
import { qualityText } from "@/lib/format";
import {
  buildWardrobeExport,
  wardrobeExportFilename,
  wardrobeExportText,
  type WardrobeExportContext,
  type WardrobeExportScope,
} from "@/lib/wardrobe/export";

type WardrobeData_ = WardrobeData;

/** Download a setup/page/zone/whole wardrobe as JSON, and copy it to the clipboard. */
function saveWardrobe(
  scope: WardrobeExportScope,
  data: WardrobeData_ | WardrobeZone | WardrobePage | WardrobeSetup,
  ctx: WardrobeExportContext,
) {
  const payload = buildWardrobeExport(scope, data, ctx);
  const text = wardrobeExportText(payload);
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = wardrobeExportFilename(scope, ctx);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    // Download can fail in locked-down webviews; clipboard below still works.
  }
  navigator.clipboard?.writeText(text).catch(() => {
    // Clipboard may be unavailable; the download already covers sharing.
  });
}

function SaveButton({
  label,
  onSave,
  className = "",
}: {
  label: string;
  onSave: () => void;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        onSave();
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
      }}
      className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-fg-muted transition hover:border-border-strong hover:text-fg ${className}`}
      title="Download this as a JSON file and copy it to your clipboard to share"
    >
      {saved ? <Check className="h-3 w-3 text-ok" /> : <Download className="h-3 w-3" />}
      {saved ? "Saved" : label}
    </button>
  );
}

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

function SetupCard({
  setup,
  hrefForSet,
  onSave,
}: {
  setup: WardrobeSetup;
  hrefForSet: Record<string, string>;
  onSave: () => void;
}) {
  const gear = setup.gear.filter((g) => g.name || g.slot);
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-fg">{setup.name || "Unnamed setup"}</span>
        <SaveButton label="Save" onSave={onSave} />
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
  character: WardrobeExportContext["character"];
}) {
  const pages = zone.pages.filter((p) => p.setups.some((s) => s.name || s.gear.length || s.bars.length));
  if (pages.length === 0) return null;
  const zoneCtx = { tag: zone.tag, name: zone.name };
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
              <SaveButton
                label="Save page"
                className="ml-auto"
                onSave={() =>
                  saveWardrobe("page", page, { character, zone: zoneCtx, page: { name: pageName } })
                }
              />
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {page.setups.map((s, si) => (
                <SetupCard
                  key={`${s.name}-${si}`}
                  setup={s}
                  hrefForSet={hrefForSet}
                  onSave={() =>
                    saveWardrobe("setup", s, {
                      character,
                      zone: zoneCtx,
                      page: { name: pageName },
                      setup: { name: s.name || `Setup ${si + 1}` },
                    })
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Wardrobe({
  wardrobe,
  hrefForSet = {},
  characterName = "Character",
  characterId,
}: {
  wardrobe: WardrobeData | null | undefined;
  hrefForSet?: Record<string, string>;
  characterName?: string;
  characterId?: string | null;
}) {
  const zones = (wardrobe?.zones ?? []).filter((z) =>
    z.pages.some((p) => p.setups.some((s) => s.name || s.gear.length || s.bars.length)),
  );
  const [zoneTag, setZoneTag] = useState(zones[0]?.tag ?? "");
  if (zones.length === 0 || !wardrobe) return null;
  const zone = zones.find((z) => z.tag === zoneTag) ?? zones[0];
  const character = { id: characterId, name: characterName };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle className="mb-0">Wizard&apos;s Wardrobe</SectionTitle>
        <div className="flex items-center gap-2">
          <Badge tone="muted">
            <Sparkles className="h-3 w-3" /> From the Wizard&apos;s Wardrobe addon
            {wardrobe?.accountWide ? " · account-wide" : ""}
          </Badge>
          <SaveButton
            label="Save all"
            onSave={() => saveWardrobe("wardrobe", { ...wardrobe, zones }, { character })}
          />
        </div>
      </div>

      {zones.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1">
          <div role="tablist" aria-label="Wardrobe zone" className="flex flex-wrap gap-1">
            {zones.map((z) => (
              <button
                key={z.tag}
                type="button"
                role="tab"
                aria-selected={z.tag === zone.tag}
                onClick={() => setZoneTag(z.tag)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  z.tag === zone.tag ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {z.name || z.tag}
              </button>
            ))}
          </div>
          <SaveButton
            label="Save zone"
            className="ml-auto"
            onSave={() => saveWardrobe("zone", zone, { character, zone: { tag: zone.tag, name: zone.name } })}
          />
        </div>
      )}

      <ZonePanel zone={zone} hrefForSet={hrefForSet} character={character} />
    </section>
  );
}
