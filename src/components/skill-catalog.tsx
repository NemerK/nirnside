"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ESO_CLASSES } from "@/lib/classes";
import { SKILL_CATEGORY_ORDER } from "@/lib/skills/present";
import { GameIcon } from "./game-icon";

export interface SkillCatalogItem {
  id: string;
  name: string;
  href: string;
  category: string;
  className: string | null;
  icon: string | null;
  owned: boolean;
}

/** Skill-window order inside a category, when the game has one. */
const LINE_ORDER: Record<string, string[]> = {
  Weapon: ["Two Handed", "One Hand and Shield", "Dual Wield", "Bow", "Destruction Staff", "Restoration Staff"],
  Armor: ["Light Armor", "Medium Armor", "Heavy Armor"],
  Guild: ["Fighters Guild", "Mages Guild", "Undaunted", "Thieves Guild", "Dark Brotherhood", "Psijic Order"],
  World: ["Soul Magic", "Legerdemain", "Vampire", "Werewolf"],
  "Alliance War": ["Assault", "Support"],
  Craft: ["Blacksmithing", "Clothing", "Woodworking", "Jewelry Crafting", "Provisioning", "Enchanting", "Alchemy"],
};

/**
 * Skills & Morphs in the same groups as the in-game skill window:
 * Class (by class), Weapon, Armor, World, Guild, Alliance War, Racial, Craft, Scribing.
 */
export function SkillCatalog({ items }: { items: SkillCatalogItem[] }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();

  const sections = useMemo(() => {
    const visible = query
      ? items.filter((item) => item.name.toLowerCase().includes(query) || (item.className ?? "").toLowerCase().includes(query))
      : items;
    const byCategory = new Map<string, SkillCatalogItem[]>();
    for (const item of visible) {
      const key = item.category || "Other";
      const list = byCategory.get(key) ?? [];
      list.push(item);
      byCategory.set(key, list);
    }
    const names = [...byCategory.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return names.map((name) => ({ name, lines: byCategory.get(name)!.slice().sort(byLine) }));
  }, [items, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mb-4 shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search skill lines…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
        />
      </div>
      {sections.length === 0 ? (
        <p className="text-sm text-fg-muted">No skill lines match.</p>
      ) : (
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-6">
          {sections.map((section) => (
            <section key={section.name}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{section.name}</h2>
              {section.name === "Class" ? (
                <ClassGroups lines={section.lines} />
              ) : (
                <LineGrid lines={section.lines} />
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassGroups({ lines }: { lines: SkillCatalogItem[] }) {
  const groups = new Map<string, SkillCatalogItem[]>();
  for (const line of lines) {
    const key = line.className?.trim() || "Class";
    const list = groups.get(key) ?? [];
    list.push(line);
    groups.set(key, list);
  }
  const names = [...groups.keys()].sort((a, b) => classRank(a) - classRank(b) || a.localeCompare(b));
  return (
    <div className="space-y-4">
      {names.map((name) => (
        <div key={name}>
          <h3 className="mb-1.5 text-sm font-medium text-fg">{name}</h3>
          <LineGrid lines={groups.get(name)!.slice().sort(byLine)} />
        </div>
      ))}
    </div>
  );
}

function LineGrid({ lines }: { lines: SkillCatalogItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {lines.map((line) => (
        <li key={line.id}>
          <Link
            href={line.href}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 hover:border-accent/50"
          >
            <GameIcon name={line.name} icon={line.icon} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm text-fg">{line.name}</span>
            {line.owned ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ok" title="Discovered" /> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function rank(category: string): number {
  const index = SKILL_CATEGORY_ORDER.indexOf(category);
  return index < 0 ? SKILL_CATEGORY_ORDER.length : index;
}

function classRank(name: string): number {
  const index = (ESO_CLASSES as readonly string[]).indexOf(name);
  return index < 0 ? ESO_CLASSES.length : index;
}

function byLine(a: SkillCatalogItem, b: SkillCatalogItem): number {
  const mastery = Number(b.name === "Class Mastery") - Number(a.name === "Class Mastery");
  if (mastery !== 0) return -mastery;
  const order = LINE_ORDER[a.category];
  if (order) {
    const ia = order.indexOf(a.name);
    const ib = order.indexOf(b.name);
    const ra = ia < 0 ? order.length : ia;
    const rb = ib < 0 ? order.length : ib;
    if (ra !== rb) return ra - rb;
  }
  return a.name.localeCompare(b.name);
}
