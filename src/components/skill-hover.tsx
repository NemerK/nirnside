"use client";

import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { CatalogSource } from "@/lib/catalog/schema";
import { skillTip, type SkillBrief } from "@/lib/skills/skill-brief";
import { EsoText } from "./eso-text";
import { SourceBadge, UnverifiedNote } from "./source-badge";

const SkillCatalogContext = createContext<readonly SkillBrief[]>([]);

export function SkillCatalogProvider({ skills, children }: { skills: readonly SkillBrief[]; children: ReactNode }) {
  return <SkillCatalogContext.Provider value={skills}>{children}</SkillCatalogContext.Provider>;
}

/**
 * Hovering a skill opens its description. Text passed with the skill wins.
 * Otherwise the surrounding catalog is used. Nothing here is written in.
 */
export function SkillHover({
  name,
  description,
  source,
  detail,
  className,
  labelled,
  children,
}: {
  name?: string | null;
  description?: string | null;
  source?: CatalogSource | "unknown" | null;
  detail?: string | null;
  className?: string;
  /** Icon-only skills have no visible name. The label is the skill, not a second tooltip. */
  labelled?: boolean;
  children: ReactNode;
}) {
  const skills = useContext(SkillCatalogContext);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const shown = anchor ? skillTip(skills, { name, description, source }) : null;
  return (
    <>
      <span
        className={["nirn-tip-target", className].filter(Boolean).join(" ")}
        aria-label={labelled && name?.trim() ? name.trim() : undefined}
        onMouseEnter={(event) => setAnchor(event.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        onFocus={(event) => setAnchor(event.currentTarget)}
        onBlur={() => setAnchor(null)}
      >
        {children}
      </span>
      {anchor && shown ? <SkillTip anchor={anchor} name={shown.name} description={shown.description} source={shown.source} detail={detail} /> : null}
    </>
  );
}

function SkillTip({
  anchor,
  name,
  description,
  source,
  detail,
}: {
  anchor: HTMLElement;
  name: string;
  description: string;
  source: CatalogSource | null;
  detail?: string | null;
}) {
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);
  const labelId = useId();

  useEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = 360;
      const margin = 8;
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
  }, [anchor]);

  if (!box || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="tooltip"
      aria-labelledby={labelId}
      className="nirn-tip pointer-events-none fixed z-50 max-h-[min(24rem,70vh)] overflow-y-auto rounded-lg p-3"
      style={{ left: box.left, top: box.top, width: box.width }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <p id={labelId} className="text-sm font-medium text-fg">
          {name}
        </p>
        {source ? <SourceBadge source={source} /> : null}
      </div>
      {detail ? (
        <p className="mt-0.5 text-[11px] text-fg-subtle">
          <EsoText text={detail} />
        </p>
      ) : null}
      {description ? (
        <div className="mt-2 text-xs leading-relaxed text-fg">
          <EsoText text={description} />
        </div>
      ) : (
        <p className="mt-2 text-xs text-fg-muted">Description not captured yet.</p>
      )}
      {source ? <UnverifiedNote source={source} /> : null}
    </div>,
    document.body,
  );
}
