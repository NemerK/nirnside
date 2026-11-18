"use client";

import { useMemo, useState } from "react";
import { arrange, type ArrangeSet, type FrontBarWeapons, type GearRole, type PlacedPiece, sourceSummary } from "@/lib/builds/arrange";
import { GameIcon } from "@/components/game-icon";
import type { BuildPageData, BuildSetOption } from "@/lib/builds/options";
import { emptyBuild, type SavedBuild } from "@/lib/builds/saved";
import {
  FRONT_MAIN_WEAPONS,
  FRONT_OFF_WEAPONS,
  isMonsterSet,
  isTwoHandedWeapon,
  kindsForRole,
  parseFrontWeapon,
} from "@/lib/builds/slots";

const ROLES: { role: GearRole; label: string; hint: string }[] = [
  { role: "body", label: "Body", hint: "Chest, hands, waist, legs, and feet" },
  { role: "monster", label: "Monster", hint: "Head, and shoulders when you wear two" },
  { role: "mythic", label: "Mythic", hint: "One item, on its own slot. A ring leaves the other ring free." },
  { role: "front", label: "Front", hint: "Weapons you choose, then jewelry" },
  { role: "back", label: "Back bar", hint: "Usually an arena two-hander" },
];

/** Armor, then jewelry, in the order the inventory paper doll uses. */
const ARMOR = [
  { id: "head", label: "Head" },
  { id: "shoulders", label: "Shoulders" },
  { id: "chest", label: "Chest" },
  { id: "hands", label: "Hands" },
  { id: "waist", label: "Waist" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" },
] as const;

const JEWELRY = [
  { id: "neck", label: "Necklace" },
  { id: "ring1", label: "Ring" },
  { id: "ring2", label: "Ring" },
] as const;

const PLACED_IDS = new Set<string>([
  ...ARMOR.map((slot) => slot.id),
  ...JEWELRY.map((slot) => slot.id),
  "frontBar",
  "frontMain",
  "frontOff",
  "backBar",
  "backMain",
  "backOff",
]);

function optionsFor(role: GearRole, sets: BuildSetOption[]): BuildSetOption[] {
  if (role === "mythic") return sets.filter((set) => set.mythic);
  if (role === "monster") return sets.filter((set) => isMonsterSet(set));
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
    kinds: kindsForRole(role, option.kinds, option.name),
    collectedKinds: option.collectedKinds,
    icons: option.icons,
    collectedWeapons: option.collectedWeapons,
    weaponIcons: option.weaponIcons,
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
    const weapons: FrontBarWeapons | null = draft.frontMain
      ? { main: draft.frontMain, off: isTwoHandedWeapon(draft.frontMain) ? null : draft.frontOff }
      : null;
    return arrange(sets, data.owned, data.crafters, weapons);
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
            footer={role === "front" ? <FrontWeapons draft={draft} onChange={setDraft} /> : undefined}
            pieces={
              role === "monster"
                ? {
                    count: draft.monsterPieces,
                    max: findOption(data.sets, draft.monsterSetId, draft.monsterName)?.maxEquip ?? 2,
                    onChange: (count) => setDraft((current) => ({ ...current, monsterPieces: count })),
                  }
                : undefined
            }
          />
        ))}
      </div>

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
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <Count label="Already made" value={tally.owned} className="text-ok" />
            <Count label="Transmute" value={tally.transmute} className="text-accent" />
            <Count label="Craft" value={tally.craft} className="text-accent" />
            <Count label="Not obtained" value={tally.farm} className="text-danger" />
          </div>
          {chosen.short.length > 0 ? (
            <p className="text-sm text-danger">
              {chosen.short.map((row) => `${row.setName} wears ${row.have} of ${row.want}`).join(" · ")}
            </p>
          ) : null}
        </div>
      )}
      <PaperDoll placed={chosen.placed} />
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

