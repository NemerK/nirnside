"use client";

import { useMemo, useState } from "react";
import { Archive, Search, X } from "lucide-react";
import type { Character } from "@/lib/snapshot/schema";
import type { Role, RoleAssignments } from "@/lib/roles/types";
import { filterCharacters, rolesForCharacter } from "@/lib/roles/filter";
import { CharacterCard } from "./character-card";
import { GameIcon } from "./game-icon";
import { Badge, Card, PageScroll, StickyMenu } from "./ui";

/** In-game class icon (.dds) per class, served through our icon proxy. */
const CLASS_ICONS: Record<string, string> = {
  Dragonknight: "/esoui/art/icons/class/class_dragonknight.dds",
  Sorcerer: "/esoui/art/icons/class/class_sorcerer.dds",
  Nightblade: "/esoui/art/icons/class/class_nightblade.dds",
  Templar: "/esoui/art/icons/class/class_templar.dds",
  Warden: "/esoui/art/icons/class/class_warden.dds",
  Necromancer: "/esoui/art/icons/class/class_necromancer.dds",
  Arcanist: "/esoui/art/icons/class/class_arcanist.dds",
};

function classIcon(className: string): string | undefined {
  return CLASS_ICONS[className];
}

export function CharacterRoster({
  characters,
  archived = [],
  roles,
  assignments,
}: {
  characters: Character[];
  archived?: Character[];
  roles: Role[];
  assignments: RoleAssignments;
}) {
  const [q, setQ] = useState("");
  const [className, setClassName] = useState("");
  const [race, setRace] = useState("");
  const [role, setRole] = useState("");

  const all = useMemo(() => [...characters, ...archived], [characters, archived]);
  const classes = useMemo(() => [...new Set(all.map((c) => c.class).filter(Boolean))].sort(), [all]);
  const races = useMemo(() => [...new Set(all.map((c) => c.race).filter(Boolean))].sort(), [all]);

  const filters = {
    q,
    className: className || undefined,
    race: race || undefined,
    role: role || undefined,
  };
  const liveShown = filterCharacters(characters, roles, assignments, filters);
  const archivedShown = filterCharacters(archived, roles, assignments, filters);
  const hasFilters = !!q.trim() || !!className || !!race || !!role;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickyMenu className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, class, race, role…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <ClassPicker classes={classes} value={className} onChange={setClassName} />
        <FilterSelect label="Race" value={race} onChange={setRace} options={races} />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={`rounded-lg border bg-surface py-2 pl-2.5 pr-7 text-sm focus:border-accent focus:outline-none ${
            role ? "border-accent/50 text-fg" : "border-border text-fg-muted"
          }`}
        >
          <option value="">Role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
          <option value="none">Unassigned</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setClassName("");
              setRace("");
              setRole("");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm text-fg-muted hover:text-fg"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </StickyMenu>

      <PageScroll>
      {liveShown.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface/70 px-4 py-8 text-center text-sm text-fg-muted">
          {characters.length === 0 ? "No live characters." : "No characters match those filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {liveShown.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              assigned={rolesForCharacter(c.id, roles, assignments)}
              roles={roles}
            />
          ))}
        </div>
      )}
      {hasFilters && (
        <p className="mt-3 text-xs text-fg-subtle">
          Showing {liveShown.length + archivedShown.length} of {all.length}
        </p>
      )}

      {archived.length > 0 && (
        <section id="archive" className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <Archive className="h-4 w-4 text-fg-subtle" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">Archive</h2>
            <Badge tone="muted">{archivedShown.length}</Badge>
          </div>
          <Card className="mb-4 px-4 py-3 text-sm text-fg-muted">
            These characters are gone from the live ESO roster. Their last snapshot stays here so the current roster
            stays honest — last-known bags and gold are not mixed into Inventory or the account total.
          </Card>
          {archivedShown.length === 0 ? (
            <p className="text-sm text-fg-muted">No archived characters match those filters.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archivedShown.map((c) => (
                <CharacterCard
                  key={c.id}
                  character={c}
                  assigned={rolesForCharacter(c.id, roles, assignments)}
                  roles={roles}
                />
              ))}
            </div>
          )}
        </section>
      )}
      </PageScroll>
    </div>
  );
}

/** One-click class filter: an icon per class present on the roster. */
function ClassPicker({
  classes,
  value,
  onChange,
}: {
  classes: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (classes.length === 0) return null;
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Filter by class">
      {classes.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            title={c}
            aria-pressed={active}
            onClick={() => onChange(active ? "" : c)}
            className={`flex items-center justify-center rounded-lg border p-1 transition ${
              active ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong"
            }`}
          >
            <GameIcon name={c} icon={classIcon(c)} size={26} className={active ? "" : "opacity-80"} />
            <span className="sr-only">{c}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border bg-surface py-2 pl-2.5 pr-7 text-sm focus:border-accent focus:outline-none ${
        value ? "border-accent/50 text-fg" : "border-border text-fg-muted"
      }`}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
