# Nirnside

**Your Elder Scrolls Online account, viewable outside the game — and entirely on your own machine.**

Nirnside is a local-first hub for ESO. It reads the data the game writes to disk
(via small in-game addons), stores it in a local SQLite database, and shows it in
a clean web UI. Nothing is uploaded anywhere. There are no accounts, no servers,
no telemetry.

It has two halves that share **one database**:

- **Your account** — characters (skills, morphs, gear incl. back bar, Champion
  Points, vampire/werewolf, companions, scribing, research), full inventory with
  filters, stickerbook, and a Pithka-style trial/dungeon/arena achievement board.
- **The catalog** — a live Tamriel encyclopedia: item sets, skill lines + morphs,
  the Champion Point tree (with a what-if planner), and the full scribing
  combination matrix.

Everything is cross-linked: a set on your character opens its encyclopedia page,
and every encyclopedia page shows whether you own/know it. A single global search
covers both halves.

### Accuracy & sources

In-game data is the source of truth. Every catalog entry carries a `source` and
the UI badges it: **In-game verified** > **Community** > **Reference**. The
bundled reference seed is mechanic-accurate but deliberately omits volatile
per-patch numbers until the in-game catalog scan fills them in — so nothing is
silently wrong. The importer merges in-game data over reference **field by
field**, so a scan upgrades entries without dropping detail.

> Scope and hard rules live in [`.cursor/rules/nirnside.mdc`](.cursor/rules/nirnside.mdc).
> The short version: **live patch only, in-game accuracy wins, local & private,
> never interrupt the game.**

---

## What's here

| Part | Path | What it does |
| --- | --- | --- |
| Web app | `src/app` | Next.js UI: Home, Characters, Inventory, Stickerbook, Achievements, Encyclopedia, Search |
| Account contract | `src/lib/snapshot/schema.ts` | The single shape of a snapshot (Zod-validated) |
| Catalog contract | `src/lib/catalog/schema.ts` | The shape of catalog entries + source precedence |
| Catalog seed | `data/catalog/*.json` | Mechanic-accurate U50 reference data (sets, skills, CP, scribing, achievements) |
| Lua parser | `src/lib/snapshot/lua-parser.ts` | Reads ESO `SavedVariables` Lua from disk |
| Local DB | `src/lib/db` | SQLite schema, importer, queries, and account↔catalog overlays |
| Importer / watcher | `scripts/` | One-shot import and a background auto-import watcher |
| Snapshot addon | `addon/NirnsideSnapshot` | Writes account/character data on login & ReloadUI |
| Catalog addon | `addon/NirnsideCatalog` | OPT-IN `/nirncatalog` scan of the live game catalog (AFK) |
| Sample data | `data/sample/Nirnside.lua` | A realistic snapshot so you can try it without the game |

## Quick start (try it with sample data)

```bash
npm install
npm run seed      # loads data/sample/Nirnside.lua into the local DB
npm run dev       # http://127.0.0.1:43219
```

## Using it with your real account (PC) — nothing to set up

Run Nirnside **on the same PC you play ESO on**. It sets *itself* up:

1. **Start it.** Double-click **`start-nirnside.cmd`** (Windows) or run
   **`./start-nirnside.sh`** (macOS/Linux). On first run it installs dependencies,
   starts the app, and opens your browser. (Node.js LTS from <https://nodejs.org>
   is the only prerequisite.)
2. On startup Nirnside **searches your drives** for your ESO install and **installs
   its own addon into every ESO AddOns folder it finds** — you don't copy anything.
3. In game, enable **Nirnside Snapshot** in the AddOns menu once, then log a
   character out or type `/reloadui`. The addon only ever runs at login / ReloadUI
   and **never during combat**; force a capture anytime with `/nirnside`.
4. Nirnside detects the file, imports it, and **watches it** — every logout or
   `/reloadui` refreshes the app on its own. No env vars, no manual import.

Prefer to do it by hand? You still can: `npm install && npm run dev`, and copy
`addon/NirnsideSnapshot` into `Documents/Elder Scrolls Online/live/AddOns/`
yourself. But you shouldn't need to.

On startup Nirnside scans broadly for your ESO folder — every Windows drive's
`Users\*`, plain `Documents`, any `OneDrive*` (personal or business) Documents,
localized Documents names, and every environment folder (`liveeu`, `live`, `pts`,
or any custom one with a `SavedVariables` subdir):

```
Documents/Elder Scrolls Online/live/SavedVariables/NirnsideData.lua
…plus OneDrive-redirected + other-drive variants on Windows.
```

When it finds the file it imports your account, then **watches it** — every logout
or `/reloadui` in ESO refreshes the app on its own. No env vars, no second
terminal. The Home page shows exactly which file it's reading from. If the addon
hasn't written a file yet, the app keeps looking and picks it up the moment it
appears.

### Optional: in-game-verified catalog

The encyclopedia ships with mechanic-accurate reference data out of the box. To
upgrade it to **in-game-verified** values (real Champion Point descriptions,
skill tooltips, set names/ids straight from your client):

1. Copy `addon/NirnsideCatalog` into your AddOns folder and enable it.
2. **While AFK** (not in combat), run `/nirncatalog`, then `/reloadui` to write it.

Nirnside finds `NirnsideCatalog.lua` next to your snapshot, imports it as
`ingame`, and merges it over the reference data field by field. This addon is
**opt-in only** — it never runs automatically and refuses to run in combat.

### Config (optional — only if your ESO install is somewhere unusual)

| Env var | Default | Meaning |
| --- | --- | --- |
| `NIRNSIDE_SV_FILE` | *(auto-detected)* | Force a specific SavedVariables file |
| `NIRNSIDE_SV_DIR` | *(auto-detected)* | Force the SavedVariables folder to look in |
| `NIRNSIDE_DB` | `data/nirnside.db` | Local SQLite database path |

You can still import/watch manually if you prefer (`npm run import -- <file>`,
`npm run watch -- <file>`), but you shouldn't need to.

## How "unknown" works

The game only knows the character you're currently on. Account-wide bags (bank,
subscriber bank, craft bag) are captured from any character's logout; a character's
own backpack, worn gear, skills and Champion Points are only known once **that**
character has been logged out with the addon installed. Until then Nirnside shows
that character as **not yet snapshotted** rather than faking empty data.

## What's intentionally not here

Combat math, food/buff timers ("currently buffed"), guild banks, house banks,
mail, PvP ranks, and quest logs are out of scope by design. See the rules file.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the app on port 43219 |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run seed` | Import the bundled sample snapshot |
| `npm run import -- <file>` | Import a specific SavedVariables file |
| `npm run watch -- <file>` | Watch a file and auto-import on change |
| `npm run lint` | Lint |

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · better-sqlite3 · Zod · chokidar.
Everything runs locally.
