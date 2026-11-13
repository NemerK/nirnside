import Link from "next/link";
import type { Character, Wardrobe, WardrobeSetup } from "@/lib/snapshot/schema";

type Worn = Character["equipped"][number];
import { qualityText } from "@/lib/format";
import { setHref } from "@/lib/db/catalog-queries";
import { skillIconByName } from "@/lib/icons/skill-icons";
import { GameIcon } from "./game-icon";

const ARMOR: { label: string; match: string[] }[] = [
  { label: "Shoulders", match: ["shoulder"] },
  { label: "Head", match: ["head"] },
  { label: "Chest", match: ["chest"] },
  { label: "Hands", match: ["hand", "glove", "bracer"] },
  { label: "Belt", match: ["belt", "waist"] },
  { label: "Legs", match: ["leg", "pant", "greave"] },
  { label: "Feet", match: ["feet", "foot", "boot", "shoe"] },
];

/**
 * Equipped tab: the paper doll in the game's slot positions, then jewelry,
 * then front and back bars. Skill icons and food come from the first wardrobe
 * setup that saved them — the snapshot has no live action bar of its own.
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
  const worn = equipped.filter((item) => item.bar == null);
  const used = new Set<Worn>();
  const take = (match: string[]) => {
    const found = worn.find((item) => !used.has(item) && match.some((part) => item.slot.toLowerCase().includes(part)));
    if (found) used.add(found);
    return found;
  };

  const shoulders = take(ARMOR[0].match);
  const head = take(ARMOR[1].match);
  const chest = take(ARMOR[2].match);
  const hands = take(ARMOR[3].match);
  const belt = take(ARMOR[4].match);
  const legs = take(ARMOR[5].match);
  const feet = take(ARMOR[6].match);

  const neck = take(["neck"]);
  const rings = worn.filter((item) => !used.has(item) && item.slot.toLowerCase().includes("ring"));
  rings.forEach((item) => used.add(item));
  const jewelry = [neck, rings[0], rings[1]];

  const setup = firstBarSetup(wardrobe);
  const food = setup?.food?.name ? setup.food : firstFood(wardrobe);
  const frontSkills = setup?.bars.find((bar) => bar.bar === "front")?.skills ?? [];
  const backSkills = setup?.bars.find((bar) => bar.bar === "back")?.skills ?? [];
  const barLabel = setup ? barCaption(wardrobe, setup) : null;

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1">
          <GearWell item={shoulders} empty="Shoulders" className="col-start-1 row-start-1" />
          <GearWell item={head} empty="Head" className="col-start-2 row-start-1" />
          <GearWell item={chest} empty="Chest" className="col-start-3 row-start-1" />
          <GearWell item={hands} empty="Hands" className="col-start-1 row-start-2" />
          <div className="col-start-2 row-start-2 row-span-2 flex flex-col justify-center gap-1 rounded border border-border bg-surface px-1.5 py-1">
            {(
              [
                ["Mag", attributes.magicka ?? 0, "text-sky-300"],
                ["HP", attributes.health ?? 0, "text-rose-300"],
                ["Stam", attributes.stamina ?? 0, "text-emerald-400"],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="flex items-baseline justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
                <span className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</span>
              </div>
            ))}
          </div>
          <GearWell item={belt} empty="Belt" className="col-start-3 row-start-2" />
          <GearWell item={legs} empty="Legs" className="col-start-1 row-start-3" />
          <GearWell item={feet} empty="Feet" className="col-start-3 row-start-3" />
        </div>

        <div className="grid grid-cols-3 gap-1">
          {jewelry.map((item, index) => (
            <GearWell key={index} item={item} empty={index === 0 ? "Neck" : "Ring"} />
          ))}
        </div>

        <GearWell item={foodPiece(food)} empty="Food" wide />
      </div>

      <div className="space-y-2">
        {barLabel ? <p className="text-[11px] text-fg-subtle">Skill bar from {barLabel}</p> : (
          <p className="text-[11px] text-fg-subtle">No skill bar in this snapshot.</p>
        )}
        <WeaponBar
          title="Front bar"
          weapons={equipped.filter((item) => item.bar === "front")}
          skills={frontSkills}
        />
        <WeaponBar
          title="Back bar"
          weapons={equipped.filter((item) => item.bar === "back")}
          skills={backSkills}
        />
      </div>
    </div>
  );
}

function foodPiece(food: WardrobeSetup["food"] | null | undefined): Worn | undefined {
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

function GearWell({
  item,
  empty,
  wide = false,
  className = "",
}: {
  item?: Worn;
  empty: string;
  wide?: boolean;
  className?: string;
}) {
  const title = item
    ? [empty, item.name, item.setName, item.trait, item.enchant, ...item.scribing].filter(Boolean).join(" · ")
    : empty;
  const body = (
    <div
      title={title}
      data-slot={empty}
      className={`flex h-full items-center gap-1 rounded border px-1 py-1 ${
        item ? "border-border bg-surface" : "border-dashed border-border/80 bg-transparent"
      } ${wide ? "" : "min-h-[3.4rem] flex-col justify-center text-center"}`}
    >
      {item ? <GameIcon name={item.name} icon={item.icon} size={wide ? 22 : 26} bare /> : null}
      <span className="text-[9px] uppercase tracking-wide text-fg-subtle">{empty}</span>
      <span className={`line-clamp-2 text-[10px] leading-tight ${item ? qualityText(item.quality) : "hidden"}`}>
        {item?.name}
      </span>
    </div>
  );
  if (item?.setName) {
    return (
      <Link href={setHref({ name: item.setName })} className={`${className} min-w-0 hover:opacity-90`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function WeaponBar({
  title,
  weapons,
  skills,
}: {
  title: string;
  weapons: Worn[];
  skills: { name: string; icon?: string | null }[];
}) {
  const slots = skills.length > 0 ? skills : Array.from({ length: 6 }, () => null);
  return (
    <section className="rounded-lg border border-border bg-surface p-2">
      <h2 className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{title}</h2>
      <div className="flex flex-wrap items-center gap-1">
        {weapons.length > 0 ? (
          weapons.map((item, index) => (
            <div key={`${item.slot}-${index}`} className="w-[4.5rem]">
              <GearWell item={item} empty={item.slot} />
            </div>
          ))
        ) : (
          <>
            <EmptySkill label="Main" />
            <EmptySkill label="Off" />
          </>
        )}
        <span className="mx-1 h-8 w-px bg-border" aria-hidden />
        {slots.map((skill, index) =>
          skill ? (
            <span key={`${skill.name}-${index}`} title={skill.name} className="inline-flex">
              <GameIcon name={skill.name} icon={skill.icon || skillIconByName(skill.name)} size={32} />
            </span>
          ) : (
            <EmptySkill key={index} label="" />
          ),
        )}
      </div>
    </section>
  );
}

function EmptySkill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded border border-dashed border-border text-[9px] text-fg-subtle">
      {label}
    </span>
  );
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
        const where = [zone.name, page.name, setup.name].filter(Boolean).join(" · ");
        return where || setup.name || "a wardrobe setup";
      }
    }
  }
  return setup.name || "a wardrobe setup";
}
