import Link from "next/link";
import type { ReactNode } from "react";
import { Bar, Empty } from "@/components/party/module";
import { ProfileView, type ProfileHeader } from "@/components/party/profile-view";
import { GameIcon } from "@/components/game-icon";
import { getCharacter, getHouses } from "@/lib/db/queries";
import { profileMedia } from "@/lib/db/profile";
import { getPartyProfile } from "@/lib/db/party-profile";
import { profileImageUrl } from "@/lib/profile/media";
import { livingHome } from "@/lib/home/living";
import { skillLineCap } from "@/lib/skills/line-cap";
import { classColor, classIcon } from "@/lib/classes";
import { ALLIANCE_ACCENT, formatNumber, timeAgo } from "@/lib/format";
import { roster } from "@/lib/party/data";
import { account, achievementsSummary, collectionsSummary, planProgress, rosterRows, treasury } from "@/lib/party/overview";

export const dynamic = "force-dynamic";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function Tally({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <li>
      <div className="mb-1 flex justify-between gap-3 text-[13px]">
        <span className="text-fg">{label}</span>
        <span className="tabular-nums text-fg-muted">{total > 0 ? `${formatNumber(done)} / ${formatNumber(total)}` : "—"}</span>
      </div>
      <Bar value={done} max={total} />
    </li>
  );
}

