"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GameIcon } from "@/components/game-icon";
import type { LivingFace, LivingGuild, LivingHome } from "@/lib/home/living";
import { formatGold, formatNumber } from "@/lib/format";

const LINE_KEY = "nirnside-home-line";
const GUILD_SEATS = 5;

export function LivingHomeView({
  accountName,
  region,
  esoPlus,
  snapshot,
  championPoints,
  model,
  iconByClass,
  currencies,
}: {
  accountName: string;
  region: string;
  esoPlus: boolean;
  snapshot: string | null;
  championPoints: number;
  model: LivingHome;
  iconByClass: Record<string, string>;
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
  const face = model.faces.find((item) => item.id === faceId) ?? model.faces[0] ?? null;
  const openSeats = Math.max(0, GUILD_SEATS - model.guilds.length);

  useEffect(() => {
    setLine(window.localStorage.getItem(LINE_KEY) ?? "");
  }, []);

  function writeLine(next: string) {
    setLine(next);
    window.localStorage.setItem(LINE_KEY, next);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{accountName}</h1>
          <p className="text-sm text-fg-muted">
            {region}
            {esoPlus ? " · ESO+" : ""}
            {championPoints > 0 ? ` · CP ${championPoints.toLocaleString("en-US")}` : ""}
            {snapshot ? ` · ${snapshot}` : ""}
          </p>
        </div>
        <label className="mt-3 block max-w-xl">
          <span className="sr-only">A line only you write</span>
          <input
            value={line}
            onChange={(event) => writeLine(event.target.value)}
            placeholder="A line only you write"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle"
          />
        </label>
        <p className="mt-1.5 text-xs text-fg-subtle">
          This sentence stays on this computer.{" "}
          <Link href="/" className="text-fg-muted hover:text-fg">
            Current home
          </Link>
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {face ? <Face face={face} icon={iconByClass[face.className]} /> : <p className="text-sm text-fg-muted">No characters in this snapshot yet.</p>}
        {model.house ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Lives at</p>
            <h2 className="mt-1 text-xl font-semibold text-fg">{model.house.name}</h2>
            {model.house.location ? <p className="mt-1 text-sm text-fg-muted">{model.house.location}</p> : null}
            <p className="mt-2 text-sm text-fg-subtle">
              Primary residence.
              {model.house.others > 0
                ? ` ${model.house.others} other ${model.house.others === 1 ? "house stays" : "houses stay"} on the Houses page.`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      {face?.open ? (
        <section>
          <h2 className="text-sm font-semibold text-fg">Still open</h2>
          <p className="mt-1 text-sm text-fg">{face.open}</p>
        </section>
      ) : null}

      {model.faces.length > 1 ? (
        <section>
          <h2 className="text-sm font-semibold text-fg">The rest of the roster</h2>
          <p className="mt-1 text-xs text-fg-subtle">The account name stays. Pick who this page faces.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {model.faces.map((item) => {
              const selected = item.id === face?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFaceId(item.id)}
                  className={`rounded-md border px-2.5 py-1 text-sm ${
                    selected ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-fg-muted hover:text-fg"
                  }`}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {model.guilds.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-fg">Guilds</h2>
          <ul className="mt-1 space-y-1">
            {model.guilds.map((guild) => (
              <li key={guild.name} className="text-sm text-fg">
                {guildSentence(guild)}
              </li>
            ))}
          </ul>
          {openSeats > 0 ? (
            <p className="mt-1 text-xs text-fg-subtle">
              {openSeats} guild {openSeats === 1 ? "seat is" : "seats are"} open.
            </p>
          ) : null}
        </section>
      ) : null}

      <details className="rounded-lg border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm text-fg">Wallet · {formatGold(currencies.gold)} gold</summary>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Wallet label="Gold" value={formatGold(currencies.gold)} />
          <Wallet label="Tel Var" value={formatNumber(currencies.telVar)} />
          <Wallet label="Alliance Points" value={formatNumber(currencies.alliancePoints)} />
          <Wallet label="Writ Vouchers" value={formatNumber(currencies.writVouchers)} />
          <Wallet label="Transmute Crystals" value={formatNumber(currencies.transmuteCrystals)} />
          <Wallet label="Undaunted Keys" value={formatNumber(currencies.undauntedKeys)} />
        </dl>
      </details>
    </div>
  );
}

function Face({ face, icon }: { face: LivingFace; icon?: string }) {
  const pct = face.progress ? Math.min(100, Math.round((face.progress.rank / face.progress.total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center gap-3">
        <GameIcon name={face.className} icon={icon} size={56} />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-fg">{face.name}</h2>
          <p className="text-sm text-fg-muted">
            {face.race} {face.className} · {face.alliance}
          </p>
        </div>
      </div>
      {face.marks.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {face.marks.map((mark) => (
            <li key={mark} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-fg-muted">
              {mark}
            </li>
          ))}
        </ul>
      ) : null}
      {face.progress ? (
        <div className="mt-3 max-w-md">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{face.progress.label}</span>
            <span className="text-sm font-semibold tabular-nums text-fg">
              {face.progress.rank}
              <span className="font-normal text-fg-subtle">/{face.progress.total}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
      {face.wearing ? <p className="mt-2 text-sm text-fg">{face.wearing}</p> : null}
    </div>
  );
}

function guildSentence(guild: LivingGuild): string {
  const rank = guild.rank?.trim();
  const who = rank ? `${rank} of ${guild.name}` : guild.name;
  return guild.trader ? `${who}, with a guild trader.` : `${who}.`;
}

function Wallet({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}
