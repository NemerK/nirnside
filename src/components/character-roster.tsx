"use client";

import { useMemo, useState } from "react";
import { Archive, Search, X } from "lucide-react";
import type { Character } from "@/lib/snapshot/schema";
import type { Role, RoleAssignments } from "@/lib/roles/types";
import { filterCharacters, rolesForCharacter } from "@/lib/roles/filter";
import { CharacterCard } from "./character-card";
import { Badge, Card } from "./ui";

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
    <div>
      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2 bg-bg/90 py-3 backdrop-blur-md">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, class, race, role…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <FilterSelect label="Class" value={className} onChange={setClassName} options={classes} />
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
      </div>

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
