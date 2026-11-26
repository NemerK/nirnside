import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccount, getCharacters } from "@/lib/db/queries";
import { applyRosterOrder, getRosterOrder } from "@/lib/roster/order";

export const dynamic = "force-dynamic";

/** Party opens on the character you last logged out on. */
export default function PartyHome() {
  let target: string | null = null;
  let hasAccount = false;
  try {
    hasAccount = getAccount() != null;
    const roster = applyRosterOrder(getCharacters(), getRosterOrder());
    const seen = roster
      .filter((c) => c.lastSeen != null)
      .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
    target = seen[0]?.id ?? roster[0]?.id ?? null;
  } catch {
    target = null;
  }
  if (target) redirect(`/party/c/${encodeURIComponent(target)}`);
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="font-display text-4xl text-fg">Your party is empty</h1>
      <p className="mt-3 text-fg-muted">
        {hasAccount
          ? "Log a character out in game with the Nirnside Snapshot addon on, and they join the party here."
          : "Nirnside hasn't read your account yet. Setup finds your ESO folder and installs the addon."}
      </p>
      <Link href="/setup" className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg">
        Open Setup
      </Link>
    </div>
  );
}
