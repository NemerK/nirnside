import { LivingHomeView } from "@/components/living-home";
import { classColor, classIcon } from "@/lib/classes";
import { canonicalizeCurrencies } from "@/lib/game/currencies";
import { getAccount, getCharactersFull, getHouses } from "@/lib/db/queries";
import { timeAgo } from "@/lib/format";
import { profileMedia } from "@/lib/db/profile";
import { profileImageUrl } from "@/lib/profile/media";
import { livingHome, withGuilds } from "@/lib/home/living";
import { lineCap } from "@/lib/db/game-knowledge";
import { accountAlliancePoints, accountTelVar, goldBreakdown, liveCharacters } from "@/lib/snapshot/roster";

/** The account home: one character as the profile, built from the local snapshot. */
export function LivingHomeScreen() {
  const account = safe(() => getAccount());
  if (!account) return null;

  const characters = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const houses = safe(() => getHouses()) ?? [];
  const model = withGuilds(
    livingHome(characters, houses, lineCap),
    (account.guilds ?? []).map((guild) => ({ name: guild.name, rank: guild.rank, trader: guild.trader })),
  );
  const gold = goldBreakdown({
    characters,
    bankGold: account.currencies?.bankGold ?? 0,
    legacyGold: account.gold,
  });
  const wallet = canonicalizeCurrencies(account.currencies);
  const pictures = safe(() => profileMedia()) ?? { avatar: null, banner: null };
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
      model={model}
      iconByClass={iconByClass}
      colorByClass={colorByClass}
      portraitUrl={pictures.avatar != null ? profileImageUrl("avatar", pictures.avatar) : null}
      bannerUrl={pictures.banner != null ? profileImageUrl("banner", pictures.banner) : null}
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
