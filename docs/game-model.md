# Nirnside's game model

Nirnside keeps one model of what things in ESO are and how they connect.
Pages and features read from it rather than keeping their own lists, so a
fact is written once and the same answer shows up everywhere.

The model lives in `src/lib/game/`:

| File | What it knows |
| --- | --- |
| `equipment.ts` | Piece kinds (armor weight × slot, jewelry, weapons, shields), the game's piece words (weighted ones, and the words unique pieces use, which give a slot but no weight), worn slots, reading a slot from any wording (`pieceSlotFromText`), which craft makes a piece, which research line covers it, which trait family it takes |
| `traits.ts` | The 27 researchable traits in research-grid order, plus Ornate and Intricate |
| `quality.ts` | Item qualities in the game's order, their theme colors |
| `skills.ts` | Skill line categories in the Skills window's order |
| `set-profile.ts` | What a set comes in: which weights for which slots, jewelry, weapons; its shape (full, monster head-and-shoulders, weapons-only, single-piece) |
| `loadout.ts` | How worn gear works together: set counts per bar, perfected and normal pieces as one set, two-handers as two, active bonuses (the perfected line needs perfected pieces), body armor per weight |
| `research.ts` | Trait research per piece kind, whether a piece can be crafted for a set and trait, idle research slots |
| `character.ts` | Races, their home alliances, what a race–alliance pairing means (home, Imperial's choice, Any Race Any Alliance), racial lines |
| `classes.ts` | The live classes, their three lines (from the catalog), a character's own / borrowed / swapped-out lines, subclassing rules, Class Mastery |
| `champion.ts` | The three constellations, the 3600 cap (1200 each), earning order, slottable vs passive stars, four slots per constellation |
| `weapon-lines.ts` | The six weapon lines and what each needs on the bar (two one-handers make Dual Wield, one plus a shield One Hand and Shield, a lone one-hander nothing), staff elements, per-weapon passives, armor lines |
| `addons.ts` | What an ESO addon is, how its saved data reaches Nirnside, the addons Nirnside works with, where each fact comes from and how fresh it is |
| `setups.ts` | A Wizard's Wardrobe setup read against the model: each bar's weapon line, skills a bar can't use, planned vs worn gear |
| `motifs.ts` | The 14 motif chapters and the pieces each covers, per-character style knowledge, the shared style key linking motifs and outfit styles |
| `mundus.ts` | The 13 Mundus stones as of Update 51 and what each boosts, one blessing (two with Twice-Born Star), Divines strengthening it, and the game's own text for each blessing |
| `buffs.ts` | Lasting buffs at the save (Mundus, food, drink), counted down from the save |
| `riding.ts` | Riding lessons: speed, stamina, capacity against their caps, and when the next lesson opens |
| `item-category.ts` | Where every item belongs: the game's inventory tabs and sub-tabs, in the game's order |
| `learn.ts` | Facts about the game a save carries (a blessing's text), turned into catalog rows |
| `food.ts` | One food or drink buff at a time; food raises maximums, drink recovery; recipe families and grades |
| `companions.ts` | Companion levels (20), bar, ultimate at 20, account-wide progress, class themes, armor lines needing five pieces, rapport |
| `understand.ts` | `readCharacter`: one character read through every system at once |
| `skill-caps.ts`, `class-mastery.ts`, `vengeance.ts` | Each skill line's rank cap (never a guessed 50), Class Mastery's rules, and the Vengeance lines Nirnside leaves out |
| `daily-reset.ts` | The megaserver reset clock (EU 03:00, NA 10:00 UTC; weekly on Tuesday) |
| `pledges.ts`, `pledge-objectives.ts`, `world-bosses.ts`, `zone-dailies.ts` | Undaunted givers and the community rotation, how a pledge journal shows its difficulty, world-boss and zone dailies by quest id |
| `currencies.ts` | The wallet: which currencies are character-bound and which account-wide |
| `pithka.ts` | Trial, dungeon and arena achievements by id, as Pithka's tracker lists them |
| `champion-bar.ts` | The Champion bar: equipped, off-bar and passive stars per constellation |
| `outfits.ts`, `mythics.ts` | Outfit styles by weight and slot as the outfit station filters them; mythics by name |
| `transmute.ts` | Transmute crystal costs: reconstruction and trait change |
| `item-index.ts` | Every item the account holds, plus the set collection's pieces, filed in its place (below) |

## Where the facts come from

In order of trust:

1. **The game itself.** The addons read ESO's API and its constants
   (`EQUIP_TYPE_*`, `ARMORTYPE_*`, `WEAPONTYPE_*`, `ITEM_TRAIT_TYPE_*`,
   `GetSmithingResearchLineInfo`, `GetItemSetCollectionPieceInfo` and so on)
   and write fixed labels for them. The model parses exactly those labels.
   It doesn't guess when the game reported the answer.
2. **The in-game catalog scan** (`/nirncatalog`, addon NirnsideCatalog):
   sets, skills, Champion Points, scribing and achievements, marked `ingame`.
3. **Reference documentation** for rules the API doesn't spell out, from
   UESP (Online:Traits, Online:Crafting):
   - Blacksmithing makes heavy armor and metal weapons. Clothing makes light
     and medium armor. Woodworking makes bows, staves and shields. Jewelry
     Crafting makes rings and necklaces.
   - A trait is researched per item type. Robes and jerkins share a line.
   - Shields take armor traits. Ornate and Intricate can't be researched.
4. **Names**, only where nothing better exists, as with older scans that
   didn't carry a type. The game names pieces by fixed words per weight
   ("Hat", "Helmet", "Helm"), so a name still places a piece exactly.

## How things connect

```
Character ──wears──▶ Item ──is a──▶ Piece kind ──made at──▶ Craft
    │                 │                 │                      │
    │                 │                 ├──takes──▶ Trait family ──▶ Traits
    │                 │                 └──researched on──▶ Research line
    │                 └──belongs to──▶ Set (set id) ──▶ bonuses, category, traits needed
    ├──knows──▶ Research line × trait (per character)
    ├──knows──▶ Motif chapters ──▶ Style ──▶ Outfit styles
    ├──has──▶ Skill lines ──▶ Category (Class, Weapon, …) ──▶ Class
    └──works towards──▶ Targets (skill lines, abilities, scripts)

Account ──collected──▶ Set pieces (sticker book), keyed by item id
```

Links use the game's ids wherever the scan has them: item id, set id,
ability id. Names are only used for display.

Examples of questions answered once and reused:

- **Who can craft this piece?** Take the piece kind's research line in that
  craft. A character can craft it when they know as many traits on that line
  as the set needs, plus the chosen trait.
- **Which traits can this piece have?** Use the piece kind's trait family. A
  shield gets armor traits.
- **Where does this item go in the sticker book?** Its piece kind gives the
  weight row and slot column, or the jewelry or weapons row.
- **Is a worn piece a weapon?** Read the worn slot. "Hands" is armor; only
  the main hand, off hand and poison slots hold weapons.

## Sets: what they come in

`setProfile` reads the pieces the game lists for a set and answers what the
set is made of. The sticker-book scan (`GetItemSetCollectionPieceInfo`) gives
every piece whether collected or not, so this is the game's own answer:

- A trial or dungeon set comes in light, medium and heavy in all seven slots,
  with necklace, rings, every weapon and a shield.
- A monster set is head and shoulders, in each weight.
- An arena set is weapons only.
- A mythic is a single piece.

`setComesIn(profile, "heavy", "legs")` answers "can I wear this set as heavy
legs?". `setProfiles()` (db) builds every set's profile from the sticker book
plus items learned in play.

## Worn gear

`loadoutOf(equipped)` applies the game's rules:

- Body armor and jewelry count on both bars. Weapons count only while their
  bar is out.
- A two-handed weapon counts as two pieces.
- Every bonus up to the worn count is active.
- Perfected and normal pieces are one set when worn. Every piece counts
  toward the normal bonuses; the perfected line counts only perfected
  pieces. Four perfected and one normal give the full set except the
  perfected bonus. They are collected separately: the normal piece drops
  in veteran, the perfected one in veteran hard mode. The two versions have
  their own set ids, so the loadout groups them by name without "Perfected".
- Body pieces are counted per weight, which armor passives scale with. A
  shield isn't body armor.

Sources: the owner, and the game's own tooltip, which checks a bonus line
flagged perfected (`GetItemLinkSetBonusInfo`'s third return, recorded as
`perfected` since addon 0.9.43) against the perfected count, and every
other line against the full count. Newer scans also record the game's own
counts (`GetItemLinkSetInfo(link, true)`) as `setCount` / `setPerfectedCount`;
the loadout keeps them as `gameCount` / `gamePerfectedCount`. They are for
the bar that was out at the save.

## Research

`researchByPiece(research)` turns a character's scanned research grid into
known and in-progress traits per piece kind. `canCraft(byPiece, piece,
traitsNeeded, trait)` answers whether they can make that piece for a set: it
needs enough known traits on the line, and the chosen trait among them.
`idleSlots` counts the research slots not in use. A craft with every trait
known has no idle slots, because there is nothing left to research.

## Addons: how the data gets here

Nirnside never talks to the game directly. Everything arrives through ESO
addons:

- An addon is Lua the ESO client loads at login, described by a `.txt`
  manifest (`## APIVersion`, `## SavedVariables`, `## DependsOn` /
  `## OptionalDependsOn`). It runs inside the client, sees only what
  ZeniMax's public API exposes, and can't act beyond it.
- Its only storage is SavedVariables. They are held in game memory and
  written to disk at a /reloadui, a zone change with a loading screen, a
  logout or a quit. A crash or Alt+F4 can skip that write. So **every fact
  is "as of the last save"**: research timers keep running in the game,
  and dailies reset (`countDown`, `freshness`).
- One addon can read another's tables in game when it loads after it
  (`## OptionalDependsOn`).

The addons Nirnside works with (`KNOWN_ADDONS`):

| Addon | Who | What its data is |
| --- | --- | --- |
| Nirnside Snapshot | ours | The game's state, read from the API at logout |
| Nirnside Catalog | ours, opt-in | The game's catalog, on `/nirncatalog` |
| Wizard's Wardrobe | third party | **The player's plans**: setups per zone, page and boss (gear, both bars, Champion Points, food), swapped in when a boss bar appears |

Nirnside Snapshot loads after Wizard's Wardrobe (`## OptionalDependsOn`) and
copies the setups of the page the player has open (this character, another
character, or account-wide storage). Those setups are another addon's
record of intent, not the game's state, so the model reads them against
the game (`readSetup`):

- the weapon line each of the setup's bars makes;
- the setup's skills from a weapon line that its own bar can't use;
- which planned pieces differ from what the character wears now.

Each fact carries a source (`FactSource`). In order of trust for "how the
game is": game, catalog, addon, player, reference.

## Who a character is

- **Race and alliance.** Each race has a home alliance; Imperials choose
  theirs. `allianceFit(race, alliance)` gives `home`, `chosen` (Imperial),
  or `any-race-any-alliance`: a Redguard in the Aldmeri Dominion means the
  account owns that bundle. Alliance is fixed at creation. Race decides
  the racial skill line (opens at level 5).
- **Class.** Three class lines per class, mapped from the catalog
  (`classLines()` in `src/lib/db/game-knowledge.ts`). `classLineup` reads a character's own lines, the ones
  subclassing swapped out, and borrowed ones with their source class, from
  the game's flags (`IsPlayerClassSkillLine`, `IsActive`). Subclassing
  rules (since Update 46): up to two lines replaced, at least one kept, one
  per other class. Class Mastery only while all three own lines are in.
- **Champion Points.** Craft (green), Warfare (blue), Fitness (red); 3600
  spendable, 1200 each, earned in turn; slottable stars work only on the
  bar, four slots per constellation.
- **Weapons.** A bar's weapons make one weapon line or none
  (`barWeaponLine`). A weapon line's abilities and passives work only while
  that bar holds its weapons (`lineUsableOnBar`). Some passives read the
  exact weapon types or the staff element (`readBar`).
- **Armor.** Each weight's line levels and scales with body pieces of that
  weight.

`readCharacter(character, classLines())` puts it all together: race fit,
class lineup, Class Mastery, sets per bar, each bar's weapon line and
element, armor per weight with its line, Champion Point slots, idle research.

The addon (0.9.42) records for each class line whether it is the
character's own and whether it is equipped, so swapped-out lines come from
the game.

## Styles, Mundus, food, companions

- **Motifs.** Per character. Every character knows its own race's motif.
  A motif is a whole book or fourteen chapters (Axes … Swords). Each
  chapter covers its piece in every weight, or its weapon in one and two
  hands. Jewelry has no style. Reading a motif also unlocks the outfit
  style account-wide, and `styleKey` links the two.
- **Mundus.** Thirteen stones, one blessing at a time, two with five
  pieces of Twice-Born Star. Divines armor strengthens it, more on
  higher quality. Update 51 (live 28 September 2026) changed two: the
  Warrior now gives Weapon and Spell Damage, and the Apprentice 8% more
  experience and inspiration instead of Spell Damage. The numbers come
  from the game, never from here: a character's own blessing text from its
  saved buffs, and every stone's from the catalog scan (`mundus` domain).
  A save's blessing text also fills the catalog row (`learn.ts`).
- **Food and drink.** One buff at a time. Food raises maximum Health,
  Magicka or Stamina, drinks raise their recovery, and specialities mix
  both. Standard recipes touch one stat, difficult two, complex three.
  The catalog scan records every dish and its buff as the game's tooltip
  states it (`food` domain). A character's active food shows as a lasting
  buff with its timer; which dish it came from isn't knowable (docs/notes.md).
- **Riding.** Three lessons (speed, stamina, capacity) up to the caps the
  game reports, and when the next lesson opens, counted from the save.
- **Companions.** Level 1–20, shared across the account. One bar with five
  abilities, and the ultimate at 20. Abilities cost no skill points and
  don't morph. Armor lines need five pieces of a weight. Rapport changes
  dialogue, not combat. Since addon 0.9.43 the account's companions come
  from the collection, and the one out at a save adds its level and
  rapport; the others keep what an earlier save saw (`readAccountCompanions`;
  a companion never seen out has no level yet).

Sources: UESP (Online:Crafting_Motifs, Online:Mundus_Stones,
Online:Divines, Online:Provisioning, Online:Recipes, Online:Rapport) and the
ZOS Companions System Guide.

## The catalog: one row per thing, the game's facts

Every catalog row has one id, from `game/catalog-ids.ts`: a kind prefix
and the name, lowercase, accents and apostrophes dropped ("Mother's Sorrow"
→ `set-mothers-sorrow`). Skill lines use `skillLineId` (Class Mastery's
carries its class); Champion stars are keyed by name alone, since a star's
name is unique and its constellation is a fact about it. Achievements and
dishes keep their own ids.

- **Import.** Every row, and every ability's line, is filed under its id,
  whatever id a scan or seed sent. The indexed columns come from the merged
  entry, so a scan that sends no class can't blank it.
- **Repair** (`catalog/heal.ts`, after every import and at every start):
  rows under any other id are folded into their one row (the higher-ranked
  source wins per field, the other fills gaps), a line's abilities move
  with it, and Class Mastery with no class is dropped. Champion stars get
  the constellation and type the characters' saves show; a star no save
  covers moves only when the scanned evidence agrees unanimously.
  Idempotent: a clean catalog is left as it is.
- **The game names things right** (Catalog 0.2.7, Snapshot 0.9.44): class
  lines carry their class, Champion stars are read by their constellation's
  position and asked whether they can be slotted, ultimates are marked.
- **The seed is the game's data.** `data/catalog/sets.json` and
  `champion-points.json` are copied from an in-game scan (set ids, zones,
  bonuses with numbers); hand-written facts were wrong.

What went wrong before (November 2026, found on the owner's own catalog):
ids built by the addon and by hand disagreed on apostrophes and wording, so
one thing was stored twice (Dawn's Wrath, Mother's Sorrow, Assassin's
Blade); the Champion scan filed every star under another constellation and
as passive; ultimates were stored as active; the seed's set ids were
invented. Tests in `catalog/skill-lines.test.ts` and
`catalog/catalog-heal.test.ts` fail if any of it comes back.

## The item index: where everything belongs

Every import brings the `game_items` table in line with the scan, keyed by
the game's item id:

- name, icon and piece kind;
- set id and set name;
- its place: an inventory tab and sub-tab (`category`, `subtype`), the
  game's item type ("Food") and finer kind, and who filed it;
- where the latest scan has it (bag, worn, collection), and first and last
  seen.

**Where it belongs.** `itemPlace` (item-category.ts) files each item: the
tab the game itself put it in (the addon asks the game's own inventory
filter), then, for gear the game didn't file, the tab its piece kind
belongs in. A name counts only through the model's parser of the game's
piece words; nothing else is guessed.

**What stays.** The index holds what the account holds now, plus every
piece of the set collection (which lists every piece of every set, owned
or not, so it describes the game). An item sold, deconstructed or
destroyed, or on a deleted character, leaves at the next import. A scan
with no items at all is ignored, so a broken file can't wipe it.

Queries: `getLearnedItem(itemId)` and `learnedItemsForSet(setId)` in
`src/lib/db/game-items.ts`.

## Deleted characters

The addon compares its characters with the game's own list at each save.
A character no longer on it is filed under `archivedCharacters`, and its
bags are dropped from the save. On import Nirnside leaves it out entirely:
no character row, no bags, no gold in the totals, and its roles and
character-only targets are removed. Photos of it stay; they are the
player's own files.

## Who uses the model

Every page and module reads game facts from here. Presentation stays
outside, keyed by the model's own values:

Game rules and game content live only in `src/lib/game/`. Modules outside
it present or store; they don't decide what the game is. Presentation of a
game fact (a link, a label, a color) stays outside, keyed by the model:
`collections/mythic-links.ts` links a mythic, and `db/vengeance-cleanup.ts`
applies the Vengeance rule to stored rows.

- `lib/classes.ts`: each class's crest and color, keyed by `CLASSES`;
- `lib/format.ts`: each alliance's color, keyed by `ALLIANCES`
  (`allianceAccent` reads any spelling);
- `lib/ui/game-colors.ts`: each constellation's color and the game's
  order (`constellationColor`, `constellationRank`);
- `lib/goals/types.ts`: target tiers' labels and colors (player plans,
  not game facts).

Builds (`lib/builds/slots.ts`, `traits.ts`), set briefs, the character
paper doll (`lib/characters/loadout.ts`), the sheet summary
(`lib/party/sheet.ts`) and the character page read slots, weights,
research lines and set counts through the model. Both character pages
(Party and Atlas) read the character through `readCharacter`, with the
catalog's Mundus text and the account's companions. Bag items are filed at
import (`fileItem`), so every inventory screen reads one place per item.

## Adding to the model

When a feature needs a game fact:

1. Look in `src/lib/game/` first.
2. If it's missing, add it there, with where it comes from (game constant,
   catalog scan or a documented source), and a test in `game.test.ts`.
3. Prefer having the addon report the fact from the game over writing it
   down by hand.
