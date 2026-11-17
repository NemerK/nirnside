"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GameIcon } from "@/components/game-icon";
import type { LivingFace, LivingGuild, LivingHome } from "@/lib/home/living";
import { formatGold, formatNumber } from "@/lib/format";

const LINE_KEY = "nirnside-home-line";

const SMALL = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const STAGE = ["", "the first", "the second", "the third", "the fourth", "the fifth"];

export function LivingHomeView({
  accountName,
  region,
  esoPlus,
  snapshot,
  championPoints,
  model,
  iconByClass,
  colorByClass,
  currencies,
}: {
  accountName: string;
  region: string;
  esoPlus: boolean;
  snapshot: string | null;
  championPoints: number;
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
  const [purse, setPurse] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const face = model.faces.find((item) => item.id === faceId) ?? model.faces[0] ?? null;
  const color = face ? colorByClass[face.className] : undefined;
  const others = model.faces.filter((item) => item.id !== face?.id);

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
  }, [line]);

  function writeLine(next: string) {
    setLine(next);
    window.localStorage.setItem(LINE_KEY, next);
  }

  const signature = [
    accountName,
    region,
    esoPlus ? "ESO+" : null,
    championPoints > 0 ? `CP ${championPoints.toLocaleString("en-US")}` : null,
    snapshot,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative mx-auto w-full max-w-2xl py-2 sm:py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-6 h-56 w-56 rounded-full blur-3xl transition-all duration-700"
        style={{ background: color ?? "transparent", opacity: color ? 0.22 : 0 }}
      />

      <label className="relative block">
        <span className="sr-only">A line only you write</span>
        <textarea
          ref={field}
          rows={1}
          value={line}
          onChange={(event) => writeLine(event.target.value)}
          placeholder="What this week is for"
          style={{ caretColor: color }}
          className="nirn-living-script w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-3xl leading-tight text-fg italic placeholder:text-fg-subtle/80 focus:outline-none sm:text-4xl"
        />
      </label>

      {face ? (
        <article key={face.id} className="nirn-living-face relative mt-12">
          <div className="flex items-center gap-4">
            <GameIcon name={face.className} icon={iconByClass[face.className]} size={64} bare lit />
            <h1
              className="nirn-living-script text-5xl leading-[0.95] tracking-tight sm:text-6xl"
              style={{ color: color ?? "var(--fg)" }}
            >
              {face.name}
            </h1>
          </div>
          <div className="mt-8 max-w-lg space-y-4 text-lg leading-8 text-fg">
            <p>{[presence(face), face.progress ? progressSentence(face.progress) : null, face.wearing].filter(Boolean).join(" ")}</p>
            {face.open ? <p className="text-fg-muted">{face.open}</p> : null}
            {model.house ? <p>{houseSentence(model.house)}</p> : null}
          </div>
        </article>
      ) : (
        <p className="relative mt-12 text-lg text-fg-muted">No characters in this snapshot yet.</p>
      )}

      {others.length > 0 ? (
        <p className="relative mt-12 text-lg leading-8 text-fg-muted">
          Also <AlsoNames faces={others} colorByClass={colorByClass} onPick={setFaceId} />.
        </p>
      ) : null}

      {model.guilds.length > 0 ? (
        <p className="relative mt-6 max-w-lg text-base leading-7 text-fg-muted">{guildsSentence(model.guilds)}</p>
      ) : null}

      <div className="relative mt-10">
        <button type="button" onClick={() => setPurse((open) => !open)} className="text-left text-sm text-fg-subtle hover:text-fg">
          {formatGold(currencies.gold)} in the purse.
        </button>
        {purse ? (
          <p className="mt-2 max-w-md text-sm leading-7 text-fg-muted">
            Tel Var {formatNumber(currencies.telVar)}. Alliance Points {formatNumber(currencies.alliancePoints)}. Writ vouchers{" "}
            {formatNumber(currencies.writVouchers)}. Transmute crystals {formatNumber(currencies.transmuteCrystals)}. Undaunted keys{" "}
            {formatNumber(currencies.undauntedKeys)}.
          </p>
        ) : null}
      </div>

      <p className="relative mt-16 text-xs text-fg-subtle">
        {signature}
        {" · "}
        <Link href="/" className="hover:text-fg">
          The ledger
        </Link>
      </p>
    </div>
  );
}

function AlsoNames({
  faces,
  colorByClass,
  onPick,
}: {
  faces: LivingFace[];
  colorByClass: Record<string, string>;
  onPick: (id: string) => void;
}) {
  return faces.map((face, index) => {
    const last = index === faces.length - 1;
    const joiner = index === 0 ? null : last ? (faces.length === 2 ? " and " : ", and ") : ", ";
    return (
      <span key={face.id}>
        {joiner}
        <button
          type="button"
          onClick={() => onPick(face.id)}
          className="nirn-living-script italic hover:underline"
          style={{ color: colorByClass[face.className] ?? "var(--fg)" }}
        >
          {face.name}
        </button>
      </span>
    );
  });
}

function presence(face: LivingFace): string {
  const notes: string[] = [];
  for (const mark of face.marks) {
    const stage = mark.match(/^Vampire, stage (\d+)$/);
    if (stage) {
      const n = Number(stage[1]);
      notes.push(n > 0 && n < STAGE.length ? `a vampire in ${STAGE[n]} stage` : `a vampire in stage ${stage[1]}`);
    } else if (mark === "Vampire") notes.push("a vampire");
    else if (mark === "Werewolf") notes.push("a werewolf");
    else if (mark === "Class mastery") notes.push("class mastery in hand");
    else notes.push(`under ${mark}`);
  }
  const who = `${face.race} ${face.className} of the ${face.alliance}`;
  return notes.length > 0 ? `${who}, ${notes.join(", ")}.` : `${who}.`;
}

function progressSentence(progress: NonNullable<LivingFace["progress"]>): string {
  if (progress.label === "Level") return `Level ${progress.rank}, not yet 50.`;
  const left = progress.total - progress.rank;
  if (left <= 0) return `${progress.label} is finished.`;
  if (left < SMALL.length) return `${SMALL[left]} ${left === 1 ? "rank" : "ranks"} left on ${progress.label}.`;
  return `${left} ranks left on ${progress.label}.`;
}

function houseSentence(house: NonNullable<LivingHome["house"]>): string {
  const place = house.location ? `${house.name}, on ${house.location}` : house.name;
  const others =
    house.others > 0
      ? ` ${house.others < SMALL.length ? SMALL[house.others] : house.others} more ${house.others === 1 ? "house" : "houses"} besides.`
      : "";
  return `Home is ${place}.${others}`;
}

function guildsSentence(guilds: LivingGuild[]): string {
  return (
    guilds
      .map((guild) => {
        const rank = guild.rank?.trim();
        const who = rank ? `${rank} of ${guild.name}` : guild.name;
        return guild.trader ? `${who}, the one with a trader` : who;
      })
      .join(". ") + "."
  );
}