function PaperDoll({ placed }: { placed: PlacedPiece[] }) {
  const bySlot = new Map(placed.map((piece) => [piece.slot, piece]));
  const front = weaponBar(bySlot, "front");
  const back = weaponBar(bySlot, "back");
  const extra = placed.filter((piece) => !PLACED_IDS.has(piece.slot));
  const [head, ...armor] = ARMOR;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-border bg-surface px-3 py-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <SlotCard label={head.label} piece={bySlot.get(head.id) ?? null} />
          </div>
          {armor.map((slot) => (
            <SlotCard key={slot.id} label={slot.label} piece={bySlot.get(slot.id) ?? null} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-2">
          {JEWELRY.map((slot) => (
            <SlotCard key={slot.id} label={slot.label} piece={bySlot.get(slot.id) ?? null} />
          ))}
        </div>
      </section>
      <WeaponColumn title="Front bar" bar={front} />
      <WeaponColumn title="Back bar" bar={back} />
      {extra.length > 0 ? (
        <div className="grid gap-2 lg:col-span-3 sm:grid-cols-2">
          {extra.map((piece) => (
            <SlotCard key={piece.slot} label={piece.label} piece={piece} detail={weaponDetail(piece)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WeaponColumn({ title, bar }: { title: string; bar: WeaponBarSlots }) {
  return (
    <section className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <h2 className="px-0.5 text-xs font-medium uppercase tracking-wide text-fg-subtle">{title}</h2>
      <div className="mt-2 flex flex-col gap-2">
        <SlotCard label="Main hand" piece={bar.main} detail={weaponDetail(bar.main)} />
        <SlotCard label="Off hand" piece={bar.blocked ? null : bar.off} detail={bar.blocked ? null : weaponDetail(bar.off)} blocked={bar.blocked} />
      </div>
    </section>
  );
}

interface WeaponBarSlots {
  main: PlacedPiece | null;
  off: PlacedPiece | null;
  blocked: boolean;
}

function weaponBar(bySlot: Map<string, PlacedPiece>, bar: "front" | "back"): WeaponBarSlots {
  const twoHand = bySlot.get(bar === "front" ? "frontBar" : "backBar") ?? null;
  if (twoHand) return { main: twoHand, off: null, blocked: true };
  return {
    main: bySlot.get(bar === "front" ? "frontMain" : "backMain") ?? null,
    off: bySlot.get(bar === "front" ? "frontOff" : "backOff") ?? null,
    blocked: false,
  };
}

/** A chosen weapon type, such as Inferno Staff. Generic bar names stay on the slot label. */
function weaponDetail(piece: PlacedPiece | null): string | null {
  if (!piece || /\b(hand|bar)\b/i.test(piece.label)) return null;
  return piece.label;
}

function SlotCard({
  label,
  piece,
  detail,
  blocked = false,
}: {
  label: string;
  piece: PlacedPiece | null;
  detail?: string | null;
  blocked?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2">
      {piece ? (
        <GameIcon name={piece.setName} icon={piece.icon} size={36} />
      ) : (
        <span className="h-9 w-9 shrink-0 rounded-md border border-border bg-surface-2/40" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</span>
          {piece && roleLabel(piece.role).toLowerCase() !== label.toLowerCase() ? (
            <span className="text-[10px] uppercase tracking-wide text-fg-subtle">{roleLabel(piece.role)}</span>
          ) : null}
        </div>
        {piece ? (
          <>
            <p className="line-clamp-2 text-sm leading-snug text-fg">{piece.setName}</p>
            {detail ? <p className="truncate text-xs text-fg-muted">{detail}</p> : null}
            <p className={`line-clamp-2 text-xs leading-snug ${sourceClass(piece)}`}>{sourceSummary(piece.source)}</p>
            {piece.aside ? <p className="mt-0.5 text-xs leading-snug text-fg-muted">{piece.aside}</p> : null}
          </>
        ) : (
          <p className="text-sm text-fg-subtle">{blocked ? "Blocked" : "Empty"}</p>
        )}
      </div>
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

function FrontWeapons({
  draft,
  onChange,
}: {
  draft: SavedBuild;
  onChange: (next: SavedBuild) => void;
}) {
  const main = draft.frontMain;
  const twoHanded = main != null && isTwoHandedWeapon(main);
  const setMain = (value: string) => {
    const next = parseFrontWeapon(value);
    if (!next) {
      onChange({ ...draft, frontMain: null, frontOff: null });
      return;
    }
    if (isTwoHandedWeapon(next)) {
      onChange({ ...draft, frontMain: next, frontOff: null });
      return;
    }
    const off = draft.frontOff && !isTwoHandedWeapon(draft.frontOff) ? draft.frontOff : next;
    onChange({ ...draft, frontMain: next, frontOff: off });
  };
  const setOff = (value: string) => {
    const next = parseFrontWeapon(value);
    if (!next || isTwoHandedWeapon(next)) return;
    onChange({ ...draft, frontOff: next });
  };
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label className="block text-xs text-fg-muted">
        Main hand
        <select
          value={main ?? ""}
          onChange={(event) => setMain(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-fg"
        >
          <option value="">Any</option>
          {FRONT_MAIN_WEAPONS.map((weapon) => (
            <option key={weapon.id} value={weapon.id}>
              {weapon.label}
            </option>
          ))}
        </select>
      </label>
      <label className={`block text-xs ${twoHanded ? "text-fg-subtle" : "text-fg-muted"}`}>
        Off hand
        <select
          value={twoHanded ? "" : (draft.frontOff ?? "")}
          disabled={!main || twoHanded}
          onChange={(event) => setOff(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm text-fg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {twoHanded ? <option value="">Blocked</option> : null}
          {!main ? <option value="">Any</option> : null}
          {main && !twoHanded
            ? FRONT_OFF_WEAPONS.map((weapon) => (
                <option key={weapon.id} value={weapon.id}>
                  {weapon.label}
                </option>
              ))
            : null}
        </select>
      </label>
    </div>
  );
}

function SetPicker({
  label,
  hint,
  selected,
  options,
  onPick,
  pieces,
  footer,
}: {
  label: string;
  hint: string;
  selected: string | null;
  options: BuildSetOption[];
  onPick: (option: BuildSetOption | null) => void;
  pieces?: { count: 1 | 2; max: number; onChange: (count: 1 | 2) => void };
  footer?: React.ReactNode;
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
      {pieces ? (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="text-fg-muted">Pieces</span>
          {([1, 2] as const).map((count) => {
            const disabled = count > pieces.max;
            const active = !disabled && Math.min(pieces.count, pieces.max) === count;
            return (
              <button
                key={count}
                type="button"
                disabled={disabled}
                onClick={() => pieces.onChange(count)}
                className={`rounded-md border px-2.5 py-0.5 ${
                  active ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-fg-muted"
                } disabled:opacity-40`}
              >
                {count}
              </button>
            );
          })}
        </div>
      ) : null}
      {footer}
      <div className="relative">
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
        {open ? (
          <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-bg-elev shadow-lg">
            {shown.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-fg-muted">No sets match.</li>
            ) : (
              shown.map((option) => (
                <li key={`${option.setId}-${option.name}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
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
      {selected ? (
        <button type="button" onClick={() => onPick(null)} className="mt-1 text-xs text-fg-muted hover:text-fg">
          Clear
        </button>
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