/** Home: your profile. What friends will see, built from the snapshot and your choices. */
export default function ProfilePage() {
  const a = account();
  const characters = roster();
  if (!a || characters.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-display text-4xl text-fg">Your profile is empty</h1>
        <p className="mt-3 text-fg-muted">
          {a
            ? "Log a character out in game with the Nirnside Snapshot addon on, and they join your profile."
            : "Nirnside hasn't read your account yet. Setup finds your ESO folder and installs the addon."}
        </p>
        <Link href="/party/setup" className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg">
          Open Setup
        </Link>
      </div>
    );
  }

  const profile = safe(() => getPartyProfile(), null) ?? { status: "", mainCharacterId: null, showcase: [] };
  const lastPlayed = [...characters].filter((c) => c.lastSeen != null).sort((x, y) => (y.lastSeen ?? 0) - (x.lastSeen ?? 0))[0];
  const mainLight = characters.find((c) => c.id === profile.mainCharacterId) ?? lastPlayed ?? characters[0];
  const main = safe(() => getCharacter(mainLight.id), null);
  const houses = safe(() => getHouses(), []);
  const face = main ? livingHome([main], houses, skillLineCap).faces[0] : null;
  const media = safe(() => profileMedia(), { avatar: null, banner: null });
  const color = classColor(mainLight.class) ?? "#b46ad4";

  const header: ProfileHeader = {
    accountName: a.displayName || "Your account",
    region: a.region,
    esoPlus: a.esoPlus,
    updated: a.lastSnapshot ? timeAgo(a.lastSnapshot) : null,
    bannerUrl: media.banner != null ? profileImageUrl("banner", media.banner) : null,
    avatarUrl: media.avatar != null ? profileImageUrl("avatar", media.avatar) : null,
    color,
    main: {
      id: mainLight.id,
      name: mainLight.name,
      className: mainLight.class,
      race: mainLight.race,
      alliance: mainLight.alliance,
      allianceColor: ALLIANCE_ACCENT[mainLight.alliance] ?? null,
      stat: mainLight.level >= 50 ? `${formatNumber(mainLight.championPoints)} CP` : `Level ${mainLight.level}`,
      icon: classIcon(mainLight.class) ?? null,
      marks: face?.marks ?? [],
    },
    characters: characters.map((c) => ({ id: c.id, name: c.name })),
  };

  // Every module is rendered here; the profile shows the ones you chose, to whoever may see them.
  const modules: Record<string, ReactNode> = {};

  modules.characters = (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {characters.map((c) => {
        const cc = classColor(c.class) ?? "var(--fg-muted)";
        return (
          <li key={c.id}>
            <Link href={`/party/c/${encodeURIComponent(c.id)}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `color-mix(in srgb, ${cc} 18%, transparent)`, boxShadow: `inset 0 0 0 1px ${cc}` }}
              >
                <GameIcon name={c.class} icon={classIcon(c.class)} size={22} bare />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-fg">{c.name}</span>
                <span className="text-[11px]" style={{ color: cc }}>
                  {c.class}
                </span>
              </span>
              <span className="text-[12px] tabular-nums text-fg-muted">
                {c.level >= 50 ? `${formatNumber(c.championPoints)} CP` : `Lv ${c.level}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  modules.wearing = face && face.sets.length > 0 ? (
    <div>
      <p className="mb-2 text-[12px] text-fg-subtle">{mainLight.name} is wearing</p>
      <ul className="space-y-1.5">
        {face.sets.map((s) => (
          <li key={s} className="border-l-2 pl-3 text-[15px] text-fg" style={{ borderColor: color }}>
            {s}
          </li>
        ))}
      </ul>
      <Link href={`/party/c/${encodeURIComponent(mainLight.id)}/gear`} className="mt-3 inline-block text-[12px] text-accent hover:underline">
        Full gear
      </Link>
    </div>
  ) : (
    <Empty>No gear captured for {mainLight.name}.</Empty>
  );

  const ach = achievementsSummary();
  modules.achievements = (
    <ul className="space-y-2.5">
      {ach.map((t) => (
        <Tally key={t.label} label={t.label} done={t.done} total={t.total} />
      ))}
    </ul>
  );

  const col = collectionsSummary(a);
  modules.collections = (
    <div>
      <ul className="space-y-2.5">
        <Tally label="Set pieces" done={col.pieces.collected} total={col.pieces.total} />
        <Tally label="Outfit styles" done={col.styles.unlocked} total={col.styles.total} />
      </ul>
      {col.mythics.length > 0 ? (
        <p className="mt-3 text-[12px] text-fg-muted">
          Mythics: {col.mythics.filter((m) => m.collected).length} of {col.mythics.length} recovered
        </p>
      ) : null}
    </div>
  );

  modules.houses =
    houses.length === 0 ? (
      <Empty>No houses owned.</Empty>
    ) : (
      <ul className="space-y-1.5 text-[13px]">
        {houses.slice(0, 8).map((h) => (
          <li key={h.collectibleId} className="flex justify-between gap-3">
            <span className="truncate text-fg">
              {h.name}
              {h.primary ? <span className="ml-1.5 text-[11px] text-accent">primary</span> : null}
            </span>
            <span className="shrink-0 text-fg-subtle">{h.location}</span>
          </li>
        ))}
        {houses.length > 8 ? <li className="text-[12px] text-fg-subtle">+ {houses.length - 8} more</li> : null}
      </ul>
    );

  modules.guilds =
    (a.guilds ?? []).length === 0 ? (
      <Empty>No guilds captured.</Empty>
    ) : (
      <ul className="space-y-1.5 text-[13px]">
        {(a.guilds ?? []).map((g) => (
          <li key={g.name} className="flex justify-between gap-3">
            <span className="truncate text-fg">{g.name}</span>
            <span className="shrink-0 text-fg-muted">
              {g.trader ? <span className="text-ok">Trader · </span> : null}
              {g.rank}
            </span>
          </li>
        ))}
      </ul>
    );

  const plan = planProgress();
  modules.plan =
    plan.length === 0 ? (
      <Empty>
        No targets yet.{" "}
        <Link href="/party/planner" className="text-accent hover:underline">
          Open the Planner
        </Link>
        .
      </Empty>
    ) : (
      <ul className="space-y-2.5">
        {plan.map((r) => (
          <li key={r.id}>
            <Link href="/party/planner" className="block hover:opacity-90">
              <div className="mb-1 flex justify-between gap-3 text-[13px]">
                <span className="truncate text-fg">{r.name}</span>
                <span className="shrink-0 tabular-nums text-fg-muted">
                  {r.essential.total > 0 ? `${r.essential.done}/${r.essential.total} mandatory` : `${r.all.done}/${r.all.total}`}
                </span>
              </div>
              <Bar value={r.essential.total > 0 ? r.essential.done : r.all.done} max={r.essential.total > 0 ? r.essential.total : r.all.total} />
            </Link>
          </li>
        ))}
      </ul>
    );

  const t = treasury(a, characters);
  modules.treasury = (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
      <div className="col-span-2">
        <dt className="text-[12px] text-fg-subtle">Gold, bank and every wallet</dt>
        <dd className="font-display text-[24px] leading-tight tabular-nums text-gold">{formatNumber(t.gold)}</dd>
      </div>
      {t.currencies.slice(0, 6).map((c) => (
        <div key={c.key}>
          <dt className="text-[12px] text-fg-subtle">{c.label}</dt>
          <dd className="tabular-nums text-fg">{formatNumber(c.value)}</dd>
        </div>
      ))}
    </dl>
  );

  const rows = rosterRows(a);
  modules.dailies = (
    <ul className="space-y-1.5 text-[13px]">
      {rows.map((r) => (
        <li key={r.id} className="flex justify-between gap-3">
          <span className="truncate text-fg">{r.name}</span>
          <span className="shrink-0">
            {!r.dailies ? (
              <span className="text-fg-subtle">not since reset</span>
            ) : (
              <span className={r.dailies.done >= r.dailies.total ? "text-ok" : "text-fg-muted"}>
                {r.dailies.done}/{r.dailies.total}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  const hrefs: Record<string, string> = {
    characters: "/party/characters",
    wearing: `/party/c/${encodeURIComponent(mainLight.id)}/gear`,
    achievements: "/party/achievements",
    collections: "/party/collections",
    houses: "/party/collections?tab=houses",
    guilds: "",
    plan: "/party/planner",
    treasury: "/party/inventory",
    dailies: "/party/dailies",
  };

  return <ProfileView header={header} profile={profile} modules={modules} hrefs={hrefs} />;
}
