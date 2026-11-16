"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { activityLabel, activitySection, leavesActivity, type ActivityPlace } from "@/lib/nav/activity-return";

const STORAGE_KEY = "nirnside-activity-return";

function readPlace(): ActivityPlace | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivityPlace;
    if (!parsed || typeof parsed.href !== "string" || !parsed.href.startsWith("/")) return null;
    if (typeof parsed.label !== "string" || !parsed.label.trim()) return null;
    return { href: parsed.href, label: parsed.label.trim() };
  } catch {
    return null;
  }
}

function writePlace(place: ActivityPlace | null) {
  try {
    if (!place) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch {
    /* private mode can refuse storage; the button just stays hidden */
  }
}

function here(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function headingInActivity(): string | null {
  const node = document.querySelector("main h1");
  const text = node?.textContent?.replace(/\s+/g, " ").trim();
  return text || null;
}

/**
 * One step back to the page an in-content link just left.
 * Sidebar navigation starts a new activity and clears it.
 */
export function ActivityReturn() {
  const pathname = usePathname();
  const [place, setPlace] = useState<ActivityPlace | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const saved = readPlace();
    if (!saved || activitySection(saved.href) === activitySection(pathname)) {
      if (saved) writePlace(null);
      setPlace(null);
      return;
    }
    setPlace(saved);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      let dest: URL;
      try {
        dest = new URL(anchor.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;

      if (anchor.hasAttribute("data-activity-return")) {
        writePlace(null);
        setPlace(null);
        return;
      }

      if (!anchor.closest("main")) {
        writePlace(null);
        setPlace(null);
        return;
      }

      const from = here();
      const to = `${dest.pathname}${dest.search}`;
      if (!leavesActivity(from, to)) return;
      const next = { href: from, label: activityLabel(from, headingInActivity()) };
      writePlace(next);
      setPlace(next);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useLayoutEffect(() => {
    const link = linkRef.current;
    const page = link?.nextElementSibling;
    if (!link || !(page instanceof HTMLElement) || !link.parentElement) return;
    const scroller = link.parentElement;
    const align = () => {
      const left = page.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
      link.style.marginLeft = left > 8 ? `${Math.round(left)}px` : "";
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(page);
    observer.observe(scroller);
    window.addEventListener("resize", align);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", align);
    };
  }, [place, pathname]);

  if (!place || activitySection(place.href) === activitySection(pathname)) return null;

  return (
    <Link
      ref={linkRef}
      href={place.href}
      data-activity-return=""
      className="mb-3 inline-flex w-fit shrink-0 items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to {place.label}
    </Link>
  );
}
