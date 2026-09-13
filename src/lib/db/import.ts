import { getDb } from "./index";
import type { AccountSnapshot } from "../snapshot/schema";

/**
 * Replace the entire local DB with a fresh snapshot. Because Nirnside only ever
 * holds one account's data, a full replace inside a transaction is the simplest
 * correct strategy: no partial/stale rows can survive.
 */
export function importSnapshot(snap: AccountSnapshot): { items: number; characters: number; sets: number } {
  const db = getDb();

  const tx = db.transaction(() => {
    // Note: only clear account-scoped rows. The catalog table and its meta
    // (source/patch) are a separate, shared dataset and must survive re-imports.
    db.exec("DELETE FROM characters; DELETE FROM items; DELETE FROM stickerbook;");
    db.prepare("DELETE FROM meta WHERE key = 'account'").run();

    const setMeta = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
    setMeta.run(
      "account",
      JSON.stringify({
        displayName: snap.displayName,
        region: snap.region,
        apiVersion: snap.apiVersion,
        esoPlus: snap.esoPlus,
        lastSnapshot: snap.lastSnapshot,
        gold: snap.gold,
        currencies: snap.currencies,
        guilds: snap.guilds,
        achievements: snap.achievements,
      }),
    );

    const insChar = db.prepare(`
      INSERT INTO characters
        (id, name, class, race, alliance, level, championPoints,
         isVampire, vampireStage, isWerewolf, lastSeen, sortOrder, json)
      VALUES (@id, @name, @class, @race, @alliance, @level, @championPoints,
              @isVampire, @vampireStage, @isWerewolf, @lastSeen, @sortOrder, @json)
    `);
    snap.characters.forEach((c, i) => {
      insChar.run({
        id: c.id,
        name: c.name,
        class: c.class,
        race: c.race,
        alliance: c.alliance,
        level: c.level,
        championPoints: c.championPoints,
        isVampire: c.vampire.isVampire ? 1 : 0,
        vampireStage: c.vampire.stage,
        isWerewolf: c.werewolf.isWerewolf ? 1 : 0,
        lastSeen: c.lastSeen,
        sortOrder: i,
        json: JSON.stringify(c),
      });
    });

    const insItem = db.prepare(`
      INSERT INTO items
        (itemId, name, icon, quality, count, ownerCharacter, location,
         setName, setId, trait, level, equipSlot, obtainable, bound, stolen, json)
      VALUES (@itemId, @name, @icon, @quality, @count, @ownerCharacter, @location,
              @setName, @setId, @trait, @level, @equipSlot, @obtainable, @bound, @stolen, @json)
    `);
    for (const it of snap.items) {
      insItem.run({
        itemId: it.itemId,
        name: it.name,
        icon: it.icon ?? null,
        quality: it.quality ?? null,
        count: it.count,
        ownerCharacter: it.ownerCharacter,
        location: it.location,
        setName: it.setName,
        setId: it.setId,
        trait: it.trait,
        level: it.level,
        equipSlot: it.equipSlot,
        obtainable: it.obtainable ? 1 : 0,
        bound: it.bound ? 1 : 0,
        stolen: it.stolen ? 1 : 0,
        json: JSON.stringify(it),
      });
    }

    const insSet = db.prepare(`
      INSERT INTO stickerbook (setId, name, category, total, collected, json)
      VALUES (@setId, @name, @category, @total, @collected, @json)
    `);
    for (const s of snap.stickerbook) {
      const pieces = Object.values(s.pieces);
      insSet.run({
        setId: s.setId,
        name: s.name,
        category: s.category,
        total: pieces.length,
        collected: pieces.filter(Boolean).length,
        json: JSON.stringify(s),
      });
    }
  });

  tx();
  return {
    items: snap.items.length,
    characters: snap.characters.length,
    sets: snap.stickerbook.length,
  };
}
