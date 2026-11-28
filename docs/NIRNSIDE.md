# Nirnside: how it works and how to work on it

This is the guide for anyone changing Nirnside, people and AI assistants
alike. Read it before any change. The hard product rules are in
`.cursor/rules/nirnside.mdc`; where this guide and those rules differ, the
rules win. The game model's detail is in `docs/game-model.md`.

---

## 1. What Nirnside is

Nirnside is an out-of-game companion for The Elder Scrolls Online. It shows
one player's own account: characters, gear, skills, research, collections,
inventory, dailies. Alongside that it has a library of the live game: sets,
skills, Champion Points and scribing. Under both sits a model of how the
game works, so every page reads the same answers.

- **Local first.** It runs on the player's own computer: a Next.js app over
  a SQLite database, started by the Windows launcher `Nirnside.exe`. No
  account data leaves the device.
- **Two looks, one app.** *Party* (the current design, under `/party`) and
  *Atlas* (the original). They share one database and one game model.
- **Later: a web version** with profiles, friends and sharing chosen
  modules. The owner approved the direction; details come first. See §9.

---

## 2. How data gets in

```
ESO client ──(public API)──▶ Nirnside addons ──(SavedVariables .lua)──▶ Nirnside app
                                   ▲                                        │
              Wizard's Wardrobe ───┘ (read in game, optional)               ▼
                                                              import → SQLite → game model → pages
```

1. **The addons** (`addon/`) run inside the game and read ESO's public API:
   - `NirnsideSnapshot` reads the account and characters at logout or
     `/reloadui`;
   - `NirnsideCatalog` reads the game's catalog, only when the player types
     `/nirncatalog`, AFK.
2. **SavedVariables.** An addon's only storage. ESO holds it in memory and
   writes it to disk at a reload, a zone change with a loading screen, a
   logout or a quit. A crash or Alt+F4 can skip that. Everything Nirnside
   knows is therefore **"as of the last save"**.
3. **Import** (`src/lib/db/import.ts`). The app finds the file
   (`src/lib/snapshot/locate.ts`; the search rules are locked, see the rules
   file), parses the Lua (`lua-parser.ts`), validates it
   (`snapshot/schema.ts`, Zod) and writes SQLite.
4. **The game model** (`src/lib/game/`) turns rows into meaning: what an item
   is, what a set comes in, what a character can craft, what a bar's weapons
   allow.
5. **Pages** (`src/app`, `src/components`) ask the model and the database.
   They never re-derive game rules themselves.

Other addons: Nirnside Snapshot declares `## OptionalDependsOn:
WizardsWardrobe`, so it loads after Wizard's Wardrobe and copies the
setups the player has open. Those are **another addon's record of the
player's plans**, not the game's state (see §4).

---

## 3. Where things are stored

SQLite, one file per install (`data/nirnside.db`; `NIRNSIDE_DB` overrides
it). Tables fall into three groups:

| Group | Tables | On import |
| --- | --- | --- |
| **The account** (replaced by each scan) | `characters`, `items`, `stickerbook`, `achievements`, `meta['account']` | Deleted and rewritten in one transaction, so no stale rows survive |
| **What Nirnside has learned** | `catalog` (game catalog), `completed_achievements`, `character_completed_achievements` | Merged: better sources win, gaps fill in, nothing is forgotten |
| **The item index** | `game_items` | Brought in line with the scan: what the account holds plus the set collection's pieces, each filed in its place |
| **What the player set** | `goals`, `roles`, `character_roles`, `gear_builds`, `gallery_photos`, `profile_media`, `meta` keys (`party-profile`, `daily-tracking`, …) | Never touched by an import |

Schema changes go in `src/lib/db/index.ts` (`migrate`). Write them as
idempotent `CREATE … IF NOT EXISTS`, plus a guarded column or table
migration, so an old database upgrades in place.

---

## 4. The principles

These come from the owner and apply to every change.

1. **The game is the truth.** Ranked by trust for "how the game is":
   - `game`: our addon read it from the API;
   - `catalog`: the in-game catalog scan;
   - `addon`: another addon's data;
   - `player`: typed in Nirnside;
   - `reference`: documentation or shipped seed data.

   Keep each fact's source (`FactSource` in `src/lib/game/addons.ts`) and
   show unverified facts as such.
2. **One source for every fact. No duplicates.** A game fact (a slot list,
   a trait list, a skill category order, a rule) lives once, in
   `src/lib/game/`. Before writing a list of game things anywhere else,
   look there. If it's missing, add it there and import it. Found a copy?
   Move it onto the model in the same change.
