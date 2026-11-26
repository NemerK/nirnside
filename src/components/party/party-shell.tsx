"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Droplet, Moon, Search } from "lucide-react";
import { classColor } from "@/lib/classes";
import { timeAgo } from "@/lib/format";
import { GameIcon } from "../game-icon";
import { CommandPalette } from "./command-palette";
import type { PartyAccount, PartyLink, PartyMember } from "./types";

const LAST_KEY = "nirnside-party-character";

export const PARTY_LINKS: PartyLink[] = [
  { id: "compare", label: "Compare", href: "/party/compare", blurb: "Every skill line for every character, side by side." },
  { id: "targets", label: "Targets", href: "/party/targets", blurb: "What you're working towards, and who is still short." },
  { id: "vault", label: "Vault", href: "/party/vault", blurb: "Everything the account owns: gold, bags, collections, houses." },
];

/** The character a Party address is about, and the module after it (skills, gear…). */
function parseCharacterPath(pathname: string): { id: string | null; rest: string } {
  const m = pathname.match(/^\/party\/c\/([^/]+)(\/.*)?$/);
  return m ? { id: decodeURIComponent(m[1]), rest: m[2] ?? "" } : { id: null, rest: "" };
}

function Member({ m, active, href }: { m: PartyMember; active: boolean; href: string }) {
  const color = classColor(m.className) ?? "#94889f";
  const known = m.lastSeen != null;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-[220px] flex-1 items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors ${
        active
          ? "border-[color:var(--hero)] bg-surface-2"
          : known
            ? "border-border bg-surface/70 hover:border-border-strong"
            : "border-dashed border-border hover:border-border-strong"
      }`}
      style={{ "--hero": color } as CSSProperties}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${known ? "" : "opacity-60"}`}
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, boxShadow: `inset 0 0 0 1px ${color}` }}
      >
        {m.crest ? <GameIcon name={m.className} icon={m.crest} size={32} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-display text-[17px] leading-tight ${known ? "text-fg" : "text-fg-muted"}`}>
          {m.name}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
          <span style={{ color }}>{m.className}</span>
          <span>{m.level >= 50 ? `CP ${m.championPoints.toLocaleString("en-US")}` : `Level ${m.level}`}</span>
          {m.vampireStage > 0 ? <Droplet className="h-3 w-3 text-danger" aria-label={`Vampire stage ${m.vampireStage}`} /> : null}
          {m.werewolf ? <Moon className="h-3 w-3 text-info" aria-label="Werewolf" /> : null}
        </span>
      </span>
    </Link>
  );
}

export function PartyShell({
  account,
  members,
  children,
}: {
  account: PartyAccount | null;
  members: PartyMember[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { id: currentId, rest } = parseCharacterPath(pathname);
  const [lastId, setLastId] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (currentId) {
      try {
        localStorage.setItem(LAST_KEY, currentId);
      } catch {
        /* storage can be off; the band still works */
      }
      return;
    }
    try {
      // Restoring a remembered choice after hydration; nothing to sync from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastId(localStorage.getItem(LAST_KEY));
    } catch {
      setLastId(null);
    }
  }, [currentId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPalette((v) => !v);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPalette(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = currentId ?? (members.some((m) => m.id === lastId) ? lastId : null) ?? members[0]?.id ?? null;
  const hero = classColor(members.find((m) => m.id === selected)?.className ?? "") ?? "#b46ad4";
  const pages = useMemo<PartyLink[]>(
    () => [
      ...PARTY_LINKS,
      { id: "library", label: "Library", href: "/encyclopedia", blurb: "Sets, skills, Champion Points and scribing." },
      { id: "setup", label: "Setup", href: "/setup", blurb: "Find ESO, install the addons." },
    ],
    [],
  );

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-[14px] transition-colors ${
        active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="party-sky flex min-h-full flex-col" style={{ "--hero": hero } as CSSProperties}>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 pt-4 md:px-8">
        <Link href="/party" className="font-display text-[22px] tracking-[0.08em] text-fg">
          NIRNSIDE
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          {navLink(selected ? `/party/c/${selected}` : "/party", "Party", !!currentId)}
          {PARTY_LINKS.map((l) => navLink(l.href, l.label, pathname === l.href || pathname.startsWith(`${l.href}/`)))}
          {/* The Library is still the Atlas encyclopedia; crossing layouts reloads the page. */}
          <Link href="/encyclopedia" className="rounded-lg px-3 py-1.5 text-[14px] text-fg-muted hover:text-fg">
            Library
          </Link>
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface/70 px-3 py-1.5 text-[13px] text-fg-subtle hover:border-border-strong hover:text-fg-muted"
          >
            <Search className="h-3.5 w-3.5" /> Search
            <kbd className="rounded border border-border px-1 text-[11px]">Ctrl K</kbd>
          </button>
          {account ? (
            <span className="text-[13px] text-fg-subtle">
              {account.displayName} · {account.region}
              {account.esoPlus ? " · ESO+" : ""} · updated {timeAgo(account.lastSnapshot)}
            </span>
          ) : null}
          <Link href="/" className="text-[13px] text-fg-subtle hover:text-fg" title="Switch back to the Atlas look">
            Atlas look
          </Link>
        </div>
      </header>

      {members.length > 0 ? (
        <div role="list" aria-label="Your characters" className="flex gap-3 overflow-x-auto px-5 pb-1 pt-4 md:px-8">
          {members.map((m) => (
            <div role="listitem" key={m.id} className="flex">
              <Member
                m={m}
                active={m.id === currentId}
                href={`/party/c/${encodeURIComponent(m.id)}${currentId ? rest : ""}`}
              />
            </div>
          ))}
        </div>
      ) : null}

      <main className="flex-1 px-5 pb-12 pt-6 md:px-8">{children}</main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} pages={pages} characters={members} />
    </div>
  );
}
