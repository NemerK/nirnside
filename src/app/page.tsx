import Link from "next/link";
import { Download, MonitorSmartphone, Users } from "lucide-react";
import { getAccount, getArchivedCharacters, getAutoSetup, getCharacters, getCharactersFull, getHouses, getItemCount, getOutfitStyles, getStickerbookStats } from "@/lib/db/queries";
import { listGoals, skillLineChoices } from "@/lib/db/goals";
import { getSkillLineByName } from "@/lib/db/catalog-queries";
import { candidatePaths, seesWindowsDocuments } from "@/lib/snapshot/locate";
import { accountAlliancePoints, accountTelVar, goldBreakdown } from "@/lib/snapshot/roster";
import { characterWalletBreakdown, dashboardWallet } from "@/lib/currencies";
import { Card, PageHeader, Stat, EmptyState, Badge, SectionTitle } from "@/components/ui";
import { LoadDemoButton } from "@/components/demo-controls";
import { GoalsBoard } from "@/components/goals-board";
import { AccountWallet } from "@/components/account-wallet";
import { toGoalSubject } from "@/lib/goals/progress";
import type { Goal } from "@/lib/goals/types";
import { presentOutfitStyles, summarizeAccountKnowledge } from "@/lib/knowledge/present";
import { liveCharacters } from "@/lib/snapshot/roster";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const account = safe(() => getAccount());
  const autoSetup = safe(() => getAutoSetup());
  if (!account)
    return (
      <Onboarding
        setup={autoSetup}
        scanned={safe(() => candidatePaths()) ?? []}
        onGamingPc={process.platform === "win32" || process.platform === "darwin" || seesWindowsDocuments()}
      />
    );

  const characters = safe(() => getCharacters()) ?? [];
  const archived = safe(() => getArchivedCharacters()) ?? [];
  const itemCount = safe(() => getItemCount()) ?? 0;
  const sticker = safe(() => getStickerbookStats()) ?? { total: 0, collected: 0, sets: 0 };
  const stickerPct = sticker.total ? Math.round((sticker.collected / sticker.total) * 100) : 0;
  const goals = safe(() => listGoals()) ?? [];
  const lines = safe(() => skillLineChoices()) ?? [];
  // Champion Points are account-wide, so show one number for the whole account.
  const accountCP = characters.reduce((m, c) => Math.max(m, c.championPoints ?? 0), 0);
  const gold = goldBreakdown({
    characters,
    bankGold: account.currencies?.bankGold ?? 0,
    legacyGold: account.gold,
  });
  const telVar = accountTelVar({
    characters,
    legacyTelVar: account.currencies?.telVar,
  });
  const alliancePoints = accountAlliancePoints({
    characters,
    legacyAlliancePoints: account.currencies?.alliancePoints,
  });

  const houses = safe(() => getHouses()) ?? [];
  const knowledge = summarizeAccountKnowledge(liveCharacters(safe(() => getCharactersFull()) ?? []));
  const styles = presentOutfitStyles(safe(() => getOutfitStyles()) ?? []);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Link href="/characters" className="block h-full rounded-xl transition-colors hover:brightness-110">
          <Stat
            label="Characters"
            value={characters.length}
            hint={archived.length > 0 ? `${archived.length} archived` : "live roster"}
          />
        </Link>
        <Stat label="Champion Points" value={accountCP.toLocaleString("en-US")} hint="account-wide" />
        <Link href="/inventory" className="block h-full rounded-xl transition-colors hover:brightness-110">
          <Stat label="Items" value={itemCount.toLocaleString("en-US")} hint="across all bags" />
        </Link>
        <Link href="/stickerbook" className="block h-full rounded-xl transition-colors hover:brightness-110">
          <Stat label="Stickerbook" value={`${stickerPct}%`} hint={`${sticker.collected}/${sticker.total} pieces`} />
        </Link>
        <Link href="/dailies" className="block h-full rounded-xl transition-colors hover:brightness-110">
          <Stat label="Dailies" value="Board" hint="randoms, writs, pledges" />
        </Link>
        <Link href="/houses" className="block h-full rounded-xl transition-colors hover:brightness-110">
          <Stat label="Houses" value={houses.length} hint="owned on this account" />
        </Link>
        <Link href="/knowledge" className="block h-full rounded-xl transition-colors hover:brightness-110">
          <Stat
            label="Knowledge"
            value={knowledge.motifTotal ? `${Math.round((knowledge.motifKnown / knowledge.motifTotal) * 100)}%` : "Board"}
            hint={knowledge.motifTotal ? `${knowledge.motifKnown}/${knowledge.motifTotal} motif chapters` : "research, motifs, recipes"}
          />
        </Link>
        <Link href="/styles" className="block h-full rounded-xl transition-colors hover:brightness-110">
          <Stat
            label="Outfit Styles"
            value={styles.total ? `${Math.round((styles.unlocked / styles.total) * 100)}%` : "—"}
            hint={styles.total ? `${styles.unlocked}/${styles.total} unlocked` : "collections"}
          />
        </Link>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-2">
          <SectionTitle className="mb-0">Currencies</SectionTitle>
          <Link href="/inventory?view=currency" className="text-xs text-fg-subtle hover:text-accent">
            Full table
          </Link>
        </div>
        <AccountWallet
          rows={dashboardWallet({
            gold: gold.total,
            telVar,
            currencies: { ...(account.currencies ?? {}), alliancePoints },
            breakdowns: {
              gold: characterWalletBreakdown(characters, "gold", [{ name: "Bank", amount: gold.bank }]),
              telVar: characterWalletBreakdown(characters, "telVar"),
              alliancePoints: characterWalletBreakdown(characters, "alliancePoints"),
            },
          })}
          title=""
          compact
        />
      </section>

      <GoalsBoard
        goals={goals}
        live={characters.map(toGoalSubject)}
        roster={[...characters, ...archived].map(toGoalSubject)}
        lines={lines}
        hrefForLine={lineHrefs(goals)}
      />

      {account.guilds?.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-subtle">Guilds</h2>
          <div className="flex flex-wrap gap-2">
            {account.guilds.map((g) => (
              <Card key={g.name} className="flex items-center gap-2 px-3 py-2">
                <span className="text-sm text-fg">{g.name}</span>
                {g.rank && <Badge tone="muted">{g.rank}</Badge>}
                {g.trader && <Badge tone="accent">Trader</Badge>}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function lineHrefs(goals: Goal[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of goals) {
    const key = g.lineName.toLowerCase();
    if (out[key]) continue;
    try {
      const row = getSkillLineByName(g.lineName);
      if (row) out[key] = `/encyclopedia/skills/${encodeURIComponent(row.entry.id)}`;
    } catch {
      // catalog missing this line
    }
  }
  return out;
}

// Link straight at the .exe so a click downloads it — GitHub hides release
// files under a collapsed "Assets" section that people miss.
const EXE_DOWNLOAD_URL = "https://github.com/NemerK/nirnside/releases/latest/download/Nirnside.exe";
const RELEASES_URL = "https://github.com/NemerK/nirnside/releases/latest";

function Onboarding({
  setup,
  scanned,
  onGamingPc,
}: {
  setup: ReturnType<typeof getAutoSetup>;
  scanned: string[];
  onGamingPc: boolean;
}) {
  const foundEso = (setup?.addOnsDirs.length ?? 0) > 0;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Welcome to Nirnside"
        subtitle="Your Elder Scrolls Online account, viewable outside the game — and entirely on your own machine."
      />
      {foundEso ? (
        <EmptyState title="Addon installed — waiting for your first snapshot" icon={<Users className="h-8 w-8" />}>
          <p className="mb-4">
            Nirnside found your ESO install and set up its addon in{" "}
            <code className="rounded bg-surface-2 px-1">{setup!.addOnsDirs.length}</code> AddOns folder(s) automatically.
            One click left:
          </p>
          <ol className="mx-auto max-w-md list-decimal space-y-2 text-left text-fg">
            <li>
              In game, open <span className="font-medium">AddOns</span> and enable{" "}
              <span className="font-medium">Nirnside Snapshot</span>.
            </li>
            <li>
              Log a character out, or type <code className="rounded bg-surface-2 px-1">/reloadui</code>. Zoning and
              instances do not snapshot. Optional: <code className="rounded bg-surface-2 px-1">/nirnside</code> or the{" "}
              <span className="font-medium">Save Nirnside snapshot</span> keybind, then log out to write it.
            </li>
            <li>Your account appears here within seconds, and refreshes on every logout after that.</li>
          </ol>
          <p className="mt-4">
            <Link href="/setup" className="text-accent hover:underline">
              Change ESO folder or see setup details
            </Link>
          </p>
        </EmptyState>
      ) : onGamingPc ? (
        <EmptyState title="Almost there — point Nirnside at your ESO folder" icon={<Users className="h-8 w-8" />}>
          <p className="mb-4">
            Nirnside checks your Documents automatically, including OneDrive. It didn&apos;t spot ESO here — it may be on
            another drive or an unusual path. Choose your{" "}
            <code className="rounded bg-surface-2 px-1">Elder Scrolls Online</code> folder once and you&apos;re done.
            Nothing is uploaded.
          </p>
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg"
          >
            <MonitorSmartphone className="h-4 w-4" />
            Open Setup
          </Link>
        </EmptyState>
      ) : (
        <EmptyState title="Run Nirnside on the PC where you play ESO" icon={<MonitorSmartphone className="h-8 w-8" />}>
          <p className="mb-4">
            Nirnside reads the files ESO saves on your gaming PC, so it runs on that same computer — no accounts, no
            servers, nothing uploaded. This copy looks like it&apos;s on a different machine, so it can&apos;t see your
            game folder.
          </p>
          <p className="mb-4 font-medium text-fg">On your Windows gaming PC:</p>
          <ol className="mx-auto mb-5 max-w-md list-decimal space-y-2 text-left text-fg">
            <li>
              Download <span className="font-medium">Nirnside.exe</span> and double-click it. No Node, Visual Studio, or
              Python — a browser tab opens on its own.
            </li>
            <li>
              It finds your account automatically. In ESO, enable{" "}
              <span className="font-medium">Nirnside Snapshot</span> and log out once.
            </li>
          </ol>
          <a
            href={EXE_DOWNLOAD_URL}
            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg"
          >
            <Download className="h-4 w-4" />
            Download Nirnside.exe (Windows)
          </a>
          <p className="mt-3 text-xs text-fg-subtle">
            Downloads the app directly. For the zip, macOS/Linux, or all files, see{" "}
            <a href={RELEASES_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              all downloads
            </a>
            .
          </p>
          <p className="mt-4 text-sm text-fg-muted">
            Already on your gaming PC?{" "}
            <Link href="/setup" className="text-accent hover:underline">
              Point it at your ESO folder
            </Link>
            .
          </p>
        </EmptyState>
      )}

      <div className="mt-5 flex flex-col items-center gap-2">
        <LoadDemoButton />
        <p className="text-xs text-fg-subtle">
          Just want a look around? Loads a clearly-labelled sample account you can remove anytime.
        </p>
      </div>

      <details className="mt-8 rounded-xl border border-border bg-surface/60 p-4 text-sm">
        <summary className="cursor-pointer text-fg-muted">Where Nirnside looked ({scanned.length} locations)</summary>
        <p className="mt-3 text-xs text-fg-subtle">
          Nirnside checks these automatically (including OneDrive-redirected Documents). If your files live somewhere
          unusual, pick the folder in{" "}
          <Link href="/setup" className="text-accent hover:underline">
            Setup
          </Link>
          .
        </p>
        {setup?.addOnsDirs.length ? (
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">AddOns folders found</div>
            <ul className="mt-1 space-y-0.5">
              {setup.addOnsDirs.map((d) => (
                <li key={d} className="font-mono text-xs text-fg">
                  {d}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Snapshot paths checked</div>
          <ul className="mt-1 space-y-0.5">
            {scanned.map((p) => (
              <li key={p} className="font-mono text-xs text-fg-muted">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
