import Link from "next/link";
import type { Character, Wardrobe, WardrobeSetup } from "@/lib/snapshot/schema";
import { setHref } from "@/lib/db/catalog-queries";
import { qualityText } from "@/lib/format";
import { placeEquipped, tallySets } from "@/lib/characters/loadout";
import { skillIconByName } from "@/lib/icons/skill-icons";
import { GameIcon } from "./game-icon";

type Worn = Character["equipped"][number];

/**
 * Equipment in the game's slot order: head, then the body pairs, then
 * necklace and rings. Weapons sit on the front and back bars with the
 * skill icons from the wardrobe snapshot.
 */
export function CharacterLoadout({
  equipped,
  attributes,
  wardrobe,
}: {
  equipped: Character["equipped"];
  attributes: Character["attributes"];
  wardrobe: Wardrobe | null | undefined;
}) {
  const placed = placeEquipped(equipped);
  const sets = tallySets(equipped);
  const setup = firstBarSetup(wardrobe);
  const food = setup?.food?.name ? setup.food : firstFood(wardrobe);
  const frontSkills = setup?.bars.find((bar) => bar.bar === "front")?.skills ?? [];
  const backSkills = setup?.bars.find((bar) => bar.bar === "back")?.skills ?? [];
  const barLabel = setup ? barCaption(wardrobe, setup) : null;
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
    <div className="space-y-4">
      {sets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sets.map((set) => (
            <Link
              key={set.name}
              href={setHref({ name: set.name })}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-fg hover:border-border-strong"
            >
              {set.name}
              <span className="tabular-nums text-fg-subtle">{set.count}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-surface px-3 py-3 sm:px-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:mx-auto sm:w-1/2">
            <GearCell slot={armor[0]} />
          </div>
          {armor.slice(1).map((slot) => (
            <GearCell key={slot.label} slot={slot} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 border-t border-border pt-3 sm:grid-cols-3">
          {jewelry.map((slot, index) => (
            <GearCell key={`${slot.label}-${index}`} slot={slot} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-border border-t border-border">
          {(
            [
              ["Magicka", attributes.magicka ?? 0, "text-sky-300"],
              ["Health", attributes.health ?? 0, "text-rose-300"],
              ["Stamina", attributes.stamina ?? 0, "text-emerald-400"],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="px-2 py-2 text-center">
              <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
              <div className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</div>
            </div>
          ))}
        </div>
        {food?.name ? (
          <div className="border-t border-border pt-1">
            <GearCell slot={{ label: "Food", item: foodPiece(food) }} />
          </div>
        ) : null}
      </section>

      {placed.other.length > 0 ? (
        <section className="rounded-lg border border-border bg-surface px-3 py-2 sm:px-4">
          <h2 className="px-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Other</h2>
          {placed.other.map((item) => (
            <GearCell key={`${item.slot}-${item.name}`} slot={{ label: item.slot || "Equipped", item }} />
          ))}
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <WeaponBar title="Front bar" pair={placed.front} skills={frontSkills} />
        <WeaponBar title="Back bar" pair={placed.back} skills={backSkills} />
      </div>
      <p className="text-xs text-fg-subtle">
        {barLabel ? `Skills from ${barLabel}.` : "No skill bar in this snapshot."}
      </p>
    </div>
  );
}

type Slot = { label: string; item?: Worn };

function GearCell({ slot }: { slot: Slot }) {
  const { item, label } = slot;
  const meta = item ? [item.trait, item.enchant, ...item.scribing].filter(Boolean) : [];
  const title = item ? [label, item.name, item.setName, ...meta].filter(Boolean).join(" · ") : label;
  const name = item ? (
    <div className={`text-sm leading-snug ${item.quality ? qualityText(item.quality) : "text-fg"}`}>{item.name}</div>
  ) : (
    <div className="text-sm text-fg-subtle">Empty</div>
  );

  return (
    <div title={title} data-slot={label} className="flex min-w-0 items-center gap-2.5 px-1 py-1.5">
      <SlotFrame item={item} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</div>
        {item?.setName ? (
          <Link href={setHref({ name: item.setName })} className="hover:underline">
            {name}
          </Link>
        ) : (
          name
        )}
        {meta.length > 0 ? <div className="text-xs leading-snug text-fg-muted">{meta.join(" · ")}</div> : null}
      </div>
    </div>
  );
}

function SlotFrame({ item }: { item?: Worn }) {
  return (
    <span
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-2 ${
        item ? `border-2 ${qualityFrame(item.quality)}` : "border border-dashed border-border"
      }`}
    >
      {item ? <GameIcon name={item.name} icon={item.icon} size={40} bare /> : null}
    </span>
  );
}

function WeaponBar({
  title,
  pair,
  skills,
}: {
  title: string;
  pair: { main?: Worn; off?: Worn; rest: Worn[] };
  skills: { name: string; icon?: string | null }[];
}) {
  const weapons: Slot[] = [
    { label: "Main hand", item: pair.main },
    { label: "Off hand", item: pair.off },
    ...pair.rest.map((item) => ({ label: item.slot || "Weapon", item })),
  ];
  const named = skills.filter((skill) => skill.name);
  return (
    <section className="rounded-lg border border-border bg-surface px-3 py-3 sm:px-4">
      <h2 className="px-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{title}</h2>
      <div className="mt-1">
        {weapons.map((slot, index) => (
          <GearCell key={`${slot.label}-${index}`} slot={slot} />
        ))}
      </div>
      {named.length > 0 ? (
        <div className="mt-2 border-t border-border px-1 pt-3">
          <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: 6 }, (_, index) => skills[index] ?? null).map((skill, index) => {
              const ultimate = index === 5;
              return skill?.name ? (
                <span
                  key={`${skill.name}-${index}`}
                  title={skill.name}
                  className={ultimate ? "ml-1 rounded-md ring-2 ring-q-legendary/80" : ""}
                >
                  <GameIcon name={skill.name} icon={skill.icon || skillIconByName(skill.name)} size={36} />
                </span>
              ) : (
                <span
                  key={index}
                  title={ultimate ? "Ultimate" : `Skill ${index + 1}`}
                  className={`inline-flex h-9 w-9 rounded-md border border-dashed border-border ${ultimate ? "ml-1" : ""}`}
                />
              );
            })}
          </div>
          <ol className="mt-2 space-y-0.5">
            {skills.map((skill, index) =>
              skill?.name ? (
                <li key={`${skill.name}-${index}`} className="flex gap-2 text-xs text-fg">
                  <span className="w-4 shrink-0 tabular-nums text-fg-subtle">{index === 5 ? "U" : index + 1}</span>
                  <span className="min-w-0">{skill.name}</span>
                </li>
              ) : null,
            )}
          </ol>
        </div>
      ) : null}
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

function foodPiece(food: WardrobeSetup["food"]): Worn | undefined {
  if (!food?.name) return undefined;
  return {
    slot: food.slot || "Food",
    bar: null,
    name: food.name,
    icon: food.icon ?? undefined,
    quality: food.quality ?? undefined,
    setName: food.setName,
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

function barCaption(wardrobe: Wardrobe | null | undefined, setup: WardrobeSetup): string {
  for (const zone of wardrobe?.zones ?? []) {
    for (const page of zone.pages) {
      if (page.setups.includes(setup)) {
        return [zone.name, setup.name].filter(Boolean).join(" · ") || "wardrobe";
      }
    }
  }
  return setup.name || "wardrobe";
}
