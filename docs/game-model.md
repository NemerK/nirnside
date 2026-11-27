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
