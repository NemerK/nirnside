import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { Treasury } from "@/lib/party/overview";

/** Gold across the bank and every wallet, and the account's currencies. */
export function TreasuryStrip({ t, perCharacterHref }: { t: Treasury; perCharacterHref?: string }) {
  return (
    <section className="party-module mb-4 px-5 py-4">
      <dl className="flex flex-wrap gap-x-9 gap-y-3">
        <div>
          <dt className="text-[12px] text-fg-subtle">Gold, bank and every wallet</dt>
          <dd className="font-display text-[24px] leading-tight tabular-nums text-accent">{formatNumber(t.gold)}</dd>
          {t.bankGold > 0 ? <dd className="text-[12px] text-fg-subtle">{formatNumber(t.bankGold)} in the bank</dd> : null}
        </div>
        {t.currencies.map((c) => (
          <div key={c.key}>
            <dt className="text-[12px] text-fg-subtle">{c.label}</dt>
            <dd className="font-display text-[24px] leading-tight tabular-nums text-fg">{formatNumber(c.value)}</dd>
          </div>
        ))}
        {perCharacterHref ? (
          <div className="self-end">
            <Link href={perCharacterHref} className="text-[13px] text-accent hover:underline">
              Per character
            </Link>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
