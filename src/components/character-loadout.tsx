import Link from "next/link";
import type { Character, Wardrobe, WardrobeSetup } from "@/lib/snapshot/schema";
import { setHref } from "@/lib/db/catalog-queries";
import { skillIconByName } from "@/lib/icons/skill-icons";
import { GameIcon } from "./game-icon";

type Worn = Character["equipped"][number];

/**
 * Paper doll in the character-sheet order: helm centered above the body,
 * shoulders and chest at the shoulders, hands and belt, legs and feet.
 * Accessories, then weapons, then the two skill bars.
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

  const shoulders = take(["shoulder"]);
  const head = take(["head"]);
  const chest = take(["chest"]);
  const hands = take(["hand", "glove", "bracer"]);
  const belt = take(["belt", "waist"]);
  const legs = take(["leg", "pant", "greave"]);
  const feet = take(["feet", "foot", "boot", "shoe"]);
  const neck = take(["neck"]);
  const rings = worn.filter((item) => !used.has(item) && item.slot.toLowerCase().includes("ring"));
  rings.forEach((item) => used.add(item));

  const setup = firstBarSetup(wardrobe);
  const food = setup?.food?.name ? setup.food : firstFood(wardrobe);
  const frontSkills = setup?.bars.find((bar) => bar.bar === "front")?.skills ?? [];
  const backSkills = setup?.bars.find((bar) => bar.bar === "back")?.skills ?? [];
  const barLabel = setup ? barCaption(wardrobe, setup) : null;
  const frontWeapons = equipped.filter((item) => item.bar === "front");
  const backWeapons = equipped.filter((item) => item.bar === "back");

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <div>
        <div className="mb-1 flex justify-center">
          <GearSlot item={head} label="Head" />
        </div>
        <div className="grid grid-cols-2 gap-x-10 gap-y-1">
          <GearSlot item={shoulders} label="Shoulders" />
          <GearSlot item={chest} label="Chest" />
          <GearSlot item={hands} label="Hands" />
          <GearSlot item={belt} label="Belt" />
          <GearSlot item={legs} label="Legs" />
          <GearSlot item={feet} label="Feet" />
        </div>

        <h2 className="mb-1 mt-3 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Accessories</h2>
        <div className="grid grid-cols-3 gap-1">
          <GearSlot item={neck} label="Neck" />
          <GearSlot item={rings[0]} label="Ring" />
          <GearSlot item={rings[1]} label="Ring" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1">
          {(
            [
              ["Mag", attributes.magicka ?? 0, "text-sky-300"],
              ["Health", attributes.health ?? 0, "text-rose-300"],
              ["Stamina", attributes.stamina ?? 0, "text-emerald-400"],
            ] as const
          ).map(([label, value, tone]) => (
            <div key={label} className="rounded border border-border bg-surface px-1.5 py-1 text-center">
              <div className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</div>
              <div className="text-[9px] uppercase tracking-wide text-fg-subtle">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-1">
          <GearSlot item={foodPiece(food)} label="Food" wide />
        </div>
      </div>

      <div className="space-y-3">
        <section>
          <h2 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Weapons</h2>
          <div className="flex flex-wrap gap-4">
            <WeaponPair title="Front" items={frontWeapons} />
            <WeaponPair title="Back" items={backWeapons} />
          </div>
        </section>
        <section>
          <h2 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
            {barLabel ? `Skills · ${barLabel}` : "Skills"}
          </h2>
          {!barLabel ? <p className="mb-1 text-[11px] text-fg-subtle">No skill bar in this snapshot.</p> : null}
          <SkillBar title="Front bar" skills={frontSkills} />
          <div className="mt-1.5">
            <SkillBar title="Back bar" skills={backSkills} />
          </div>
        </section>
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

function GearSlot({ item, label, wide = false }: { item?: Worn; label: string; wide?: boolean }) {
  const title = item
    ? [label, item.name, item.setName, item.trait, item.enchant, ...item.scribing].filter(Boolean).join(" · ")
    : label;
  const body = (
    <div title={title} data-slot={label} className={wide ? "flex items-center gap-2" : "flex flex-col items-center"}>
      <span
        className={`flex items-center justify-center rounded border-2 bg-surface ${wide ? "h-10 w-10" : "h-14 w-14"} ${
          item ? qualityBorder(item.quality) : "border-dashed border-border"
        }`}
      >
        {item?.icon ? <GameIcon name={item.name} icon={item.icon} size={wide ? 32 : 44} bare /> : null}
      </span>
      <span className={`text-center leading-tight ${wide ? "min-w-0" : "mt-0.5 w-14"}`}>
        <span className="block truncate text-[9px] uppercase tracking-wide text-fg-subtle">{label}</span>
        {item ? <span className="block truncate text-[10px] text-fg">{item.name}</span> : null}
      </span>
    </div>
  );
  if (item?.setName) {
    return (
      <Link href={setHref({ name: item.setName })} className="hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}

function WeaponPair({ title, items }: { title: string; items: Worn[] }) {
  const main = items.find((item) => item.slot.toLowerCase().includes("main"));
  const off = items.find((item) => item.slot.toLowerCase().includes("off"));
  const rest = items.filter((item) => item !== main && item !== off);
  const slots = [main, off, ...rest].slice(0, 2);
  while (slots.length < 2) slots.push(undefined);
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-fg-subtle">{title}</div>
      <div className="flex gap-1">
        {slots.map((item, index) => (
          <GearSlot key={index} item={item} label={index === 0 ? "Main" : "Off"} />
        ))}
      </div>
    </div>
  );
}

function SkillBar({ title, skills }: { title: string; skills: { name: string; icon?: string | null }[] }) {
  const slots = Array.from({ length: 6 }, (_, index) => skills[index] ?? null);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 text-[10px] uppercase tracking-wide text-fg-subtle">{title.replace(" bar", "")}</span>
      {slots.map((skill, index) => {
        const ultimate = index === 5;
        return skill ? (
          <span key={`${skill.name}-${index}`} title={skill.name} className={ultimate ? "rounded border-2 border-sky-400/80" : ""}>
            <GameIcon name={skill.name} icon={skill.icon || skillIconByName(skill.name)} size={36} />
          </span>
        ) : (
          <span
            key={index}
            className={`inline-flex h-9 w-9 rounded border ${ultimate ? "border-2 border-sky-400/40" : "border-dashed border-border"}`}
            title={ultimate ? "Ultimate" : `Skill ${index + 1}`}
          />
        );
      })}
    </div>
  );
}

function qualityBorder(quality: Worn["quality"]): string {
  switch (quality) {
    case "mythic":
      return "border-orange-400";
    case "legendary":
      return "border-amber-300";
    case "epic":
      return "border-violet-400";
    case "superior":
      return "border-sky-400";
    case "fine":
      return "border-emerald-500";
    default:
      return "border-border";
  }
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
