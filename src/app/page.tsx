import Link from "next/link";
import { Backpack, BookMarked, Library, Trophy, Users } from "lucide-react";
import { getAccount, getArchivedCharacters, getAutoSetup, getCharacters, getDataSource, getItemCount, getStickerbookStats } from "@/lib/db/queries";
import { listAssignments, listRoles } from "@/lib/db/roles";
import { rolesForCharacter } from "@/lib/roles/filter";
import { candidatePaths } from "@/lib/snapshot/locate";
import { Card, PageHeader, Stat, TileLink, EmptyState, Badge } from "@/components/ui";
import { CharacterCard } from "@/components/character-card";
import { DataSourceBanner } from "@/components/data-source-banner";
import { LoadDemoButton } from "@/components/demo-controls";
import { formatDateTime, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const account = safe(() => getAccount());
  const dataSource = safe(() => getDataSource());
  const autoSetup = safe(() => getAutoSetup());
  if (!account) return <Onboarding setup={autoSetup} scanned={safe(() => candidatePaths()) ?? []} />;

  const characters = safe(() => getCharacters()) ?? [];
  const archived = safe(() => getArchivedCharacters()) ?? [];
  const itemCount = safe(() => getItemCount()) ?? 0;
  const sticker = safe(() => getStickerbookStats()) ?? { total: 0, collected: 0, sets: 0 };
  const stickerPct = sticker.total ? Math.round((sticker.collected / sticker.total) * 100) : 0;
  const roles = safe(() => listRoles()) ?? [];
  const assignments = safe(() => listAssignments()) ?? {};
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

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Characters" value={characters.length} />
        <Stat label="Champion Points" value={accountCP.toLocaleString("en-US")} hint="account-wide" />
        <Stat label="Items tracked" value={itemCount.toLocaleString("en-US")} hint="across all bags" />
        <Stat label="Stickerbook" value={`${stickerPct}%`} hint={`${sticker.collected}/${sticker.total} pieces`} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">Characters</h2>
          <Link href="/characters" className="text-sm text-accent hover:underline">
            {archived.length > 0
              ? `View all · ${archived.length} archived`
              : "View all"}
          </Link>
        </div>
        {characters.length === 0 ? (
          <Card className="px-5 py-8 text-center text-sm text-fg-muted">
            No characters captured yet. Log a character out (or ReloadUI) with the addon installed.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                assigned={rolesForCharacter(c.id, roles, assignments)}
                roles={roles}
              />
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
            description="Bags, bank, and currencies."
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
      ) : (
        <EmptyState title="Point Nirnside at your ESO folder" icon={<Users className="h-8 w-8" />}>
          <p className="mb-4">
            Nirnside looks in the usual Documents folders by itself. If it didn&apos;t find ESO here — unusual path,
            another drive, or this machine doesn&apos;t have the game — tell it where to look. It then installs its
            addons and reads the files the game writes. Nothing is uploaded anywhere.
          </p>
          <Link
            href="/setup"
            className="inline-flex items-center rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg"
          >
            Open Setup
          </Link>
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
