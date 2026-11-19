"use client";

import { useEffect, useMemo, useState } from "react";
import { GameIcon } from "@/components/game-icon";
import { Modal } from "@/components/modal";
import { sourceSummary, type GearRole, type OwnedGear, type PlacedPiece } from "@/lib/builds/arrange";
import type { BuildSetOption } from "@/lib/builds/options";
import type { SavedBuild } from "@/lib/builds/saved";
import { traitPlanOf } from "@/lib/builds/saved";
import {
  FRONT_MAIN_WEAPONS,
  FRONT_OFF_WEAPONS,
  isMonsterSet,
  isTwoHandedWeapon,
  setsShareKey,
  weaponLabel,
  type FrontWeapon,
  type SlotKind,
} from "@/lib/builds/slots";
import { ARMOR_WEIGHTS, sameTrait, stepMix, traitFor, traitsFor, type ArmorWeight } from "@/lib/builds/traits";

const ROLES: { role: GearRole; label: string }[] = [
  { role: "body", label: "Body" },
  { role: "monster", label: "Monster" },
  { role: "mythic", label: "Mythic" },
  { role: "front", label: "Front" },
  { role: "back", label: "Back" },
];

const ARMOR_SLOTS: { id: string; label: string }[] = [
  { id: "head", label: "Head" },
  { id: "shoulders", label: "Shoulders" },
  { id: "chest", label: "Chest" },
  { id: "hands", label: "Hands" },
  { id: "waist", label: "Waist" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" },
];

const JEWELRY_SLOTS: { id: string; label: string }[] = [
  { id: "neck", label: "Neck" },
  { id: "ring1", label: "Ring" },
  { id: "ring2", label: "Ring" },
];

const WEIGHT_TEXT: Record<ArmorWeight, string> = {
  heavy: "text-red-400",
  medium: "text-green-400",
  light: "text-blue-400",
};

interface QuickPiece {
  id: string;
  label: string;
  kind: SlotKind;
  role: string;
  setName: string | null;
  icon: string | null;
  summary: string | null;
  mythic: boolean;
  farm: boolean;
}

export function QuickSlot({
  draft,
  placed,
  sets,
  owned,
  onChange,
  onPick,
  onClose,
}: {
  draft: SavedBuild;
  placed: PlacedPiece[];
  sets: BuildSetOption[];
  owned: OwnedGear[];
  onChange: (next: SavedBuild | ((current: SavedBuild) => SavedBuild)) => void;
  onPick: (role: GearRole, option: BuildSetOption | null) => void;
  onClose: () => void;
}) {
  const pieces = useMemo(() => piecesOf(draft, placed), [draft, placed]);
  const [selectedId, setSelectedId] = useState("chest");
  const [roleOpen, setRoleOpen] = useState<GearRole | null>(null);
  const [query, setQuery] = useState("");
  const selected = pieces.find((piece) => piece.id === selectedId) ?? pieces[0] ?? null;

  useEffect(() => {
    if (pieces.some((piece) => piece.id === selectedId)) return;
    setSelectedId(pieces.find((piece) => piece.id === "chest")?.id ?? pieces[0]?.id ?? "chest");
  }, [pieces, selectedId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      const index = pieces.findIndex((piece) => piece.id === selectedId);
      if (index < 0) return;
      const next = pieces[index + (event.key === "ArrowRight" ? 1 : -1)];
      if (next) setSelectedId(next.id);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pieces, selectedId]);

  function chooseTrait(trait: string) {
    if (!selected || selected.mythic) return;
    const group = traitFor(traitPlanOf({ ...draft, slotTraits: {} }), selected.id, selected.kind, selected.role);
    onChange((current) => {
      const next = { ...current.slotTraits };
      if (group && sameTrait(trait, group)) delete next[selected.id];
      else next[selected.id] = trait;
      return { ...current, slotTraits: next };
    });
    const index = pieces.findIndex((piece) => piece.id === selected.id);
    const following = pieces.slice(index + 1).find((piece) => !piece.mythic);
    if (following) setSelectedId(following.id);
  }

  function chooseWeapon(weapon: FrontWeapon | null, hand: "main" | "off") {
    onChange((current) => {
      const next = { ...current };
      if (hand === "off") {
        if (!weapon || isTwoHandedWeapon(weapon)) return current;
        if (!current.frontMain || isTwoHandedWeapon(current.frontMain)) next.frontMain = weapon === "shield" ? "dagger" : weapon;
        next.frontOff = weapon;
      } else if (!weapon) {
        next.frontMain = null;
        next.frontOff = null;
      } else if (isTwoHandedWeapon(weapon)) {
        next.frontMain = weapon;
        next.frontOff = null;
      } else {
        next.frontMain = weapon;
        next.frontOff = current.frontOff && !isTwoHandedWeapon(current.frontOff) ? current.frontOff : weapon;
      }
      const offKind: SlotKind = next.frontOff === "shield" ? "shield" : "oneHand";
      const pinned = next.slotTraits.frontOff;
      if (pinned && !traitsFor(offKind).some((trait) => sameTrait(trait, pinned))) {
        const traits = { ...next.slotTraits };
        delete traits.frontOff;
        next.slotTraits = traits;
      }
      return next;
    });
    if (weapon && isTwoHandedWeapon(weapon)) setSelectedId("frontBar");
    else if (hand === "main" && weapon) setSelectedId("frontMain");
  }

  const aimed = selected ? traitFor(traitPlanOf(draft), selected.id, selected.kind, selected.role) : null;
  const traits = selected && !selected.mythic ? traitsFor(selected.kind) : [];
  const showWeapons = selected ? selected.id.startsWith("front") : false;

  return (
    <Modal title="Quick slot" onClose={onClose} maxWidthClass="max-w-4xl">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {(["heavy", "medium", "light"] as const).map((id) => {
            const row = ARMOR_WEIGHTS.find((entry) => entry.id === id)!;
            return (
            <div key={row.id} className="flex items-center rounded-full border border-border">
              <button
                type="button"
                aria-label={`Fewer ${row.label.toLowerCase()}`}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    ...stepMix({ heavy: current.heavy, medium: current.medium, light: current.light }, row.id, -1),
                  }))
                }
                className="px-2.5 py-1 text-fg-subtle hover:text-fg"
              >
                −
              </button>
              <span className={`min-w-16 text-center text-sm ${WEIGHT_TEXT[row.id]}`}>
                {draft[row.id]} {row.label.toLowerCase()}
              </span>
              <button
                type="button"
                aria-label={`More ${row.label.toLowerCase()}`}
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    ...stepMix({ heavy: current.heavy, medium: current.medium, light: current.light }, row.id, 1),
                  }))
                }
                className="px-2.5 py-1 text-fg-subtle hover:text-fg"
              >
                +
              </button>
            </div>
            );
          })}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {ROLES.map(({ role, label }) => {
              const name = roleName(draft, role);
              const open = roleOpen === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setRoleOpen(open ? null : role);
                    setQuery("");
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-left ${
                    open ? "border-accent/40 bg-accent-soft" : "border-border hover:border-accent/30"
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-fg-subtle">{label}</span>
                  <span className="block max-w-40 truncate text-sm text-fg">{name ?? "Choose"}</span>
                </button>
              );
            })}
          </div>
          {roleOpen ? (
            <SetStrip
              role={roleOpen}
              draft={draft}
              sets={sets}
              owned={owned}
              query={query}
              onQuery={setQuery}
              onPick={(option) => {
                onPick(roleOpen, option);
                setRoleOpen(null);
                setQuery("");
              }}
              onPieces={(count) => onChange((current) => ({ ...current, monsterPieces: count }))}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          {[pieces.filter((piece) => ARMOR_SLOTS.some((slot) => slot.id === piece.id)), pieces.filter((piece) => !ARMOR_SLOTS.some((slot) => slot.id === piece.id))].map(
            (row, index) => (
              <div key={index} className="grid grid-cols-4 gap-1 sm:grid-cols-7">
                {row.map((piece) => {
                  const trait = traitFor(traitPlanOf(draft), piece.id, piece.kind, piece.role);
                  const pinned = Boolean(draft.slotTraits[piece.id]);
                  const on = piece.id === selected?.id;
                  return (
                    <button
                      key={piece.id}
                      type="button"
                      onClick={() => setSelectedId(piece.id)}
                      className={`rounded-lg px-2 py-1.5 text-left ${on ? "bg-surface ring-1 ring-accent/40" : "hover:bg-surface/80"}`}
                    >
                      <span className="block truncate text-[10px] uppercase tracking-wide text-fg-subtle">{piece.label}</span>
                      <span className={`block truncate text-xs ${pinned ? "text-fg" : "text-fg-muted"}`}>
                        {piece.mythic ? "As it is" : trait ?? "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ),
          )}
        </div>

        {selected ? (
          <div className="flex min-h-16 items-center gap-4">
            {selected.icon ? <GameIcon name={selected.setName ?? selected.label} icon={selected.icon} size={44} /> : null}
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{selected.label}</div>
              <div className="truncate text-lg font-medium text-fg">{selected.setName ?? "No set on this piece"}</div>
              {selected.summary ? (
                <div className={`truncate text-sm ${selected.farm ? "text-danger" : "text-fg-muted"}`}>{selected.summary}</div>
              ) : (
                <div className="text-sm text-fg-subtle">Choose a set above, then a trait.</div>
              )}
            </div>
          </div>
        ) : null}

        {showWeapons ? (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wide text-fg-subtle">
              {selected?.id === "frontOff" ? "Off hand" : "Weapon"}
            </span>
            {selected?.id === "frontOff" ? (
              <div className="flex flex-wrap gap-1.5">
                {FRONT_OFF_WEAPONS.map((weapon) => (
                  <WeaponChip
                    key={weapon.id}
                    label={weapon.label}
                    on={draft.frontOff === weapon.id}
                    onClick={() => chooseWeapon(weapon.id, "off")}
                  />
                ))}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <WeaponChip label="Any" on={draft.frontMain == null} onClick={() => chooseWeapon(null, "main")} />
                  {FRONT_MAIN_WEAPONS.filter((weapon) => weapon.hands === "one").map((weapon) => (
                    <WeaponChip
                      key={weapon.id}
                      label={weapon.label}
                      on={draft.frontMain === weapon.id}
                      onClick={() => chooseWeapon(weapon.id, "main")}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FRONT_MAIN_WEAPONS.filter((weapon) => weapon.hands === "two").map((weapon) => (
                    <WeaponChip
                      key={weapon.id}
                      label={weapon.label}
                      on={draft.frontMain === weapon.id}
                      onClick={() => chooseWeapon(weapon.id, "main")}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {selected?.mythic ? (
          <p className="text-sm text-fg-muted">A mythic keeps the trait it already has.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wide text-fg-subtle">Trait</span>
            <div className="flex flex-wrap gap-1.5">
              {traits.map((trait) => (
                <button
                  key={trait}
                  type="button"
                  aria-pressed={aimed === trait}
                  onClick={() => chooseTrait(trait)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    aimed === trait
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-border text-fg-muted hover:border-accent/30 hover:text-fg"
                  }`}
                >
                  {trait}
                </button>
              ))}
            </div>
            <p className="text-xs text-fg-subtle">A trait click sets this piece and moves to the next.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function WeaponChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm ${
        on ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );
}

function SetStrip({
  role,
  draft,
  sets,
  owned,
  query,
  onQuery,
  onPick,
  onPieces,
}: {
  role: GearRole;
  draft: SavedBuild;
  sets: BuildSetOption[];
  owned: OwnedGear[];
  query: string;
  onQuery: (value: string) => void;
  onPick: (option: BuildSetOption | null) => void;
  onPieces: (count: 1 | 2) => void;
}) {
  const options = optionsForRole(role, sets);
  const needle = query.trim().toLowerCase();
  const ownedOptions = options.filter(
    (option) =>
      option.name === roleName(draft, role) ||
      owned.some((item) => (option.setId > 0 && item.setId === option.setId) || setsShareKey(option.keys, item.keys)),
  );
  const shown = needle
    ? options.filter((option) => option.name.toLowerCase().includes(needle)).slice(0, 8)
    : ownedOptions.slice(0, 12);
  return (
    <div className="mt-3 flex flex-col gap-2">
      {role === "monster" ? (
        <div className="flex gap-1.5">
          {([1, 2] as const).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onPieces(count)}
              className={`rounded-full border px-3 py-1 text-sm ${
                draft.monsterPieces === count
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              {count} {count === 1 ? "piece" : "pieces"}
            </button>
          ))}
        </div>
      ) : null}
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              onQuery("");
            }
          if (event.key === "Enter" && shown[0]) {
            event.preventDefault();
            onPick(shown[0]);
          }
        }}
        placeholder={needle || ownedOptions.length > 0 ? "Find another set" : "Find a set"}
        className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent"
      />
      <div className="flex flex-wrap gap-1.5">
        {shown.map((option) => (
          <button
            key={`${option.setId}-${option.name}`}
            type="button"
            onClick={() => onPick(option)}
            className={`max-w-52 truncate rounded-lg border px-3 py-1.5 text-sm ${
              option.name === roleName(draft, role)
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-border text-fg hover:border-accent/30"
            }`}
          >
            {option.name}
          </button>
        ))}
        {roleName(draft, role) ? (
          <button type="button" onClick={() => onPick(null)} className="px-2 text-sm text-fg-subtle hover:text-fg">
            Clear
          </button>
        ) : null}
        {shown.length === 0 ? <span className="text-sm text-fg-subtle">No sets match.</span> : null}
      </div>
    </div>
  );
}

function optionsForRole(role: GearRole, sets: BuildSetOption[]): BuildSetOption[] {
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

function roleName(draft: SavedBuild, role: GearRole): string | null {
  if (role === "body") return draft.bodyName;
  if (role === "monster") return draft.monsterName;
  if (role === "mythic") return draft.mythicName;
  if (role === "front") return draft.frontName;
  return draft.backName;
}

function piecesOf(draft: SavedBuild, placed: PlacedPiece[]): QuickPiece[] {
  const bySlot = new Map(placed.map((piece) => [piece.slot, piece]));
  const slots = [...ARMOR_SLOTS, ...JEWELRY_SLOTS, ...barSlots(bySlot, draft, "front"), ...barSlots(bySlot, draft, "back")];
  return slots.map((slot) => {
    const piece = bySlot.get(slot.id) ?? null;
    const kind = piece?.kind ?? kindFallback(slot.id, draft);
    return {
      id: slot.id,
      label: slot.label,
      kind,
      role: piece?.role ?? "body",
      setName: piece?.setName ?? null,
      icon: piece?.icon ?? null,
      summary: piece ? sourceSummary(piece.source) : null,
      mythic: piece?.role === "mythic",
      farm: piece?.source.kind === "farm",
    };
  });
}

function barSlots(
  bySlot: Map<string, PlacedPiece>,
  draft: SavedBuild,
  bar: "front" | "back",
): { id: string; label: string }[] {
  const two = bySlot.get(`${bar}Bar`);
  if (two) return [{ id: two.slot, label: two.label }];
  const main = bySlot.get(`${bar}Main`);
  const off = bySlot.get(`${bar}Off`);
  if (main || off) {
    return [
      main ? { id: main.slot, label: main.label } : null,
      off ? { id: off.slot, label: off.label } : null,
    ].filter((slot): slot is { id: string; label: string } => slot != null);
  }
  if (bar === "front" && draft.frontMain) {
    if (isTwoHandedWeapon(draft.frontMain)) return [{ id: "frontBar", label: weaponLabel(draft.frontMain) }];
    const offWeapon = draft.frontOff ?? draft.frontMain;
    return [
      { id: "frontMain", label: weaponLabel(draft.frontMain) },
      { id: "frontOff", label: weaponLabel(offWeapon) },
    ];
  }
  return [{ id: bar === "front" ? "frontBar" : "backBar", label: bar === "front" ? "Front bar" : "Back bar" }];
}

function kindFallback(id: string, draft: SavedBuild): SlotKind {
  if (id === "neck") return "neck";
  if (id === "ring1" || id === "ring2") return "ring";
  if (id === "frontOff" || id === "backOff") return draft.frontOff === "shield" ? "shield" : "oneHand";
  if (id === "frontBar" || id === "backBar") return "twoHand";
  if (id === "frontMain" || id === "backMain") return "oneHand";
  return id as SlotKind;
}
