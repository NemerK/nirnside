# Nirnside

**Your Elder Scrolls Online account, viewable outside the game — and entirely on your own machine.**

Nirnside is a local-first hub for ESO. It reads the data the game writes to disk
(via a small in-game addon), stores it in a local SQLite database, and shows it
in a clean web UI: characters, inventory, stickerbook, and a live Tamriel
encyclopedia. Nothing is uploaded anywhere. There are no accounts, no servers, no
telemetry.

> Scope and hard rules live in [`.cursor/rules/nirnside.mdc`](.cursor/rules/nirnside.mdc).
> The short version: **live patch only, in-game accuracy wins, local & private,
> never interrupt the game.**

---

## What's here

| Part | Path | What it does |
| --- | --- | --- |
| Web app | `src/app` | Next.js UI: Home, Characters, Inventory, Stickerbook, Encyclopedia |
| Data contract | `src/lib/snapshot/schema.ts` | The single shape of a snapshot (Zod-validated) |
| Lua parser | `src/lib/snapshot/lua-parser.ts` | Reads ESO `SavedVariables` Lua from disk |
| Local DB | `src/lib/db` | SQLite schema, importer, and queries |
| Importer / watcher | `scripts/` | One-shot import and a background auto-import watcher |
| In-game addon | `addon/NirnsideSnapshot` | Writes account/character data on login & ReloadUI |
| Sample data | `data/sample/Nirnside.lua` | A realistic snapshot so you can try it without the game |

## Quick start (try it with sample data)

```bash
npm install
npm run seed      # loads data/sample/Nirnside.lua into the local DB
npm run dev       # http://127.0.0.1:43117
```

## Using it with your real account (PC)

1. **Install the addon.** Copy `addon/NirnsideSnapshot` into your ESO AddOns folder:
   `Documents/Elder Scrolls Online/live/AddOns/` (the folder that holds your other addons).
2. **Enable it** in the in-game AddOns menu, then **log in each character once** and
   log out or type `/reloadui`. You can also force a capture with `/nirnside`.
   The addon only ever runs at login / ReloadUI and **never during combat**.
3. **Point Nirnside at the file** the game wrote. On EU:
   `Documents/Elder Scrolls Online/liveeu/SavedVariables/NirnsideSnapshot.lua`
   (on NA it's `live/…`).
4. **Auto-import in the background** so the app stays current:

   ```bash
   NIRNSIDE_SV_FILE="/path/to/SavedVariables/NirnsideSnapshot.lua" npm run watch
   ```

   Or import once:

   ```bash
   npm run import -- "/path/to/SavedVariables/NirnsideSnapshot.lua"
   ```

5. `npm run dev` and open the app. Leave `npm run watch` running and every logout /
   ReloadUI refreshes the app automatically.

### Config

| Env var | Default | Meaning |
| --- | --- | --- |
| `NIRNSIDE_SV_FILE` | `data/sample/Nirnside.lua` | SavedVariables file to import / watch |
| `NIRNSIDE_DB` | `data/nirnside.db` | Local SQLite database path |

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
| `npm run dev` | Start the app on port 43117 |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run seed` | Import the bundled sample snapshot |
| `npm run import -- <file>` | Import a specific SavedVariables file |
| `npm run watch -- <file>` | Watch a file and auto-import on change |
| `npm run lint` | Lint |

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · better-sqlite3 · Zod · chokidar.
Everything runs locally.
