# Nirnside's game model

Nirnside keeps one model of what things in ESO are and how they connect.
Pages and features read from it rather than keeping their own lists, so a
fact is written once and the same answer shows up everywhere.

The model lives in `src/lib/game/`:

| File | What it knows |
| --- | --- |
| `equipment.ts` | Piece kinds (armor weight × slot, jewelry, weapons, shields), the game's piece words, worn slots, which craft makes a piece, which research line covers it, which trait family it takes |
| `traits.ts` | The 27 researchable traits in research-grid order, plus Ornate and Intricate |
| `quality.ts` | Item qualities in the game's order, their theme colors |
| `skills.ts` | Skill line categories in the Skills window's order |
| `set-profile.ts` | What a set comes in: which weights for which slots, jewelry, weapons; its shape (full, monster head-and-shoulders, weapons-only, single-piece) |
| `loadout.ts` | How worn gear works together: set counts per bar, two-handers as two, active bonuses, body armor per weight |
| `research.ts` | Trait research per piece kind, whether a piece can be crafted for a set and trait, idle research slots |
| `character.ts` | Races, their home alliances, what a race–alliance pairing means (home, Imperial's choice, Any Race Any Alliance), racial lines |
| `classes.ts` | Classes and their three lines (from the catalog), a character's own / borrowed / swapped-out lines, subclassing rules, Class Mastery |
| `champion.ts` | The three constellations, the 3600 cap (1200 each), earning order, slottable vs passive stars, four slots per constellation |
| `weapon-lines.ts` | The six weapon lines and what each needs on the bar (two one-handers make Dual Wield, one plus a shield One Hand and Shield, a lone one-hander nothing), staff elements, per-weapon passives, armor lines |
| `addons.ts` | What an ESO addon is, how its saved data reaches Nirnside, the addons Nirnside works with, where each fact comes from and how fresh it is |
| `setups.ts` | A Wizard's Wardrobe setup read against the model: each bar's weapon line, skills a bar can't use, planned vs worn gear |
| `understand.ts` | `readCharacter`: one character read through every system at once |
| `item-index.ts` | What every scan teaches about items (below) |

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
- Body pieces are counted per weight, which armor passives scale with. A
  shield isn't body armor.

Where a rule is uncertain or changes between patches (how perfected and
normal pieces combine), the model doesn't encode it. Newer addon scans
record the game's own count (`GetItemLinkSetInfo(link, true)`: pieces worn,
and how many are perfected) as `setCount` / `setPerfectedCount`, and the
loadout keeps them as `gameCount`.

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

## Learning: the item index

Every import adds the scan's items to the `game_items` table, keyed by the
game's item id:

- name, icon and piece kind;
- set id and set name;
- where the item has been seen (bag, worn, collection);
- first and last seen.

The table is never cleared, so it keeps growing. Over time Nirnside knows
every item the account has shown the addon, even after the item is sold
or deconstructed. Known facts are kept, gaps fill in, and nothing is
guessed.

Queries: `getLearnedItem(itemId)` and `learnedItemsForSet(setId)` in
`src/lib/db/game-items.ts`.

## Adding to the model

When a feature needs a game fact:

1. Look in `src/lib/game/` first.
2. If it's missing, add it there, with where it comes from (game constant,
   catalog scan or a documented source), and a test in `game.test.ts`.
3. Prefer having the addon report the fact from the game over writing it
   down by hand.
