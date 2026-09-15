# data/incoming

A drop-in folder for when Nirnside runs on a machine **without** ESO installed
(for example, this remote/cloud instance).

Put either file here and the app imports it automatically and watches it:

- `NirnsideSnapshot.lua` — your account/character snapshot (ESO names the
  SavedVariables file after the addon, so it is `NirnsideSnapshot.lua`)
- `NirnsideCatalog.lua` — the optional in-game catalog scan (from the
  `NirnsideCatalog` addon, `/nirncatalog`)

These take priority over the OS auto-detection but sit below the
`NIRNSIDE_SV_FILE` / `NIRNSIDE_SV_DIR` env overrides.

**Privacy:** `*.lua` here is git-ignored on purpose — your real account data is
private and never gets committed.

### Where to find your files on your PC

```
Documents/Elder Scrolls Online/live/SavedVariables/NirnsideSnapshot.lua   (your account snapshot)
Documents/Elder Scrolls Online/live/SavedVariables/NirnsideCatalog.lua    (if you ran /nirncatalog)
```
