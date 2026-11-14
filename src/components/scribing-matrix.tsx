"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { GameIcon } from "@/components/game-icon";
import { PageScroll, StickyMenu } from "@/components/ui";
import { plannerGrimoireIcon, plannerScriptIcon } from "@/lib/icons/planner-icons";

export interface ScriptLite {
  id: string;
  name: string;
  effect: string;
  slot?: "focus" | "signature" | "affix";
  icon?: string | null;
}
export interface GrimoireLite {
  id: string;
  name: string;
  skillLine: string;
  description: string;
  icon?: string | null;
  focus: ScriptLite[];
  signature: ScriptLite[];
  affix: ScriptLite[];
}

export function ScribingMatrix({
  grimoires,
  knownScripts,
  book = [],
}: {
  grimoires: GrimoireLite[];
  knownScripts: string[];
  /** Every script in the catalog. Used when a grimoire has no recorded compatibility. */
  book?: ScriptLite[];
}) {
  const known = useMemo(() => new Set(knownScripts.map((s) => s.toLowerCase())), [knownScripts]);
  const [grimId, setGrimId] = useState(grimoires[0]?.id ?? "");
  const grim = grimoires.find((g) => g.id === grimId) ?? grimoires[0];

  const [focus, setFocus] = useState<string>("");
  const [sig, setSig] = useState<string>("");
  const [affix, setAffix] = useState<string>("");
  const [knownOnly, setKnownOnly] = useState(false);

  const linked = !!grim && (grim.focus.length > 0 || grim.signature.length > 0 || grim.affix.length > 0);
  const ofSlot = (slot: "focus" | "signature" | "affix", linkedList: ScriptLite[]) =>
    linked ? linkedList : book.filter((s) => s.slot === slot);
  const focusList = grim ? ofSlot("focus", grim.focus) : [];
  const sigList = grim ? ofSlot("signature", grim.signature) : [];
  const affixList = grim ? ofSlot("affix", grim.affix) : [];

  const combos = useMemo(() => {
    if (!grim || !linked) return [];
    const out: { focus: ScriptLite; sig: ScriptLite; affix: ScriptLite; known: boolean }[] = [];
    for (const f of grim.focus) {
      for (const s of grim.signature) {
        for (const a of grim.affix) {
          const isKnown = known.has(f.name.toLowerCase()) && known.has(s.name.toLowerCase()) && known.has(a.name.toLowerCase());
          if (knownOnly && !isKnown) continue;
          out.push({ focus: f, sig: s, affix: a, known: isKnown });
        }
      }
    }
    return out;
  }, [grim, known, knownOnly, linked]);

  const totalCombos = linked && grim ? grim.focus.length * grim.signature.length * grim.affix.length : 0;

  if (!grim) return <p className="text-sm text-fg-muted">No grimoires in the catalog yet.</p>;

  const selF = focusList.find((x) => x.id === focus);
  const selS = sigList.find((x) => x.id === sig);
  const selA = affixList.find((x) => x.id === affix);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickyMenu className="flex flex-wrap items-center gap-2">
        <select
          value={grimId}
          onChange={(e) => {
            setGrimId(e.target.value);
            setFocus("");
            setSig("");
            setAffix("");
          }}
          className="rounded-lg border border-border bg-surface py-2 pl-2.5 pr-7 text-sm text-fg focus:border-accent focus:outline-none"
        >
          {grimoires.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {g.skillLine}
            </option>
          ))}
        </select>
        <span className="text-sm text-fg-muted">
          {linked ? `${totalCombos.toLocaleString("en-US")} possible combinations` : "Script book · combinations not scanned"}
        </span>
        <button
          onClick={() => setKnownOnly((v) => !v)}
          className={`ml-auto rounded-lg border px-2.5 py-2 text-sm transition-colors ${
            knownOnly ? "border-accent/50 bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg"
          }`}
        >
          Craftable by you
        </button>
      </StickyMenu>

      <PageScroll>
      <div className="mb-5 rounded-xl border border-border bg-surface/70 p-4">
        <div className="flex items-center gap-2 text-fg">
          <GameIcon name={grim.name} icon={grim.icon ?? plannerGrimoireIcon(grim.name)} size={28} bare />
          <span className="font-medium">{grim.name}</span>
          <span className="text-sm text-fg-muted">· {grim.skillLine}</span>
        </div>
        <p className="mt-1 text-sm text-fg-muted">{grim.description}</p>
        {!linked && (
          <p className="mt-2 text-xs text-fg-subtle">
            These are the live scripts. This grimoire does not yet list which of them it accepts.
          </p>
        )}
      </div>

      {/* Builder */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <ScriptPicker title="Focus Script" scripts={focusList} value={focus} onChange={setFocus} known={known} />
        <ScriptPicker title="Signature Script" scripts={sigList} value={sig} onChange={setSig} known={known} />
        <ScriptPicker title="Affix Script" scripts={affixList} value={affix} onChange={setAffix} known={known} />
      </div>

      {(selF || selS || selA) && (
        <div className="mb-6 rounded-xl border border-accent/40 bg-accent-soft p-4">
          <div className="text-sm font-medium text-fg">
            {grim.name}
            {selF ? ` · ${selF.name}` : ""}
            {selS ? ` · ${selS.name}` : ""}
            {selA ? ` · ${selA.name}` : ""}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-fg-muted">
            {selF && <li>Focus — {selF.effect}</li>}
            {selS && <li>Signature — {selS.effect}</li>}
            {selA && <li>Affix — {selA.effect}</li>}
          </ul>
        </div>
      )}

      {/* Full matrix — only when this grimoire has a recorded compatibility list. */}
      {linked && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        All combinations ({combos.length})
      </h3>}
      {linked && <div className="max-h-[520px] overflow-y-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-bg-elev">
            <tr className="text-left text-xs uppercase tracking-wider text-fg-subtle">
              <th className="px-3 py-2 font-medium">Focus</th>
              <th className="px-3 py-2 font-medium">Signature</th>
              <th className="px-3 py-2 font-medium">Affix</th>
              <th className="px-3 py-2 font-medium text-right">You</th>
            </tr>
          </thead>
          <tbody>
            {combos.map((c, i) => (
              <tr key={i} className="border-t border-border/50 hover:bg-surface-2/40">
                <td className="px-3 py-1.5 text-fg">{c.focus.name}</td>
                <td className="px-3 py-1.5 text-fg-muted">{c.sig.name}</td>
                <td className="px-3 py-1.5 text-fg-muted">{c.affix.name}</td>
                <td className="px-3 py-1.5 text-right">
                  {c.known ? <Check className="ml-auto h-4 w-4 text-ok" /> : <span className="text-fg-subtle">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      </PageScroll>
    </div>
  );
}

function ScriptPicker({
  title,
  scripts,
  value,
  onChange,
  known,
}: {
  title: string;
  scripts: ScriptLite[];
  value: string;
  onChange: (v: string) => void;
  known: Set<string>;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{title}</div>
      <div className="space-y-1">
        {scripts.map((s) => {
          const isKnown = known.has(s.name.toLowerCase());
          return (
            <button
              key={s.id}
              onClick={() => onChange(value === s.id ? "" : s.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors ${
                value === s.id
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-fg hover:bg-surface-2"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <GameIcon name={s.name} icon={s.icon ?? plannerScriptIcon(s.name)} size={22} bare />
                <span className="truncate">{s.name}</span>
              </span>
              {isKnown && <Check className="h-3.5 w-3.5 shrink-0 text-ok" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
