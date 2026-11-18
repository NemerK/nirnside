"use client";

import { useMemo, useState } from "react";
import { arrange, sourceSummary, type ArrangeSet, type GearRole, type PlacedPiece } from "@/lib/builds/arrange";
import type { BuildPageData, BuildSetOption } from "@/lib/builds/options";
import { emptyBuild, type SavedBuild } from "@/lib/builds/saved";

const ROLES: { role: GearRole; label: string; hint: string }[] = [
  { role: "body", label: "Body", hint: "Chest, legs, shoes, belt, gloves" },
  { role: "monster", label: "Monster", hint: "Head, and shoulders when you wear two" },
  { role: "mythic", label: "Mythic", hint: "One item, on its own slot. A ring leaves the other ring free." },
  { role: "front", label: "Front", hint: "Front-bar weapons, then jewelry" },
  { role: "back", label: "Back bar", hint: "Usually an arena two-hander" },
];

const DOLL = ["head", "shoulders", "chest", "hands", "waist", "legs", "feet", "neck", "ring1", "ring2"] as const;

const DOLL_LABEL: Record<(typeof DOLL)[number], string> = {
  head: "Head",
  shoulders: "Shoulders",
  chest: "Chest",
  hands: "Gloves",
  waist: "Belt",
  legs: "Legs",
  feet: "Shoes",
  neck: "Necklace",
  ring1: "Ring",
  ring2: "Ring",
};

function optionsFor(role: GearRole, sets: BuildSetOption[]): BuildSetOption[] {
  if (role === "mythic") return sets.filter((set) => set.mythic);
  if (role === "monster") {
    return sets.filter((set) => !set.mythic && set.category.toLowerCase().includes("monster"));
  }
  if (role === "back") {
    return sets.filter(
      (set) =>
        !set.mythic &&
        (set.kinds.includes("twoHand") || set.kinds.includes("oneHand") || set.category.toLowerCase().includes("arena")),
    );
  }
  return sets.filter((set) => !set.mythic);
}

function findOption(sets: BuildSetOption[], setId: number | null, name: string | null): BuildSetOption | null {
  if (setId != null && setId > 0) {
    const byId = sets.find((set) => set.setId === setId);
    if (byId) return byId;
  }
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return sets.find((set) => set.name.toLowerCase() === key) ?? null;
}

function pieceCount(role: GearRole, option: BuildSetOption, monsterPieces: 1 | 2): number {
  const cap = option.maxEquip ?? (role === "mythic" ? 1 : role === "monster" || role === "back" ? 2 : 5);
  if (role === "mythic") return 1;
  if (role === "monster") return Math.min(monsterPieces, cap);
  if (role === "back") return Math.min(2, cap);
  return Math.min(5, cap);
}

function toArrange(option: BuildSetOption, role: GearRole, pieces: number): ArrangeSet {
  return {
    role,
    name: option.name,
    setId: option.setId > 0 ? option.setId : null,
    keys: option.keys,
    pieces,
    kinds: role === "mythic" ? option.kinds.slice(0, 1) : option.kinds,
    collectedKinds: option.collectedKinds,
    collected: option.collected,
    total: option.total,
    crafted: option.crafted,
    traitsNeeded: option.traitsNeeded,
  };
}

function sourceClass(piece: PlacedPiece): string {
  if (piece.source.kind === "farm") return "text-danger";
  if (piece.source.kind === "owned" && piece.source.traitChangeCrystals == null) return "text-ok";
  return "text-accent";
}

function barLabel(style: "twohand" | "dual" | "shield", which: "Front" | "Back"): string {
  if (style === "dual") return `${which} bar is two one-hand weapons`;
  if (style === "shield") return `${which} bar is a weapon and shield`;
  return `${which} bar is a two-hander`;
}

