import Link from "next/link";
import { Backpack, BookMarked, Coins, Library, Shield, Sparkles, Users } from "lucide-react";
import { getAccount, getCharacters, getItemCount, getStickerbookStats } from "@/lib/db/queries";
import { Card, PageHeader, Stat, TileLink, EmptyState, Badge } from "@/components/ui";
import { CharacterCard } from "@/components/character-card";
import { formatDateTime, formatGold, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const account = safe(() => getAccount());
  if (!account) return <Onboarding />;

  const characters = safe(() => getCharacters()) ?? [];
  const itemCount = safe(() => getItemCount()) ?? 0;
  const sticker = safe(() => getStickerbookStats()) ?? { total: 0, collected: 0, sets: 0 };
  const stickerPct = sticker.total ? Math.round((sticker.collected / sticker.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Welcome back, ${account.displayName}`}
        subtitle={`Everything below is a snapshot as of ${formatDateTime(account.lastSnapshot)} · ${timeAgo(
          account.lastSnapshot,
        )}`}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Characters" value={characters.length} />
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

function Onboarding() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Welcome to Nirnside"
        subtitle="Your Elder Scrolls Online account, viewable outside the game — and entirely on your own machine."
      />
      <EmptyState title="No account imported yet" icon={<Users className="h-8 w-8" />}>
        <p className="mb-4">
          Nirnside reads the data the game writes to disk. Nothing is uploaded anywhere. To get started:
        </p>
        <ol className="mx-auto max-w-md list-decimal space-y-2 text-left text-fg">
          <li>
            Install the <code className="rounded bg-surface-2 px-1">NirnsideSnapshot</code> addon (in{" "}
            <code className="rounded bg-surface-2 px-1">addon/</code>).
          </li>
          <li>Log into each character once, then log out or <code className="rounded bg-surface-2 px-1">/reloadui</code>.</li>
          <li>
            Run <code className="rounded bg-surface-2 px-1">npm run watch</code> (auto-import) or{" "}
            <code className="rounded bg-surface-2 px-1">npm run import</code> once.
          </li>
        </ol>
        <p className="mt-4 text-fg-subtle">
          Want to see it first? Run <code className="rounded bg-surface-2 px-1">npm run seed</code> to load sample data.
        </p>
      </EmptyState>
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
