import Link from "next/link";
import type { Character, Wardrobe, WardrobeSetup } from "@/lib/snapshot/schema";
import { setHref } from "@/lib/db/catalog-queries";
import { hrefForMythicOrSet } from "@/lib/collections/mythic-match";
import { getAccount } from "@/lib/db/queries";
import { qualityText } from "@/lib/format";
import { indexKnownSets, withResolvedSet, type KnownSet } from "@/lib/catalog/set-brief";
import { placeEquipped, tallySets } from "@/lib/characters/loadout";
import { skillIconByName } from "@/lib/icons/skill-icons";
import { EsoText } from "./eso-text";
import { GameIcon } from "./game-icon";
import { SetHover } from "./set-hover";
import { SkillHover } from "./skill-hover";

type Worn = Character["equipped"][number];

/**
 * Equipment in the game's slot order. The type stays at a reading size; a
 * short window scrolls this pane instead of shrinking the sheet. Hovering a
 * piece opens that set's catalog bonuses.
 */
export function CharacterLoadout({
  equipped,
  attributes,
  wardrobe,
  knownSets,
}: {
  equipped: Character["equipped"];
  attributes: Character["attributes"];
  wardrobe: Wardrobe | null | undefined;
  /** Every set this account or the catalog already has. */
  knownSets?: readonly KnownSet[];
}) {
  const known = indexKnownSets(knownSets ?? []);
  const withSets = equipped.map((item) => withResolvedSet(item, known));
  const placed = placeEquipped(withSets);
  const sets = tallySets(withSets);
  const worn = new Map(sets.map((set) => [set.name, set.count]));
  const mythics = safeMythics();
  const setLink = (name: string) => hrefForMythicOrSet(mythics, { name }, setHref({ name }));
  const setup = firstBarSetup(wardrobe);
  const food = setup?.food?.name ? setup.food : firstFood(wardrobe);
  const frontSkills = setup?.bars.find((bar) => bar.bar === "front")?.skills ?? [];
  const backSkills = setup?.bars.find((bar) => bar.bar === "back")?.skills ?? [];
  const armor: Slot[] = [
    { label: "Head", item: placed.head },
    { label: "Shoulders", item: placed.shoulders },
    { label: "Chest", item: placed.chest },
    { label: "Hands", item: placed.hands },
    { label: "Waist", item: placed.waist },
    { label: "Legs", item: placed.legs },
    { label: "Feet", item: placed.feet },
  ];
  const jewelry: Slot[] = [
    { label: "Necklace", item: placed.neck },
    { label: "Ring", item: placed.rings[0] },
    { label: "Ring", item: placed.rings[1] },
  ];

  return (
      <div className="flex flex-col gap-3">
        {sets.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {sets.map((set) => (
              <SetHover
                key={set.name}
                name={set.name}
                setId={withSets.find((item) => item.setName === set.name)?.setId}
                detail={`${set.count} worn`}
              >
                <Link
                  href={setLink(set.name)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-fg hover:border-border-strong"
                >
                  {set.name}
                  <span className="tabular-nums text-fg-subtle">{set.count}</span>
                </Link>
              </SetHover>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <div className="grid grid-cols-2 gap-x-2">
              <div className="col-span-2">
                <GearCell slot={armor[0]} setLink={setLink} worn={worn} />
              </div>
              {armor.slice(1).map((slot) => (
                <GearCell key={slot.label} slot={slot} setLink={setLink} worn={worn} />
              ))}
            </div>
            <div className="mt-1 grid grid-cols-3 gap-x-1 border-t border-border pt-1">
              {jewelry.map((slot, index) => (
                <GearCell key={`${slot.label}-${index}`} slot={slot} setLink={setLink} worn={worn} />
              ))}
            </div>
            <div className="mt-1 grid grid-cols-3 divide-x divide-border border-t border-border">
              {(
                [
                  ["Magicka", attributes.magicka ?? 0, "text-sky-300"],
                  ["Health", attributes.health ?? 0, "text-rose-300"],
                  ["Stamina", attributes.stamina ?? 0, "text-emerald-400"],
                ] as const
              ).map(([label, value, tone]) => (
                <div key={label} className="px-1 py-1.5 text-center">
                  <div className={`text-base font-semibold tabular-nums leading-none ${tone}`}>{value}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-fg-subtle">{label}</div>
                </div>
              ))}
            </div>
            {food?.name ? (
              <div className="border-t border-border pt-1">
                <GearCell slot={{ label: "Food", item: foodPiece(food, known) }} setLink={setLink} worn={worn} />
              </div>
            ) : null}
            {placed.other.length > 0 ? (
              <div className="border-t border-border pt-1">
                {placed.other.map((item) => (
                  <GearCell
                    key={`${item.slot}-${item.name}`}
                    slot={{ label: item.slot || "Equipped", item }}
                    setLink={setLink}
                    worn={worn}
                  />
                ))}
              </div>
            ) : null}
          </section>
          <WeaponBar title="Front bar" pair={placed.front} skills={frontSkills} setLink={setLink} worn={worn} />
          <WeaponBar title="Back bar" pair={placed.back} skills={backSkills} setLink={setLink} worn={worn} />
        </div>
      </div>
  );
}

type Slot = { label: string; item?: Worn };

function GearCell({
  slot,
  setLink,
  worn,
}: {
  slot: Slot;
  setLink: (name: string) => string;
  worn: Map<string, number>;
}) {
  const { item, label } = slot;
  const meta = item ? [item.trait, item.enchant, ...item.scribing].filter(Boolean) : [];
  const wornCount = item?.setName ? worn.get(item.setName) : undefined;
  const detail = [...meta, wornCount ? `${wornCount} worn` : null].filter(Boolean).join(" · ");
  const name = item ? (
    <div className={`line-clamp-2 text-sm leading-snug ${item.quality ? qualityText(item.quality) : "text-fg"}`}>
      {item.name}
    </div>
  ) : (
    <div className="text-sm text-fg-subtle">Empty</div>
  );

  const body = (
    <div data-slot={label} className="flex min-w-0 items-center gap-2 py-1">
      <SlotFrame item={item} />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</div>
        {item?.setName ? (
          <Link href={setLink(item.setName)} className="hover:underline">
            {name}
          </Link>
        ) : (
          name
        )}
        {meta.length > 0 ? (
          <div className="line-clamp-2 text-xs leading-snug text-fg-muted">
            <EsoText text={meta.join(" · ")} />
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!item) return body;
  return (
    <SetHover
      className="block min-w-0"
      name={item.setName}
      setId={item.setId}
      itemName={item.name}
      detail={detail || undefined}
    >
      {body}
    </SetHover>
  );
}

function SlotFrame({ item }: { item?: Worn }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-2 ${
        item ? `border ${qualityFrame(item.quality)}` : "border border-dashed border-border"
      }`}
    >
      {item ? <GameIcon name={item.name} icon={item.icon} size={30} bare /> : null}
    </span>
  );
}

function WeaponBar({
  title,
  pair,
  skills,
  setLink,
  worn,
}: {
  title: string;
  pair: { main?: Worn; off?: Worn; rest: Worn[] };
  skills: { name: string; icon?: string | null; description?: string | null }[];
  setLink: (name: string) => string;
  worn: Map<string, number>;
}) {
  const weapons: Slot[] = [
    { label: "Main hand", item: pair.main },
    { label: "Off hand", item: pair.off },
    ...pair.rest.map((item) => ({ label: item.slot || "Weapon", item })),
  ];
  return (
    <section className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <h2 className="px-0.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">{title}</h2>
      <div className="mt-1">
        {weapons.map((slot, index) => (
          <GearCell key={`${slot.label}-${index}`} slot={slot} setLink={setLink} worn={worn} />
        ))}
      </div>
      <ol className="mt-1.5 space-y-1 border-t border-border pt-1.5">
        {Array.from({ length: 6 }, (_, index) => skills[index] ?? null).map((skill, index) => {
          const ultimate = index === 5;
          return (
            <li key={index} className="flex min-w-0 items-center gap-2 text-sm">
              {skill?.name ? (
                <SkillHover
                  name={skill.name}
                  description={skill.description}
                  source={skill.description?.trim() ? "ingame" : undefined}
                  detail={`${title} · ${ultimate ? "Ultimate" : index + 1}`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="w-4 shrink-0 tabular-nums text-xs text-fg-subtle">{ultimate ? "U" : index + 1}</span>
                  <GameIcon name={skill.name} icon={skill.icon || skillIconByName(skill.name)} size={22} />
                  <span className={`min-w-0 truncate text-fg ${ultimate ? "text-q-legendary" : ""}`}>{skill.name}</span>
                </SkillHover>
              ) : (
                <>
                  <span className="w-4 shrink-0 tabular-nums text-xs text-fg-subtle">{ultimate ? "U" : index + 1}</span>
                  <span className="inline-flex h-5 w-5 rounded border border-dashed border-border" />
                  <span className="min-w-0 truncate text-fg-subtle">{ultimate ? "Ultimate" : "Empty"}</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function qualityFrame(quality: Worn["quality"]): string {
  switch (quality) {
    case "mythic":
      return "border-q-mythic";
    case "legendary":
      return "border-q-legendary";
    case "epic":
      return "border-q-epic";
    case "superior":
      return "border-q-superior";
    case "fine":
      return "border-q-fine";
    case "normal":
      return "border-q-normal";
    case "trash":
      return "border-q-trash";
    default:
      return "border-border-strong";
  }
}

function foodPiece(food: WardrobeSetup["food"], known: ReturnType<typeof indexKnownSets>): Worn | undefined {
  if (!food?.name) return undefined;
  const resolved = withResolvedSet(food, known);
  return {
    slot: food.slot || "Food",
    bar: null,
    name: food.name,
    icon: food.icon ?? undefined,
    quality: food.quality ?? undefined,
    setName: resolved.setName,
    setId: resolved.setId,
    trait: food.trait,
    enchant: null,
    scribing: [],
  };
}

function firstBarSetup(wardrobe: Wardrobe | null | undefined): WardrobeSetup | null {
  for (const zone of wardrobe?.zones ?? []) {
    for (const page of zone.pages) {
      for (const setup of page.setups) {
        if (setup.bars.some((bar) => bar.skills.length > 0)) return setup;
      }
    }
  }
  return null;
}

function firstFood(wardrobe: Wardrobe | null | undefined): WardrobeSetup["food"] | null {
  for (const zone of wardrobe?.zones ?? []) {
    for (const page of zone.pages) {
      for (const setup of page.setups) {
        if (setup.food?.name) return setup.food;
      }
    }
  }
  return null;
}

function safeMythics() {
  try {
    return getAccount()?.mythics ?? [];
  } catch {
    return [];
  }
}
