"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { lookupSetBrief, type SetBrief, type SetQuery } from "@/lib/catalog/set-brief";
import { stripBonusCount } from "@/lib/text/eso-markup";
import { EsoText } from "./eso-text";
import { SourceBadge, UnverifiedNote } from "./source-badge";

type TipRequest = SetQuery & {
  itemName?: string;
  detail?: string;
};

type TipContextValue = {
  show: (anchor: HTMLElement, request: TipRequest) => void;
  hide: (anchor: HTMLElement) => void;
};

const CatalogContext = createContext<SetBrief[]>([]);
const TipContext = createContext<TipContextValue | null>(null);

export function SetCatalogProvider({ sets, children }: { sets: SetBrief[]; children: ReactNode }) {
  const [tip, setTip] = useState<{ anchor: HTMLElement; request: TipRequest } | null>(null);

  const value: TipContextValue = {
    show: (anchor, request) => setTip({ anchor, request }),
    hide: (anchor) => setTip((current) => (current?.anchor === anchor ? null : current)),
  };

  return (
    <CatalogContext.Provider value={sets}>
      <TipContext.Provider value={value}>
        {children}
        <SetTipLayer tip={tip} sets={sets} />
      </TipContext.Provider>
    </CatalogContext.Provider>
  );
}

export function SetHover({
  name,
  setId,
  itemName,
  detail,
  className,
  children,
}: TipRequest & { className?: string; children: ReactNode }) {
  const tip = useContext(TipContext);
  const frame = ["nirn-tip-target", className].filter(Boolean).join(" ");
  if (!tip) return <span className={frame}>{children}</span>;
  return (
    <span
      className={frame}
      onMouseEnter={(event) => tip.show(event.currentTarget, { name, setId, itemName, detail })}
      onMouseLeave={(event) => tip.hide(event.currentTarget)}
      onFocus={(event) => tip.show(event.currentTarget, { name, setId, itemName, detail })}
      onBlur={(event) => tip.hide(event.currentTarget)}
    >
      {children}
    </span>
  );
}

function SetTipLayer({
  tip,
  sets,
}: {
  tip: { anchor: HTMLElement; request: TipRequest } | null;
  sets: SetBrief[];
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const labelId = useId();

  useEffect(() => {
    if (!tip) return;
    const place = () => {
      const rect = tip.anchor.getBoundingClientRect();
      const width = 320;
      const margin = 12;
      let left = rect.right + margin;
      if (left + width > window.innerWidth - margin) left = rect.left - width - margin;
      if (left < margin) left = Math.max(margin, window.innerWidth - width - margin);
      let top = rect.top;
      const maxTop = window.innerHeight - margin - 280;
      if (top > maxTop) top = Math.max(margin, maxTop);
      setBox({ left, top, width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [tip]);

  if (!tip || !box || typeof document === "undefined") return null;
  const brief = lookupSetBrief(sets, tip.request);
  const setLabel = brief?.name ?? (tip.request.name?.trim() || null);
  return createPortal(
    <div
      role="tooltip"
      aria-labelledby={labelId}
      className="nirn-tip pointer-events-none fixed z-50 rounded-lg"
      style={{ left: box.left, top: box.top, width: box.width }}
    >
      <div className="max-h-[min(24rem,70vh)] overflow-y-auto p-3">
        {tip.request.itemName ? <p className="text-sm font-medium text-fg">{tip.request.itemName}</p> : null}
        {tip.request.detail ? (
          <p className="text-[11px] text-fg-muted">
            <EsoText text={tip.request.detail} />
          </p>
        ) : null}
        <div className={tip.request.itemName || tip.request.detail ? "mt-2 border-t border-border pt-2" : ""}>
        <div className="flex flex-wrap items-center gap-1.5">
          <p id={labelId} className="text-sm font-medium text-fg">
            {setLabel ?? "No set"}
          </p>
          {brief ? <SourceBadge source={brief.source} /> : null}
        </div>
        {brief ? (
          <>
            <p className="mt-0.5 text-[11px] text-fg-subtle">
              {brief.category}
              {brief.maxEquip > 0
                ? ` · up to ${brief.maxEquip} ${brief.maxEquip === 1 ? "piece" : "pieces"}`
                : ""}
            </p>
            {brief.bonuses.length === 0 ? (
              <p className="mt-2 text-xs text-fg-muted">Bonuses pending an in-game scan.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {brief.bonuses.map((bonus) => (
                  <li key={`${bonus.pieces}-${bonus.text}`} className="flex gap-2 text-xs text-fg">
                    <span className="mt-0.5 flex h-5 w-6 shrink-0 items-center justify-center rounded border border-accent/40 bg-accent-soft text-[10px] font-semibold text-accent">
                      {bonus.pieces}
                    </span>
                    <span>
                      <EsoText text={stripBonusCount(bonus.text)} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <UnverifiedNote source={brief.source} />
          </>
        ) : (
          <p className="mt-1 text-xs text-fg-muted">
            {setLabel ? "This set is not in the catalog yet." : "This item has no set."}
          </p>
        )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