3. **Learn from the game; don't guess.** Prefer having the addon report a
   fact (a constant, a flag, the game's own count) over working it out.
   When a rule is uncertain or patch-dependent (how perfected and normal
   set pieces combine, exact Mundus values), don't encode it. Record what
   the game says instead.
4. **Verify before encoding.** A rule the API doesn't spell out needs a
   source:
   - official ZOS patch notes, or an API dump (UESP esodata, the ESOUI
     API txt);
   - then UESP;
   - then well-known community guides.

   Cite it in the module's header comment. A test-server change isn't live
   until live patch notes say so.
5. **Link by the game's IDs.** Item id, set id, ability id, collectible id.
   Names are for display; when only a name exists, go through the model's
   parsers (`parsePieceType`, `canonicalTrait`, `styleKey`, …).
6. **Every fact is "as of the last save".** Count timers down from the save
   (`countDown`). Treat dailies as unknown once a reset has passed. Show
   when data was saved.
7. **Plans aren't state.** Wizard's Wardrobe setups, targets and builds are
   intentions. Compare them with the game's state (`readSetup`); never
   show them as what the character is wearing.
8. **Never harm play.** Addon work happens only at logout, reload or on
   request, never in combat. Guard every API call (`safe`, `pcall`) so a
   missing function or constant on some client just leaves a field out.

---

## 5. The game model (`src/lib/game/`)

The full map, with sources, is in `docs/game-model.md`. In short:

| Area | Module | Answers |
| --- | --- | --- |
| Equipment | `equipment.ts` | What a piece is (weight, slot, weapon), its craft, research line, trait family; worn slots |
| Traits, quality | `traits.ts`, `quality.ts` | The 27 traits in research order; qualities and their colors |
| Sets | `set-profile.ts` | What a set comes in (weights per slot, jewelry, weapons, shape) |
| Worn gear | `loadout.ts` | Set counts per bar, two-handers as two, armor per weight |
| Research | `research.ts` | Traits per piece, can a character craft it, idle slots |
| Motifs | `motifs.ts` | Chapters and pieces, styles a character can craft, motif and outfit link |
| Characters | `character.ts` | Races, alliances, Any Race Any Alliance, racial lines |
| Classes | `classes.ts` | Class lines, own, borrowed and swapped-out lines, subclassing rules, Class Mastery |
| Champion Points | `champion.ts` | Constellations, cap, slots, unslotted slottables |
| Weapons and armor lines | `weapon-lines.ts` | What each bar's weapons make, which abilities work there |
| Mundus, food, companions | `mundus.ts`, `food.ts`, `companions.ts` | Blessings with the game's own text, buffs, companion rules |
| Buffs, riding, stats | `buffs.ts`, `riding.ts`, `stats.ts` | Lasting buffs and riding lessons, counted down from the save; the character sheet and every value, worded as the game shows it |
| Where items belong | `item-category.ts` | The game's inventory tabs; `itemPlace` files every item |
| Skills | `skills.ts`, `skill-caps.ts`, `class-mastery.ts`, `vengeance.ts` | Categories and order, rank caps, Class Mastery, lines left out |
| Dailies | `daily-reset.ts`, `pledges.ts`, `pledge-objectives.ts`, `world-bosses.ts`, `zone-dailies.ts`, `writs.ts`, `riding.ts` | The reset clock, pledges, world bosses, zone dailies, crafting writs, riding lessons |
| Account | `currencies.ts`, `pithka.ts`, `mythics.ts`, `outfits.ts`, `transmute.ts` | Wallet, content achievements, mythics, outfit styles, crystal costs |
| Addons | `addons.ts`, `setups.ts` | What addons are, sources and freshness, Wizard's Wardrobe setups |
| Everything at once | `understand.ts` | `readCharacter(c, classLines(), abilityLines())` |
| The item index | `item-index.ts`, `db/game-items.ts` | Every item the account holds, by item id, in its place; set profiles |
| Catalog lookups | `db/game-knowledge.ts` | Class → lines; ability → line |

Modules in `src/lib/game/` are pure. They take data and return answers,
with no database access, so they can be tested and later run anywhere,
including a server. Database access lives in `src/lib/db/`.

---

## 6. How to add or change game knowledge

1. **Look first.** Search `src/lib/game/` and `docs/game-model.md`.
2. **Find the source.** Prefer the game: can the addon read it? If not,
   find documentation (see principle 4). Note it.
3. **Write it in the model**, as data plus small pure functions. Put the
   source and anything uncertain in the header comment.
4. **Test it.** Add cases to the matching `*.test.ts` and register new test
   files in `package.json`'s `test` script.
5. **Connect it.** If it describes a character, add it to `readCharacter`
   with its `provenance`. If a page had its own copy, replace the copy.
6. **Document it** in `docs/game-model.md`: what's known, where it comes
   from, what isn't encoded and why.

### When the addon must report something new

- Add the field in Lua with every call guarded. Check that the constants
  exist before comparing.
- Add it to `snapshot/schema.ts` as **optional**, with a comment saying
  which addon version writes it. Old saves must still parse.
- Bump `## Version` and `## AddOnVersion` in the addon's `.txt`.
- Never add work that runs during play, and never touch guild or house
  banks (rules file §3).

---

## 7. The interface (Party look)

- Fonts: Marcellus for display, Sora for body. Tokens are on `html.party`
  in `src/app/party.css`.
- **Color means something:**
  - the accent is soft violet;
  - meters are neutral grey;
  - gold only for gold amounts and legendary items;
  - target tiers: violet mandatory, blue extra, slate completionist;
  - Champion Points: green Craft, blue Warfare, red Fitness;
  - item quality uses the game's colors.
- Follow Atlas's structure for what goes where: account-wide vs
  per-character. Give it character, not just modernization.
- **Easy to read:** little scrolling, one click to what you need, no walls
  of repeated text. Prefer grids and visual tiles.
- Atlas links are mapped to Party pages by the shell (`toPartyHref`).

---

## 8. Building, testing and shipping

- **Before every commit:**
  - `npx tsc --noEmit` (the Windows build type-checks everything, including
    tests);
  - `npm test`;
  - lint the files you touched (`npx eslint <files>`).
- **Check visual changes in the browser.** Run `next build`, then `next
  start` with `NIRNSIDE_DB` pointing at a copy of a test database.
  Screenshots help.
- **Branches and pull requests:**
  - work on a branch, never on `main`;
  - check the commit holds every file you meant to include (`git show --stat`);
  - build a clean checkout before pushing (a `git worktree` with
    `node_modules` hard-linked);
  - open a pull request; the Check workflow runs typegen, tsc and tests.
- **Release.** Merging to `main` runs *Pack download*. It builds the
  ready-to-run Windows bundle (`scripts/make-bundle.mjs`), tests it, and
  publishes it with a manifest at the `latest` release. The launcher
  verifies and installs it, and players get it on restart. Player data
  lives in `data/` outside the bundle and is never shipped.

---

## 9. Toward a web version

Nothing here is built yet. The owner approved the direction in November
2026, and the rules file (§3) now records it: private accounts, sharing
chosen modules, and each player's catalog built from their own scans.
Still to agree before building: how shared data is protected, sign-in and
hosting (docs/notes.md).

**What would go where.** The layout already separates these:

| Kind | Today | On the web |
| --- | --- | --- |
| **Game rules** (`src/lib/game/`) | Code | The same code, run on the server and in the browser. Rules stay code, not database rows |
| **Game knowledge** (`catalog`) | Per-install SQLite | Per player, from their own scans and saves. Not pooled between players (owner, November 2026) |
| **Item index** (`game_items`) | Per-install SQLite | Per player: what their account holds, in its place |
| **Account data** (`characters`, `items`, `stickerbook`, …) | Per-install SQLite | Private per user, visible only to them and whoever they share chosen modules with (profile visibility is already stored per module) |
| **Player settings** (`goals`, roles, profile) | Per-install SQLite | Private per user |

The tables are keyed by the game's ids and stored as plain JSON columns,
so moving them to a server database (for example Postgres) is mostly
mechanical. Keep it that way: no logic in SQL that the model should own.

---

## 10. Quick reference

| Need | Look in |
| --- | --- |
| Product rules (hard) | `.cursor/rules/nirnside.mdc` |
| Finding SavedVariables | `.cursor/rules/eso-paths.mdc`, `src/lib/snapshot/locate.ts` |
| Game model | `src/lib/game/`, `docs/game-model.md` |
| Notes for later, open questions | `docs/notes.md` |
| Snapshot shape | `src/lib/snapshot/schema.ts` |
| Database | `src/lib/db/index.ts` (schema), `import.ts`, `queries.ts`, `game-items.ts`, `game-knowledge.ts` |
| Party pages | `src/app/(party)/party/`, `src/components/party/` |
| Addons | `addon/NirnsideSnapshot/`, `addon/NirnsideCatalog/` |
| Launcher | `installer/` (Go) |
| Release | `.github/workflows/pack-zip.yml`, `scripts/make-bundle.mjs` |
