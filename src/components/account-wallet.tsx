import { formatNumber } from "@/lib/format";
import { walletEntries } from "@/lib/currencies";
import { Card, SectionTitle } from "./ui";

export function AccountWallet({
  currencies = {},
  title = "Currencies",
  compact = false,
}: {
  currencies?: Record<string, number>;
  title?: string;
  compact?: boolean;
}) {
  const rows = walletEntries(currencies);
  if (rows.length === 0) return null;

  return (
    <section>
      <SectionTitle className={compact ? "mb-2" : undefined}>{title}</SectionTitle>
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-4"}`}>
        {rows.map((row) => (
          <Card key={row.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0 text-xs uppercase tracking-wider text-fg-subtle">{row.label}</div>
            <div className={`shrink-0 text-sm font-semibold tabular-nums ${row.colorClass}`}>
              {formatNumber(row.amount)}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
