import Link from "next/link";
import { Backpack, BookMarked, Coins, Library, Shield, Sparkles, Trophy, Users } from "lucide-react";
import { getAccount, getAutoSetup, getCharacters, getDataSource, getItemCount, getStickerbookStats } from "@/lib/db/queries";
import { candidatePaths } from "@/lib/snapshot/locate";
import { Card, PageHeader, Stat, TileLink, EmptyState, Badge } from "@/components/ui";
import { CharacterCard } from "@/components/character-card";
import { DataSourceBanner } from "@/components/data-source-banner";
import { LoadDemoButton } from "@/components/demo-controls";
import { formatDateTime, formatGold, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const account = safe(() => getAccount());
  const dataSource = safe(() => getDataSource());
  const autoSetup = safe(() => getAutoSetup());
  if (!account) return <Onboarding setup={autoSetup} scanned={safe(() => candidatePaths()) ?? []} />;

  const characters = safe(() => getCharacters()) ?? [];
  const itemCount = safe(() => getItemCount()) ?? 0;
  const sticker = safe(() => getStickerbookStats()) ?? { total: 0, collected: 0, sets: 0 };
  const stickerPct = sticker.total ? Math.round((sticker.collected / sticker.total) * 100) : 0;
  // Champion Points are account-wide, so show one number for the whole account.
  const accountCP = characters.reduce((m, c) => Math.max(m, c.championPoints ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome back, ${account.displayName}`}
        subtitle={`Everything below is a snapshot as of ${formatDateTime(account.lastSnapshot)} · ${timeAgo(
          account.lastSnapshot,
        )}`}
      />

      <DataSourceBanner source={dataSource} setup={autoSetup} />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Characters" value={characters.length} />
        <Stat label="Champion Points" value={accountCP.toLocaleString("en-US")} hint="account-wide" />
        <Stat label="Items tracked" value={itemCount.toLocaleString("en-US")} hint="across all bags" />
        <Stat label="Stickerbook" value={`${stickerPct}%`} hint={`${sticker.collected}/${sticker.total} pieces`} />
        <Stat label="Gold" value={formatGold(account.gold)} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">Characters</h2>
          <Link href="/characters" className="text-sm text-accent hover:underline">
            View all
          </Link>
        </div>
        {characters.length === 0 ? (
          <Card className="px-5 py-8 text-center text-sm text-fg-muted">
            No characters captured yet. Log a character out (or ReloadUI) with the addon installed.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c) => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-subtle">Jump in</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TileLink
            href="/inventory"
            title="Inventory"
            description="Every item, every bag, with filters."
            icon={<Backpack className="h-5 w-5" />}
          />
          <TileLink
            href="/stickerbook"
            title="Stickerbook"
            description="What you've collected and what's missing."
            icon={<BookMarked className="h-5 w-5" />}
          />
          <TileLink
            href="/achievements"
            title="Achievements"
            description="Trial, arena & dungeon completion board."
            icon={<Trophy className="h-5 w-5" />}
          />
          <TileLink
            href="/encyclopedia"
            title="Encyclopedia"
            description="Live Tamriel data: sets, skills, CP, scribing."
            icon={<Library className="h-5 w-5" />}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniInfo icon={<Coins className="h-4 w-4" />} label="Transmute crystals" value={account.currencies?.transmuteCrystals ?? 0} />
        <MiniInfo icon={<Sparkles className="h-4 w-4" />} label="Writ vouchers" value={account.currencies?.writVouchers ?? 0} />
        <MiniInfo icon={<Shield className="h-4 w-4" />} label="Alliance points" value={account.currencies?.alliancePoints ?? 0} />
      </div>

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

function MiniInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent">
        {icon}
      </span>
      <div>
        <div className="text-xs uppercase tracking-wider text-fg-subtle">{label}</div>
        <div className="text-base font-semibold text-fg">{value.toLocaleString("en-US")}</div>
      </div>
    </Card>
  );
}

function Onboarding({
  setup,
  scanned,
}: {
  setup: ReturnType<typeof getAutoSetup>;
  scanned: string[];
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
              Log a character out, or type <code className="rounded bg-surface-2 px-1">/reloadui</code>.
            </li>
            <li>Your account appears here within seconds, and refreshes on every logout after that.</li>
          </ol>
        </EmptyState>
      ) : (
        <EmptyState title="Looking for your account…" icon={<Users className="h-8 w-8" />}>
          <p className="mb-4">
            Nirnside sets itself up: on the PC where you play ESO it finds your install, installs its own addon, then
            auto-detects and live-refreshes your account. Nothing is uploaded anywhere.
          </p>
          <p className="text-fg-subtle">
            This preview is running on a remote machine with no ESO, so there&apos;s nothing to detect here. Run Nirnside
            on your gaming PC for the automatic experience.
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
          You don&apos;t need to configure any of these — Nirnside checks them all automatically. OneDrive appears
          because Windows often redirects your Documents folder into it. If your file is somewhere unusual, set{" "}
          <code className="rounded bg-surface-2 px-1">NIRNSIDE_SV_FILE</code>.
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