export function BuildBoard({ data }: { data: BuildPageData }) {
  const [builds, setBuilds] = useState(data.builds);
  const [activeId, setActiveId] = useState<string | null>(data.builds[0]?.id ?? null);
  const [draft, setDraft] = useState<SavedBuild>(() => data.builds[0] ?? blank());
  const [name, setName] = useState(data.builds[0]?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = useMemo(() => {
    const sets: ArrangeSet[] = [];
    const body = findOption(data.sets, draft.bodySetId, draft.bodyName);
    const monster = findOption(data.sets, draft.monsterSetId, draft.monsterName);
    const mythic = findOption(data.sets, draft.mythicSetId, draft.mythicName);
    const front = findOption(data.sets, draft.frontSetId, draft.frontName);
    const back = findOption(data.sets, draft.backSetId, draft.backName);
    if (body) sets.push(toArrange(body, "body", pieceCount("body", body, draft.monsterPieces)));
    if (monster) sets.push(toArrange(monster, "monster", pieceCount("monster", monster, draft.monsterPieces)));
    if (mythic) sets.push(toArrange(mythic, "mythic", 1));
    if (front) sets.push(toArrange(front, "front", pieceCount("front", front, draft.monsterPieces)));
    if (back) sets.push(toArrange(back, "back", pieceCount("back", back, draft.monsterPieces)));
    return arrange(sets, data.owned, data.crafters);
  }, [data, draft]);

  const tally = useMemo(() => {
    const counts = { owned: 0, transmute: 0, craft: 0, farm: 0 };
    for (const piece of chosen.placed) counts[piece.source.kind === "owned" ? "owned" : piece.source.kind] += 1;
    return counts;
  }, [chosen]);

  function selectSaved(build: SavedBuild) {
    setActiveId(build.id);
    setDraft(build);
    setName(build.name);
    setError(null);
  }

  function startNew() {
    const next = blank();
    setActiveId(null);
    setDraft(next);
    setName("");
    setError(null);
  }

  function pick(role: GearRole, option: BuildSetOption | null) {
    setDraft((current) => ({
      ...current,
      ...(role === "body" ? { bodySetId: option?.setId ?? null, bodyName: option?.name ?? null } : {}),
      ...(role === "monster"
        ? {
            monsterSetId: option?.setId ?? null,
            monsterName: option?.name ?? null,
            monsterPieces: option?.maxEquip === 1 ? 1 : current.monsterPieces,
          }
        : {}),
      ...(role === "mythic" ? { mythicSetId: option?.setId ?? null, mythicName: option?.name ?? null } : {}),
      ...(role === "front" ? { frontSetId: option?.setId ?? null, frontName: option?.name ?? null } : {}),
      ...(role === "back" ? { backSetId: option?.setId ?? null, backName: option?.name ?? null } : {}),
    }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = { ...draft, name: name.trim() || suggestedName(draft) };
    try {
      const res = await fetch(activeId ? `/api/builds/${activeId}` : "/api/builds", {
        method: activeId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string; build?: SavedBuild; builds?: SavedBuild[] };
      if (!res.ok || !json.build) {
        setError(json.error ?? "Could not save the build.");
        return;
      }
      setBuilds(json.builds ?? builds);
      setActiveId(json.build.id);
      setDraft(json.build);
      setName(json.build.name);
    } catch {
      setError("Could not save the build.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!activeId) {
      startNew();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/builds/${activeId}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string; builds?: SavedBuild[] };
      if (!res.ok) {
        setError(json.error ?? "Could not delete the build.");
        return;
      }
      setBuilds(json.builds ?? []);
      startNew();
    } catch {
      setError("Could not delete the build.");
    } finally {
      setBusy(false);
    }
  }

  const bySlot = new Map(chosen.placed.map((piece) => [piece.slot, piece]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startNew}
          className={`rounded-lg border px-3 py-1.5 text-sm ${activeId ? "border-border text-fg-muted hover:text-fg" : "border-accent/40 bg-accent-soft text-accent"}`}
        >
          New build
        </button>
        {builds.map((build) => (
          <button
            key={build.id}
            type="button"
            onClick={() => selectSaved(build)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              build.id === activeId ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg"
            }`}
          >
            {build.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {ROLES.map(({ role, label, hint }) => (
          <SetPicker
            key={role}
            label={label}
            hint={hint}
            selected={selectedName(draft, role)}
            options={optionsFor(role, data.sets)}
            onPick={(option) => pick(role, option)}
          />
        ))}
      </div>

      {draft.monsterName ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-fg-muted">Monster pieces</span>
          {([1, 2] as const).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, monsterPieces: count }))}
              className={`rounded-lg border px-3 py-1 ${
                draft.monsterPieces === count ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-fg-muted"
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          <span className="text-fg-muted">Build name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={suggestedName(draft) || "Name this build"}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-fg outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-lg border border-border px-4 py-2 text-sm text-fg-muted hover:text-fg disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {chosen.placed.length === 0 ? (
        <p className="text-sm text-fg-muted">Choose a set to see where each piece goes.</p>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <Count label="Already made" value={tally.owned} className="text-ok" />
            <Count label="Transmute" value={tally.transmute} className="text-accent" />
            <Count label="Craft" value={tally.craft} className="text-accent" />
            <Count label="Not obtained" value={tally.farm} className="text-danger" />
          </div>
          {draft.frontName || draft.backName ? (
            <p className="text-sm text-fg-muted">
              {[draft.frontName ? barLabel(chosen.frontStyle, "Front") : null, draft.backName ? barLabel(chosen.backStyle, "Back") : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {chosen.short.length > 0 ? (
            <p className="text-sm text-danger">
              {chosen.short.map((row) => `${row.setName} wears ${row.have} of ${row.want}`).join(" · ")}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {DOLL.map((id) => (
              <SlotCard key={id} label={DOLL_LABEL[id]} piece={bySlot.get(id) ?? null} />
            ))}
            {chosen.placed
              .filter((piece) => !DOLL.includes(piece.slot as (typeof DOLL)[number]))
              .map((piece) => (
                <SlotCard key={piece.slot} label={piece.label} piece={piece} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Count({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className="rounded-lg border border-border bg-surface-2/40 px-3 py-1.5">
      <span className={`font-medium ${className}`}>{value}</span> <span className="text-fg-muted">{label}</span>
    </span>
  );
}

function SlotCard({ label, piece }: { label: string; piece: PlacedPiece | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-fg-subtle">{label}</span>
        {piece ? <span className="text-xs text-fg-subtle">{roleLabel(piece.role)}</span> : null}
      </div>
      {piece ? (
        <>
          <p className="mt-1 text-sm font-medium text-fg">{piece.setName}</p>
          <p className={`text-sm ${sourceClass(piece)}`}>{sourceSummary(piece.source)}</p>
          {piece.why ? <p className="mt-1 text-xs text-fg-muted">{piece.why}</p> : null}
          {piece.aside ? <p className="mt-1 text-xs text-fg-muted">{piece.aside}</p> : null}
        </>
      ) : (
        <p className="mt-1 text-sm text-fg-subtle">Empty</p>
      )}
    </div>
  );
}

function roleLabel(role: GearRole): string {
  if (role === "body") return "Body";
  if (role === "monster") return "Monster";
  if (role === "mythic") return "Mythic";
  if (role === "front") return "Front";
  return "Back bar";
}

function SetPicker({
  label,
  hint,
  selected,
  options,
  onPick,
}: {
  label: string;
  hint: string;
  selected: string | null;
  options: BuildSetOption[];
  onPick: (option: BuildSetOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const shown = options
    .filter((option) => option.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 40);
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-sm font-medium text-fg">{label}</div>
      <p className="mb-2 text-xs text-fg-muted">{hint}</p>
      <input
        value={open ? query : selected ?? ""}
        placeholder="Search sets"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onChange={(event) => {
          setOpen(true);
          setQuery(event.target.value);
        }}
        className="w-full rounded-lg border border-border bg-surface-2/40 px-2 py-1.5 text-sm text-fg outline-none focus:border-accent"
      />
      {selected ? (
        <button type="button" onClick={() => onPick(null)} className="mt-1 text-xs text-fg-muted hover:text-fg">
          Clear
        </button>
      ) : null}
      {open ? (
        <ul className="mt-2 max-h-48 overflow-auto rounded-lg border border-border">
          {shown.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-fg-muted">No sets match.</li>
          ) : (
            shown.map((option) => (
              <li key={`${option.setId}-${option.name}`}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(option);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full flex-col px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="text-sm text-fg">{option.name}</span>
                  <span className="text-[11px] text-fg-subtle">
                    {option.category}
                    {option.total > 0 ? ` · ${option.collected}/${option.total} collected` : ""}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function selectedName(draft: SavedBuild, role: GearRole): string | null {
  if (role === "body") return draft.bodyName;
  if (role === "monster") return draft.monsterName;
  if (role === "mythic") return draft.mythicName;
  if (role === "front") return draft.frontName;
  return draft.backName;
}

function suggestedName(draft: SavedBuild): string {
  return [draft.bodyName, draft.frontName, draft.mythicName].filter(Boolean).join(" / ");
}

function blank(): SavedBuild {
  return { id: "", name: "", createdAt: 0, ...emptyBuild() };
}
