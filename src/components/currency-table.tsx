import Link from "next/link";
import type { Character } from "@/lib/snapshot/schema";
import type { GoldBreakdown } from "@/lib/snapshot/roster";
import { accountAlliancePoints, accountTelVar } from "@/lib/snapshot/roster";
import { formatGold, formatNumber } from "@/lib/format";
import { AccountWallet } from "./account-wallet";
import { Card } from "./ui";

function walletCell(lastSeen: number | null | undefined, amount: number): string {
  if (!lastSeen) return "—";
  return formatNumber(amount);
}

const COLS = "grid-cols-[minmax(8rem,1.6fr)_repeat(3,minmax(5.5rem,1fr))]";

/**
 * Account-wide currencies sit in a short strip. The per-character titles stay
 * put while the rows scroll underneath them.
 */
export function CurrencyTable({
  characters,
  bankGold = 0,
  gold,
  currencies = {},
}: {
  characters: Character[];
  bankGold?: number;
  gold: GoldBreakdown;
  currencies?: Record<string, number>;
}) {
  const telVarTotal = accountTelVar({
    characters,
    legacyTelVar: 0,
  });
  const apTotal = accountAlliancePoints({
    characters,
    legacyAlliancePoints: currencies.alliancePoints,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <AccountWallet currencies={currencies} title="Account-wide" compact />
      </div>

      {gold.usedLegacy ? (
        <Card className="px-4 py-3 text-sm text-fg-muted">
          Account gold is {formatGold(gold.total)} from the last snapshot, but wallets are not split yet. Log each
          character out (or ReloadUI) once to fill per-character gold, Tel Var, and Alliance Points.
        </Card>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className={`grid shrink-0 ${COLS} border-b border-border bg-surface text-xs uppercase tracking-wider text-fg-subtle`}>
            <div className="px-3 py-2 font-medium">Character</div>
            <div className="px-3 py-2 text-right font-medium">Gold</div>
            <div className="px-3 py-2 text-right font-medium">Tel Var</div>
            <div className="px-3 py-2 text-right font-medium">Alliance Points</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {characters.map((c) => (
              <div key={c.id} className={`grid ${COLS} border-b border-border/60 text-sm hover:bg-surface-2/50`}>
                <div className="min-w-0 px-3 py-1.5">
                  <Link href={`/characters/${encodeURIComponent(c.id)}`} className="truncate text-fg hover:text-accent hover:underline">
                    {c.name}
                  </Link>
                </div>
                <div className="px-3 py-1.5 text-right tabular-nums text-yellow-200">
                  {c.lastSeen ? formatGold(c.gold ?? 0) : "—"}
                </div>
                <div className="px-3 py-1.5 text-right tabular-nums text-sky-300">{walletCell(c.lastSeen, c.telVar ?? 0)}</div>
                <div className="px-3 py-1.5 text-right tabular-nums text-emerald-400">
                  {walletCell(c.lastSeen, c.alliancePoints ?? 0)}
                </div>
              </div>
            ))}
            <div className={`grid ${COLS} border-b border-border/60 text-sm`}>
              <div className="px-3 py-1.5 text-fg-muted">Bank</div>
              <div className="px-3 py-1.5 text-right tabular-nums text-yellow-200">{formatGold(bankGold)}</div>
              <div className="px-3 py-1.5 text-right tabular-nums text-fg-subtle">—</div>
              <div className="px-3 py-1.5 text-right tabular-nums text-fg-subtle">—</div>
            </div>
          </div>
          <div className={`grid shrink-0 ${COLS} border-t border-border bg-surface-2/40 text-sm`}>
            <div className="px-3 py-2 font-medium text-fg">Account total</div>
            <div className="px-3 py-2 text-right font-semibold tabular-nums text-yellow-200">{formatGold(gold.total)}</div>
            <div className="px-3 py-2 text-right font-semibold tabular-nums text-sky-300">{formatNumber(telVarTotal)}</div>
            <div className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-400">{formatNumber(apTotal)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
