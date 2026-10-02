/**
 * Live ESO wallet layout. Gold and Tel Var are character-bound (plus bank gold);
 * everything else is account-wide. Keys match what the snapshot addon writes.
 */

export type CurrencyScope = "account" | "hidden";

export type CurrencyDef = {
  key: string;
  label: string;
  /** Tailwind text color, matching the in-game wallet tints where we can. */
  colorClass: string;
  /** Show even when the amount is 0. */
  always?: boolean;
  /** Hidden keys are stored (bankGold) but rendered in the gold table instead. */
  scope: CurrencyScope;
};

/** Account-wide currencies, in the in-game CURRENCY window order. */
export const ACCOUNT_CURRENCIES: CurrencyDef[] = [
  { key: "alliancePoints", label: "Alliance Points", colorClass: "text-emerald-400", always: true, scope: "account" },
  { key: "archivalFortunes", label: "Archival Fortunes", colorClass: "text-amber-200", scope: "account" },
  { key: "cachesOfTomePoints", label: "Caches of Tome Points", colorClass: "text-amber-300", scope: "account" },
  { key: "crownGems", label: "Crown Gems", colorClass: "text-fuchsia-300", scope: "account" },
  { key: "crowns", label: "Crowns", colorClass: "text-yellow-200", scope: "account" },
  { key: "imperialFragments", label: "Imperial Fragments", colorClass: "text-sky-300", scope: "account" },
  { key: "outfitChangeTokens", label: "Outfit Change Tokens", colorClass: "text-lime-300", scope: "account" },
  { key: "premiumTomeTokens", label: "Premium Tome Tokens", colorClass: "text-amber-400", scope: "account" },
  { key: "seals", label: "Seals", colorClass: "text-rose-300", scope: "account" },
  { key: "tomePoints", label: "Tome Points", colorClass: "text-cyan-300", scope: "account" },
  { key: "tradeBars", label: "Trade Bars", colorClass: "text-yellow-400", scope: "account" },
  { key: "transmuteCrystals", label: "Transmute Crystals", colorClass: "text-violet-300", always: true, scope: "account" },
  { key: "undauntedKeys", label: "Undaunted Keys", colorClass: "text-fg", always: true, scope: "account" },
  { key: "writVouchers", label: "Writ Vouchers", colorClass: "text-emerald-300", always: true, scope: "account" },
  { key: "eventTickets", label: "Event Tickets", colorClass: "text-orange-300", scope: "account" },
];

const BY_KEY = new Map(ACCOUNT_CURRENCIES.map((c) => [c.key, c]));

/** Stored on the account record but shown in the gold/Tel Var table, not the wallet grid. */
const HIDDEN_KEYS = new Set(["bankGold", "telVar", "gold"]);

export type WalletEntry = {
  key: string;
  label: string;
  amount: number;
  colorClass: string;
};

function labelFromKey(key: string): string {
  const known = BY_KEY.get(key);
  if (known) return known.label;
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

/**
 * Home dashboard: Gold, Tel Var, then every live account-wide currency
 * (including zeros) so the list matches the in-game wallet window.
 */
export function dashboardWallet(opts: {
  gold: number;
  telVar: number;
  currencies?: Record<string, number>;
}): WalletEntry[] {
  return [
    { key: "gold", label: "Gold", amount: opts.gold, colorClass: "text-yellow-200" },
    { key: "telVar", label: "Tel Var Stones", amount: opts.telVar, colorClass: "text-sky-300" },
    ...walletEntries(opts.currencies, { includeZero: true }),
  ];
}

/**
 * Account wallet rows for Home and Inventory. Known currencies keep in-game
 * order; anything extra the live patch wrote is appended. Zero amounts hide
 * unless the currency is always-shown or `includeZero` is set.
 */
export function walletEntries(
  currencies: Record<string, number> | null | undefined,
  opts?: { includeZero?: boolean },
): WalletEntry[] {
  const src = currencies ?? {};
  const includeZero = opts?.includeZero === true;
  const seen = new Set<string>();
  const out: WalletEntry[] = [];

  for (const def of ACCOUNT_CURRENCIES) {
    if (def.scope !== "account") continue;
    seen.add(def.key);
    const amount = Number.isFinite(src[def.key]) ? Math.trunc(src[def.key]) : 0;
    if (amount === 0 && !def.always && !includeZero) continue;
    out.push({ key: def.key, label: def.label, amount, colorClass: def.colorClass });
  }

  for (const [key, raw] of Object.entries(src)) {
    if (seen.has(key) || HIDDEN_KEYS.has(key)) continue;
    const amount = Number.isFinite(raw) ? Math.trunc(raw) : 0;
    if (amount === 0 && !includeZero) continue;
    out.push({
      key,
      label: labelFromKey(key),
      amount,
      colorClass: "text-fg",
    });
  }

  return out;
}
