# data/incoming

A drop-in folder for when Nirnside runs on a machine **without** ESO installed
(for example, this remote/cloud instance).

Put either file here — or use **Setup → Upload a .lua file** in the app — and
Nirnside imports it automatically and watches it:

- `NirnsideSnapshot.lua` — your account/character snapshot (ESO names the
  SavedVariables file after the addon, so it is `NirnsideSnapshot.lua`)
- `NirnsideCatalog.lua` — the optional in-game catalog scan (from the
  `NirnsideCatalog` addon, `/nirncatalog`)

Precedence: env vars (`NIRNSIDE_SV_FILE` / `NIRNSIDE_SV_DIR`) beat a path chosen
in Setup, which beats auto-detected ESO folders, which beat this folder.

**Privacy:** `*.lua` here is git-ignored on purpose — your real account data is
private and never gets committed.

### Where to find your files on your PC

```
Documents/Elder Scrolls Online/liveeu/SavedVariables/NirnsideSnapshot.lua   (EU)
Documents/Elder Scrolls Online/live/SavedVariables/NirnsideSnapshot.lua     (NA)
Documents/Elder Scrolls Online/live/SavedVariables/NirnsideCatalog.lua      (if you ran /nirncatalog)
```
