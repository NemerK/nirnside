"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { GameIcon } from "@/components/game-icon";
import { ALLIANCE_ACCENT, formatNumber } from "@/lib/format";
import type { LivingFace, LivingGuild, LivingHome } from "@/lib/home/living";

const LINE_KEY = "nirnside-home-line";

const SMALL = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

export function LivingHomeView({
  accountName,
  region,
  esoPlus,
  snapshot,
  model,
  iconByClass,
  colorByClass,
  currencies,
}: {
  accountName: string;
  region: string;
  esoPlus: boolean;
  snapshot: string | null;
  model: LivingHome;
  iconByClass: Record<string, string>;
  colorByClass: Record<string, string>;
  currencies: {
    gold: number;
    telVar: number;
    alliancePoints: number;
    writVouchers: number;
    transmuteCrystals: number;
    undauntedKeys: number;
  };
}) {
  const [faceId, setFaceId] = useState(model.faceId);
  const [line, setLine] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const face = model.faces.find((item) => item.id === faceId) ?? model.faces[0] ?? null;
  const color = face ? (colorByClass[face.className] ?? "var(--accent)") : "var(--accent)";
  const alliance = face ? (ALLIANCE_ACCENT[face.alliance] ?? color) : color;

  useEffect(() => {
    setLine(window.localStorage.getItem(LINE_KEY) ?? "");
  }, []);

  useEffect(() => {
    const el = field.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [line, face?.id]);

  function writeLine(next: string) {
    setLine(next);
    window.localStorage.setItem(LINE_KEY, next);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <article className="nirn-profile">
        {face ? (
          <div key={face.id} className="nirn-living-face">
            <header
              className="nirn-profile-banner"
              style={{ "--profile": color, "--alliance": alliance } as CSSProperties}
            >
              <GameIcon
                name=""
                icon={iconByClass[face.className]}
                size={92}
                bare
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-30 sm:right-10"
              />
            </header>

            <div className="px-5 pb-6 sm:px-8">
              <Avatar face={face} color={color} icon={iconByClass[face.className]} />

              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                    <Link href={`/characters/${encodeURIComponent(face.id)}`} className="hover:underline">
                      {face.name}
                    </Link>
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
                    <span>{accountName}</span>
                    <span aria-hidden>·</span>
                    <span>{region}</span>
                    {esoPlus ? (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent-fg">
                        ESO+
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>

              <label className="mt-4 flex items-start gap-2.5">
                <span className="sr-only">Status</span>
                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                <textarea
                  ref={field}
                  rows={1}
                  value={line}
                  onChange={(event) => writeLine(event.target.value)}
                  placeholder="Set a status"
                  style={{ caretColor: color }}
                  className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-6 text-fg placeholder:text-fg-subtle focus:outline-none"
                />
              </label>

              <ul className="mt-4 flex flex-wrap gap-2">
                {roles(face, color, alliance).map((role) => (
                  <li
                    key={role.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-fg ring-1 ring-border"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: role.color }} aria-hidden />
                    {role.label}
                  </li>
                ))}
              </ul>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Showcase title="Now">
                  <Now face={face} color={color} icon={iconByClass[face.className]} />
                </Showcase>
                {model.house ? (
                  <Showcase title="Home">
                    <p className="text-lg font-semibold leading-snug text-fg">{model.house.name}</p>
                    {model.house.location ? <p className="mt-1 text-sm text-fg-muted">{model.house.location}</p> : null}
                    {model.house.others > 0 ? (
                      <p className="mt-3 text-sm text-fg-subtle">
                        {model.house.others < SMALL.length ? SMALL[model.house.others] : model.house.others} more{" "}
                        {model.house.others === 1 ? "house" : "houses"}
                      </p>
                    ) : null}
                  </Showcase>
                ) : null}
                {face.sets.length > 0 ? (
                  <Showcase title="Wearing" className="sm:col-span-2">
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {face.sets.map((set) => (
                        <li
                          key={set}
                          className="rounded-lg bg-bg px-3 py-3 text-base font-medium text-fg ring-1 ring-border"
                          style={{ boxShadow: `inset 3px 0 0 ${color}` }}
                        >
                          {set}
                        </li>
                      ))}
                    </ul>
                  </Showcase>
                ) : null}
              </div>

              {model.guilds.length > 0 ? (
                <div className="mt-3">
                  <Showcase title="Guilds">
                    <ul className="flex flex-wrap gap-2">
                      {model.guilds.map((guild) => (
                        <GuildChip key={guild.name} guild={guild} color={color} />
                      ))}
                    </ul>
                  </Showcase>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="px-6 py-16 text-fg-muted">No characters in this snapshot yet.</p>
        )}

        {model.faces.length > 1 ? (
          <div className="border-t border-border px-5 py-4 sm:px-8">
            <h2 className="text-xs font-medium text-fg-subtle">Roster</h2>
            <div className="mt-3 flex gap-4 overflow-x-auto pb-1">
              {model.faces.map((item) => {
                const selected = item.id === face?.id;
                const itemColor = colorByClass[item.className] ?? "var(--accent)";
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFaceId(item.id)}
                    className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    <span
                      className="grid h-14 w-14 place-items-center rounded-full bg-bg"
                      style={{ boxShadow: selected ? `0 0 0 2px var(--surface), 0 0 0 4px ${itemColor}` : "inset 0 0 0 1px var(--border)" }}
                    >
                      <GameIcon name={item.className} icon={iconByClass[item.className]} size={36} bare lit={selected} />
                    </span>
                    <span className={`line-clamp-2 text-[11px] leading-tight ${selected ? "font-medium text-fg" : "text-fg-subtle"}`}>
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="border-t border-border px-5 py-4 sm:px-8">
          <Showcase title="Purse">
            <p className="text-2xl font-semibold tabular-nums tracking-tight text-fg">
              {formatNumber(currencies.gold)} <span className="text-base font-medium text-fg-muted">gold</span>
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
              <PurseStat label="Tel Var" value={currencies.telVar} />
              <PurseStat label="Alliance Points" value={currencies.alliancePoints} />
              <PurseStat label="Writ vouchers" value={currencies.writVouchers} />
              <PurseStat label="Crystals" value={currencies.transmuteCrystals} />
              <PurseStat label="Undaunted keys" value={currencies.undauntedKeys} />
            </dl>
          </Showcase>
          <p className="mt-4 text-xs text-fg-subtle">{[accountName, snapshot].filter(Boolean).join(" · ")}</p>
        </div>
      </article>
    </div>
  );
}

function Avatar({ face, color, icon }: { face: LivingFace; color: string; icon?: string }) {
  const leveling = face.level > 0 && face.level < 50;
  const pct = leveling ? Math.round((face.level / 50) * 100) : 100;
  const badge = leveling ? String(face.level) : face.championPoints > 0 ? formatNumber(face.championPoints) : null;
  return (
    <div className="relative -mt-12 h-[104px] w-[104px] sm:-mt-14">
      <div
        className="grid h-full w-full place-items-center rounded-full"
        style={{
          background: `conic-gradient(from -90deg, ${color} ${pct}%, color-mix(in srgb, ${color} 28%, transparent) ${pct}%)`,
          padding: 3,
        }}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-surface p-1">
          <div className="grid h-full w-full place-items-center rounded-full bg-[#14121a]">
            <GameIcon name={face.className} icon={icon} size={64} bare lit />
          </div>
        </div>
      </div>
      {badge ? (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums"
          style={{ background: color, color: "#1a140c" }}
        >
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function Now({ face, color, icon }: { face: LivingFace; color: string; icon?: string }) {
  const progress = face.progress;
  return (
    <div className="space-y-4">
      {progress ? (
        <div className="flex items-center gap-3">
          <GameIcon name={face.className} icon={icon} size={44} bare />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-fg">{progress.label}</p>
            <p className="text-sm tabular-nums text-fg-muted">
              {progress.rank} / {progress.total}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full" style={{ width: `${Math.round((progress.rank / progress.total) * 100)}%`, background: color }} />
            </div>
          </div>
        </div>
      ) : null}
      {face.activity ? (
        <div className={progress ? "border-t border-border pt-3" : ""}>
          <p className="font-medium text-fg">{face.activity.title}</p>
          <p className="mt-0.5 text-sm text-fg-muted">{face.activity.detail}</p>
        </div>
      ) : null}
      {!progress && !face.activity ? <p className="text-sm text-fg-muted">Nothing open on this character.</p> : null}
    </div>
  );
}

function Showcase({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-xl bg-bg ring-1 ring-border ${className}`}>
      <h2 className="border-b border-border bg-bg-elev px-3 py-2 text-xs font-medium text-fg-muted">{title}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

function GuildChip({ guild, color }: { guild: LivingGuild; color: string }) {
  const rank = guild.rank?.trim();
  return (
    <li className="inline-flex items-center gap-2 rounded-full bg-bg px-3 py-1.5 text-sm ring-1 ring-border">
      <span className="h-2 w-2 rounded-full" style={{ background: guild.trader ? "var(--accent)" : color }} aria-hidden />
      {rank ? <span className="text-fg-subtle">{rank}</span> : null}
      <span className="font-medium text-fg">{guild.name}</span>
      {guild.trader ? <span className="text-xs text-accent">Trader</span> : null}
    </li>
  );
}

function PurseStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] text-fg-subtle">{label}</dt>
      <dd className="tabular-nums text-sm font-medium text-fg">{formatNumber(value)}</dd>
    </div>
  );
}

function roles(face: LivingFace, color: string, alliance: string): { label: string; color: string }[] {
  const list: { label: string; color: string }[] = [
    { label: face.race, color: "var(--fg-subtle)" },
    { label: face.className, color },
    { label: face.alliance, color: alliance },
  ];
  for (const mark of face.marks) list.push({ label: mark, color });
  return list;
}
