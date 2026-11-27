# Notes for later

Things the owner wants done later, and open questions found along the way.
Newest first within each section. When one is picked up, move it into the
work and delete it here.

## From the owner

- **The catalog is the player's own.** Mundus, food and every other number
  must be captured in the catalog and kept up to date, from this player's
  own scans and saves, not from other players. To be worked out: how the
  catalog stays current without the player remembering `/nirncatalog`
  (prompt after a patch? read more of it at logout, where that is cheap?).
- **Nirnhoned on armor vs weapons.** The same trait name does different
  things on armor and on weapons. The model should know both.
- **Stat values.** Base, critical chance, critical damage, and so on. We
  might incorporate these. That would be combat math, which the rules leave
  out today, so it needs its own decision first.
- **Web version and privacy.** The rules now record the direction: private
  accounts, sharing chosen modules, no pooled catalog. Still to decide:
  how shared data is protected (the old rule asked for end-to-end
  encryption), accounts and sign-in, hosting.

## Open questions

- **Which buff is food.** The game names a food buff by its effect
  ("Increase Max Health & Magicka"), not by the dish, so Nirnside can show
  that a character is fed and for how long, but not with what. Matching the
  buff's ability id to the dish would need the dish's ability id, which the
  item API doesn't give.
- **Addon API version.** The addons still declare `## APIVersion: 101046`.
  Update 51's number wasn't confirmed; the addon records the live version
  in every save (`apiVersion`), so read it from a real save and update both
  manifests.
- **Companion level and rapport** are only readable while that companion is
  out. Companions never summoned since addon 0.9.43 show no level yet.
- **Update 52** (19 January 2027) is on the PTS: subclassing talk there
  (two lines down to one) stays out of the model until live notes confirm.
