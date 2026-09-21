import Link from "next/link";
import { Coins, Gem, Shield, Sparkles } from "lucide-react";
import type { Character } from "@/lib/snapshot/schema";
import type { GoldBreakdown } from "@/lib/snapshot/roster";
import { accountTelVar } from "@/lib/snapshot/roster";
import { formatGold, formatNumber } from "@/lib/format";
import { Card, SectionTitle } from "./ui";

function walletCell(lastSeen: number | null | undefined, amount: number): string {
  if (!lastSeen) return "—";
  return formatNumber(amount);
}

const ACCOUNT_CURRENCIES: { key: string; label: string; icon: typeof Gem }[] = [
  { key: "transmuteCrystals", label: "Transmute crystals", icon: Gem },
  { key: "writVouchers", label: "Writ vouchers", icon: Sparkles },
  { key: "alliancePoints", label: "Alliance points", icon: Shield },
];

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

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Coins className="h-4 w-4 text-fg-subtle" />
          <SectionTitle className="mb-0">Gold & Tel Var</SectionTitle>
        </div>
        {gold.usedLegacy ? (
          <Card className="px-4 py-3 text-sm text-fg-muted">
            Account gold is {formatGold(gold.total)} from the last snapshot, but wallets are not split yet. Log each
            character out (or ReloadUI) once to fill per-character gold and Tel Var the way Inventory Insight does.
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-subtle">
                    <th className="px-4 py-2.5 font-medium">Character</th>
                    <th className="px-3 py-2.5 font-medium text-right">Gold</th>
                    <th className="px-3 py-2.5 font-medium text-right">Tel Var</th>
                  </tr>
                </thead>
                <tbody>
                  {characters.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 hover:bg-surface-2/50">
                      <td className="px-4 py-2">
                        <Link href={`/characters/${encodeURIComponent(c.id)}`} className="text-fg hover:text-accent hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                        {c.lastSeen ? formatGold(c.gold ?? 0) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                        {walletCell(c.lastSeen, c.telVar ?? 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/60">
                    <td className="px-4 py-2 text-fg-muted">Bank</td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg-muted">{formatGold(bankGold)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-fg-subtle">—</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-surface-2/40">
                    <td className="px-4 py-2.5 font-medium text-fg">Account total</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-fg">{formatGold(gold.total)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-fg">
                      {formatNumber(telVarTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Account currencies</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ACCOUNT_CURRENCIES.map(({ key, label, icon: Icon }) => (
            <Card key={key} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs uppercase tracking-wider text-fg-subtle">{label}</div>
                <div className="text-base font-semibold tabular-nums text-fg">
                  {formatNumber(currencies[key] ?? 0)}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
