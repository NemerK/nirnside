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
| Web app | `src/app` | Next.js UI: Home, Characters, Inventory, Stickerbook, Achievements, Encyclopedia, Search, Setup |
| Account contract | `src/lib/snapshot/schema.ts` | The single shape of a snapshot (Zod-validated) |
| Catalog contract | `src/lib/catalog/schema.ts` | The shape of catalog entries + source precedence |
| Catalog seed | `data/catalog/*.json` | Mechanic-accurate U50 reference data (sets, skills, CP, scribing, achievements) |
| Lua parser | `src/lib/snapshot/lua-parser.ts` | Reads ESO `SavedVariables` Lua from disk |
| Local DB | `src/lib/db` | SQLite schema, importer, queries, and account↔catalog overlays |
| Importer / watcher | `scripts/` | One-shot import and a background auto-import watcher |
| Snapshot addon | `addon/NirnsideSnapshot` | Writes account/character data on logout, ReloadUI, or a manual command/keybind |
| Catalog addon | `addon/NirnsideCatalog` | OPT-IN `/nirncatalog` scan of the live game catalog (AFK) |
| Sample data | `data/sample/Nirnside.lua` | A realistic snapshot so you can try it without the game |

## Download & install

The project is public: **https://github.com/NemerK/nirnside**

### For you, or anyone else (Windows)

1. Install **Node.js LTS** from <https://nodejs.org> (green button). One time.
2. Download the zip: <https://github.com/NemerK/nirnside/archive/refs/heads/main.zip>
   (or GitHub → **Code → Download ZIP**). Unzip it anywhere.
3. Open **START-HERE.txt** if you want the short version, or just double-click
   **`start-nirnside.cmd`**.
4. The browser opens at **http://127.0.0.1:43219**. Use **Setup** if it does not
   find `Documents\Elder Scrolls Online` by itself. Enable **Nirnside Snapshot**
   in the game AddOns menu, then log out.

macOS / Linux: same zip (or `git clone`), then `chmod +x start-nirnside.sh && ./start-nirnside.sh`.

That is the whole install. No Nirnside account, no extra server, nothing uploaded.

### Updates (you and everyone who downloaded it)

Every start via `start-nirnside.cmd` / `.sh`:

- **Git clone** — `git pull` on the branch you checked out (app + `addon/`).
- **ZIP download** — fetches the latest `main` from GitHub and overlays it
  (app + `addon/`). It will not replace a newer copy with an older `main`.

Your `data/` folder (the SQLite account database, and any `.lua` you dropped in
`data/incoming`) is **never overwritten**. Every start also copies
`NirnsideSnapshot` and `NirnsideCatalog` into each ESO `AddOns` folder it finds
(only those two folders). `/reloadui` in game so the new Lua actually loads.

To skip an update: `NIRNSIDE_SKIP_UPDATE=1` then start as usual.

If you use git: `git clone https://github.com/NemerK/nirnside.git` and the start
script still updates for you.

After GitHub **Releases** has a **Nirnside** zip (published on each push to
`main`), you can also grab that from the Releases page — same start script,
same updater.

To try the UI without ESO: Home → **Explore a demo account**. That sample is
labelled as sample data, never as your account.

## Using it with your real account (PC)

Run Nirnside **on the same PC you play ESO on**.

ESO does not store your account in the Steam/game folder. It writes files under
**Documents**. The path looks like:

```
Documents\Elder Scrolls Online\liveeu\SavedVariables\NirnsideSnapshot.lua
```

(`liveeu` = EU megaserver, `live` = NA. OneDrive-redirected Documents is fine.)

### What Nirnside does by itself

On startup it searches the usual Documents locations (every Windows drive’s
`Users\*`, OneDrive, localized Documents names, `liveeu` / `live` / `pts`) and:

1. **Installs its own addons** into every ESO `AddOns` folder it finds
   (`NirnsideSnapshot` + `NirnsideCatalog`). It never touches other addons.
2. **Watches** for `NirnsideSnapshot.lua`. When the game writes it, the app
   imports it and live-refreshes. Home shows the exact file being read.

### If it doesn’t find ESO — Setup page

Open **Setup** in the sidebar (or Home → Open Setup). You can:

- Click a folder it already found
- Paste a path
- **Browse** your disks and hit **Use** on `Elder Scrolls Online` or `liveeu`
- Upload a `.lua` SavedVariables file (for a machine that doesn’t have ESO)

Nirnside remembers that choice.

### In game (once)

1. At character select, open **AddOns** and enable **Nirnside Snapshot**.
2. Log a character in, then log out — or type `/reloadui`.
   The addon runs **only** on logout, ReloadUI, or a manual `/nirnside` / keybind —
   never on zone or instance changes, never during combat. Bind **Save Nirnside
   snapshot** under Controls → Keybindings.
3. Repeat logout on each character you want in Nirnside. Account-wide bags
   (bank, craft bag) come from any character; a character’s own bag/skills/CP
   only appear after *that* character has been snapshotted.

### Optional: in-game-verified catalog

The encyclopedia ships with mechanic-accurate reference data. To upgrade it to
**in-game-verified** values (tooltips and ids straight from your client):

1. Enable **Nirnside Catalog** in the AddOns menu (already installed by Setup).
2. **While AFK** (not in combat), run `/nirncatalog`, then `/reloadui`.

Nirnside finds `NirnsideCatalog.lua` next to your snapshot, imports it as
`ingame`, and merges it over the reference data field by field. This addon
**never runs automatically** and refuses to run in combat.

### Power-user overrides

You should not need these. Setup covers unusual folders.

| Env var | Default | Meaning |
| --- | --- | --- |
| `NIRNSIDE_SV_FILE` | *(auto-detected / Setup)* | Force a specific SavedVariables file |
| `NIRNSIDE_SV_DIR` | *(auto-detected / Setup)* | Force the SavedVariables folder |
| `NIRNSIDE_ESO_DIR` | *(auto-detected / Setup)* | Force the `Elder Scrolls Online` folder |
| `NIRNSIDE_DB` | `data/nirnside.db` | Local SQLite database path |

You can still import/watch manually (`npm run import -- <file>`,
`npm run watch -- <file>`).

## Quick start (developers)

```bash
npm install
npm run seed      # loads data/sample/Nirnside.lua into the local DB
npm run dev       # http://127.0.0.1:43219
```

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
