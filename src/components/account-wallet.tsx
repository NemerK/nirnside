"use client";

import { formatGold, formatNumber } from "@/lib/format";
import { walletEntries, type WalletBreakdownLine, type WalletEntry } from "@/lib/currencies";
import { Card, SectionTitle } from "./ui";

function formatLine(key: string, amount: number | null): string {
  if (amount == null) return "—";
  return key === "gold" ? formatGold(amount) : formatNumber(amount);
}

function Breakdown({
  entry,
}: {
  entry: WalletEntry;
}) {
  const lines = entry.breakdown;
  if (!lines?.length && !entry.sharedNote) return null;
  return (
    <div className="pointer-events-none absolute left-0 top-[calc(100%+0.35rem)] z-40 hidden w-64 rounded-lg border border-border bg-bg-elev p-2 shadow-lg group-hover:block group-focus-within:block">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{entry.label}</div>
      {entry.sharedNote && !lines?.length ? (
        <p className="text-xs text-fg-muted">{entry.sharedNote}</p>
      ) : (
        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
          {lines?.map((line) => (
            <li key={line.name} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-fg">{line.name}</span>
              <span className={`shrink-0 tabular-nums ${entry.colorClass}`}>{formatLine(entry.key, line.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccountWallet({
  currencies = {},
  title = "Currencies",
  compact = false,
  includeZero = false,
  rows,
}: {
  currencies?: Record<string, number>;
  title?: string;
  compact?: boolean;
  includeZero?: boolean;
  rows?: WalletEntry[];
}) {
  const shown = rows ?? walletEntries(currencies, { includeZero });
  if (shown.length === 0) return null;

  return (
    <section>
      {title ? <SectionTitle className={compact ? "mb-2" : undefined}>{title}</SectionTitle> : null}
      <div className={`grid grid-cols-2 gap-2 overflow-visible sm:grid-cols-3 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-4"}`}>
        {shown.map((row) => (
          <div key={row.key} className="group relative">
            <Card className="flex h-full items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0 text-xs uppercase tracking-wider text-fg-subtle">{row.label}</div>
              <div className={`shrink-0 text-sm font-semibold tabular-nums ${row.colorClass}`}>
                {formatNumber(row.amount)}
              </div>
            </Card>
            <Breakdown entry={row} />
          </div>
        ))}
      </div>
    </section>
  );
}

export type { WalletBreakdownLine };
