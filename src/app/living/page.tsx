import { redirect } from "next/navigation";
import { LivingHomeView } from "@/components/living-home";
import { classColor, classIcon } from "@/lib/classes";
import { canonicalizeCurrencies } from "@/lib/currencies";
import { getAccount, getCharactersFull, getHouses } from "@/lib/db/queries";
import { timeAgo } from "@/lib/format";
import { livingHome, withGuilds } from "@/lib/home/living";
import { skillLineCap } from "@/lib/skills/line-cap";
import { accountAlliancePoints, accountTelVar, goldBreakdown, liveCharacters } from "@/lib/snapshot/roster";

export const dynamic = "force-dynamic";

export default function LivingHomePage() {
  const account = safe(() => getAccount());
  if (!account) redirect("/");

  const characters = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const houses = safe(() => getHouses()) ?? [];
  const model = withGuilds(
    livingHome(characters, houses, skillLineCap),
    (account.guilds ?? []).map((guild) => ({ name: guild.name, rank: guild.rank, trader: guild.trader })),
  );
  const gold = goldBreakdown({
    characters,
    bankGold: account.currencies?.bankGold ?? 0,
    legacyGold: account.gold,
  });
  const wallet = canonicalizeCurrencies(account.currencies);
  const championPoints = characters.reduce((max, character) => Math.max(max, character.championPoints ?? 0), 0);
  const iconByClass: Record<string, string> = {};
  const colorByClass: Record<string, string> = {};
  for (const character of characters) {
    const icon = classIcon(character.class);
    const color = classColor(character.class);
    if (icon) iconByClass[character.class] = icon;
    if (color) colorByClass[character.class] = color;
  }

  return (
    <LivingHomeView
      accountName={account.displayName || "Your account"}
      region={account.region}
      esoPlus={account.esoPlus}
      snapshot={account.lastSnapshot ? `Snapshot ${timeAgo(account.lastSnapshot)}` : null}
      championPoints={championPoints}
      model={model}
      iconByClass={iconByClass}
      colorByClass={colorByClass}
      currencies={{
        gold: gold.total,
        telVar: accountTelVar({ characters, legacyTelVar: account.currencies?.telVar }),
        alliancePoints: accountAlliancePoints({ characters, legacyAlliancePoints: account.currencies?.alliancePoints }),
        writVouchers: wallet.writVouchers ?? 0,
        transmuteCrystals: wallet.transmuteCrystals ?? 0,
        undauntedKeys: wallet.undauntedKeys ?? 0,
      }}
    />
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
