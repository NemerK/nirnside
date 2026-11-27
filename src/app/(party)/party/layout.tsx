import type { Metadata } from "next";
import localFont from "next/font/local";
import "../../party.css";
import { PartyShell } from "@/components/party/party-shell";
import type { PartyAccount, PartyMember } from "@/components/party/types";
import { getAccount, getCharacters } from "@/lib/db/queries";
import { classIcon } from "@/lib/classes";
import { applyRosterOrder, getRosterOrder } from "@/lib/roster/order";
import { getDisabledModules } from "@/lib/modules";

// Bundled, not fetched: Nirnside has to work with no network at all.
const body = localFont({
  variable: "--font-party-body",
  display: "swap",
  src: [
    { path: "../../fonts/sora-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/sora-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../fonts/sora-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});
const display = localFont({
  variable: "--font-party-display",
  display: "swap",
  src: [{ path: "../../fonts/marcellus-latin-400-normal.woff2", weight: "400", style: "normal" }],
});

export const metadata: Metadata = {
  title: "Nirnside — your party",
  description: "Your Elder Scrolls Online characters and account, out of game and on your own machine.",
};

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * The Party look's own root layout. Only the light roster columns are read
 * here; each page loads the one character or account section it shows.
 */
export default function PartyLayout({ children }: { children: React.ReactNode }) {
  const a = safe(() => getAccount(), null);
  const account: PartyAccount | null = a
    ? { displayName: a.displayName, region: a.region, esoPlus: a.esoPlus, lastSnapshot: a.lastSnapshot }
    : null;
  const members: PartyMember[] = a
    ? safe(
        () =>
          applyRosterOrder(getCharacters(), getRosterOrder()).map((c) => ({
            id: c.id,
            name: c.name,
            className: c.class,
            race: c.race,
            level: c.level,
            championPoints: c.championPoints,
            lastSeen: c.lastSeen,
            vampireStage: c.vampire.isVampire ? c.vampire.stage || 1 : 0,
            werewolf: c.werewolf.isWerewolf,
            crest: classIcon(c.class) ?? null,
          })),
        [],
      )
    : [];

  return (
    <html lang="en" className={`party ${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full">
        <PartyShell account={account} members={members} disabled={safe(() => getDisabledModules(), [])}>
          {children}
        </PartyShell>
      </body>
    </html>
  );
}
