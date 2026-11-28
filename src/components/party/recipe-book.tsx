"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { EsoText } from "@/components/eso-text";
import { GameIcon } from "@/components/game-icon";
import { HoverTip } from "@/components/party/hover-tip";
import type { CatalogRecipe } from "@/lib/catalog/schema";
import { qualityColor, QUALITIES, QUALITY_LABEL, parseQuality } from "@/lib/game/quality";
import { knownRecipes, readRecipe, type RecipeCharacter, type RecipeReading } from "@/lib/game/recipes";
import { TRADESKILLS, TRADESKILL_NAMES, type Tradeskill } from "@/lib/game/tradeskills";
import { tradeskillColor } from "@/lib/ui/game-colors";

/** The page's own known filter; "Can craft" is this view's. */
export type KnownFilter = "all" | "known" | "missing";

interface Row {
  entry: CatalogRecipe;
  reading: RecipeReading;
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] transition-colors ${
        active ? "border-accent bg-accent/15 text-fg" : "border-border text-fg-muted hover:text-fg"
      }`}
    >
      {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden /> : null}
      {children}
    </button>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <label className="inline-flex items-center gap-1.5 text-[12px] text-fg-subtle">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-surface px-1.5 py-1 text-[12px] text-fg"
      >
        <option value="">All</option>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function StatusBadge({ reading }: { reading: RecipeReading }) {
  if (reading.known === null) return null;
  if (!reading.known) return <span className="text-[11px] text-fg-subtle">Not known</span>;
  if (reading.canCraft === true)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-ok">
        <Check className="h-3 w-3" aria-hidden />
        Can craft
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
      <Check className="h-3 w-3" aria-hidden />
      Known
    </span>
  );
}

function RecipeTile({ row }: { row: Row }) {
  const { entry, reading } = row;
  const result = entry.result;
  const color = tradeskillColor(reading.craft);
  const where = [entry.furnishing?.category, entry.furnishing?.subcategory].filter(Boolean).join(" › ");
  // Older scans saved blank rows for recipes the scanning character didn't know.
  const ingredients = entry.ingredients.filter((i) => i.name && (i.quantity ?? 0) > 0);
  const tip = (
    <>
      <span className="block font-medium" style={{ color: qualityColor(result?.quality, "var(--fg)") }}>
        {reading.name}
      </span>
      <span className="block text-[12px] text-fg-subtle">
        {[reading.craftName, where || null, entry.furnishing?.theme, entry.furnishing?.limit].filter(Boolean).join(" · ")}
      </span>
      {result?.flavor ? (
        <span className="mt-1.5 block italic text-fg-muted">
          <EsoText text={result.flavor} />
        </span>
      ) : null}
      {ingredients.length > 0 ? (
        <span className="mt-2 block">
          <span className="block text-[12px] text-fg-subtle">Ingredients</span>
          {ingredients.map((i, n) => (
            <span key={`${i.itemId ?? i.name}-${n}`} className="block tabular-nums">
              <span className="text-fg-muted">{i.quantity ?? 1}×</span>{" "}
              <span style={{ color: qualityColor(i.quality, "var(--fg)") }}>{i.name}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="mt-2 block text-[12px] text-fg-subtle">Ingredients show once a character who knows it saves.</span>
      )}
      {reading.requirements.length > 0 ? (
        <span className="mt-2 block">
          {reading.requirements.map((r) => (
            <span
              key={r.label}
              className={`block ${r.met === false ? "text-danger" : r.met === true ? "text-fg-muted" : "text-fg-subtle"}`}
            >
              Requires {r.label}
              {r.met === false ? " (not yet)" : ""}
            </span>
          ))}
        </span>
      ) : null}
      {result?.sellPrice ? (
        <span className="mt-1.5 block tabular-nums text-gold">Sells for {result.sellPrice.toLocaleString("en-US")} gold</span>
      ) : null}
    </>
  );
  return (
    <li>
      <HoverTip tip={tip} className="block">
        <div
          tabIndex={0}
          className={`flex h-full gap-2.5 rounded-lg border border-border/70 border-l-[3px] px-2.5 py-2 ${
            reading.known === false ? "opacity-60" : ""
          }`}
          style={{ borderLeftColor: color ?? "var(--border)" }}
        >
          <GameIcon name={reading.name} icon={result?.icon ?? null} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span className="truncate text-[13px] font-medium" style={{ color: qualityColor(result?.quality, "var(--fg)") }}>
                {reading.name}
              </span>
              <span className="shrink-0">
                <StatusBadge reading={reading} />
              </span>
            </div>
            <p className="truncate text-[11px] text-fg-subtle">
              {[reading.craftName, where || null, entry.furnishing?.theme].filter(Boolean).join(" · ")}
            </p>
            {reading.requirements.some((r) => r.met === false) ? (
              <p className="truncate text-[11px] text-danger">
                Requires {reading.requirements.filter((r) => r.met === false).map((r) => r.label).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </HoverTip>
    </li>
  );
}

/**
 * Recipes or furnishing plans as the game describes them: what each makes,
 * at which craft's station, in which quality, what it needs and, for plans,
 * where the game files the furnishing. Known and "can craft" are this
 * character's, from their last save.
 */
export function RecipeBook({
  entries,
  character,
  query,
  known = "all",
}: {
  entries: CatalogRecipe[];
  character: RecipeCharacter;
  query: string;
  known?: KnownFilter;
}) {
  const [craftableOnly, setCraftableOnly] = useState(false);
  const [craft, setCraft] = useState<Tradeskill | null>(null);
  const [quality, setQuality] = useState("");
  const [category, setCategory] = useState("");
  const [theme, setTheme] = useState("");

  const rows: Row[] = useMemo(() => {
    const known = knownRecipes(character);
    return entries.map((entry) => ({ entry, reading: readRecipe(entry, character, known) }));
  }, [entries, character]);

  const crafts = TRADESKILLS.filter((t) => rows.some((r) => r.reading.craft === t));
  const qualities = QUALITIES.filter((q) => rows.some((r) => parseQuality(r.entry.result?.quality ?? null) === q));
  const categories = [...new Set(rows.map((r) => r.entry.furnishing?.category).filter((c): c is string => !!c))].sort();
  const themes = [...new Set(rows.map((r) => r.entry.furnishing?.theme).filter((c): c is string => !!c))].sort();

  const shown = rows.filter(({ entry, reading }) => {
    if (craft && reading.craft !== craft) return false;
    if (quality && parseQuality(entry.result?.quality ?? null) !== quality) return false;
    if (category && entry.furnishing?.category !== category) return false;
    if (theme && entry.furnishing?.theme !== theme) return false;
    if (known === "known" && reading.known !== true) return false;
    if (known === "missing" && reading.known !== false) return false;
    if (craftableOnly && reading.canCraft !== true) return false;
    if (query) {
      const hay = [reading.name, entry.name, entry.list, entry.furnishing?.category, entry.furnishing?.subcategory, entry.furnishing?.theme]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  // The game's own lists ("Blacksmithing Diagrams", "Meat Dishes"), in the order it gives them.
  const groups = new Map<string, Row[]>();
  for (const row of shown) {
    const key = row.entry.list ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <div>
      <div className="mb-3 space-y-2">
        {crafts.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={craft === null} onClick={() => setCraft(null)}>
              Every craft
            </Chip>
            {crafts.map((t) => (
              <Chip key={t} active={craft === t} onClick={() => setCraft(craft === t ? null : t)} color={tradeskillColor(t)}>
                {TRADESKILL_NAMES[t]}
              </Chip>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Chip active={craftableOnly} onClick={() => setCraftableOnly(!craftableOnly)}>
            <Check className="h-3 w-3" aria-hidden />
            Can craft now
          </Chip>
          <Select
            label="Quality"
            value={quality}
            options={qualities.map((q) => ({ value: q, label: QUALITY_LABEL[q] }))}
            onChange={setQuality}
          />
          <Select label="Category" value={category} options={categories} onChange={setCategory} />
          <Select label="Theme" value={theme} options={themes} onChange={setTheme} />
        </div>
      </div>
      <p className="mb-2 text-[12px] text-fg-subtle">
        {shown.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")}
      </p>
      {groups.size === 0 ? (
        <p className="text-[13px] text-fg-muted">Nothing matches these filters.</p>
      ) : (
        <div className="space-y-4">
          {[...groups].map(([list, items]) => (
            <section key={list}>
              <h3 className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium text-fg">
                {list}
                <span className="text-[12px] font-normal text-fg-subtle">
                  {items.filter((r) => r.reading.known).length}/{items.length}
                </span>
              </h3>
              <ul className="grid grid-cols-1 gap-1.5 md:grid-cols-2 2xl:grid-cols-3">
                {items.map((row) => (
                  <RecipeTile key={row.entry.id} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
