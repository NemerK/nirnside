import { getDb, getMeta } from "./index";
import type { AccountSnapshot } from "../snapshot/schema";
import { accountAlliancePoints, accountGold, accountTelVar, withoutDeletedCharacters } from "../snapshot/roster";
import { canonicalizeCurrencies } from "../game/currencies";
import { collectedPieceKeys } from "../stickerbook/seen";
import { seedStickerbookSeenIfNeeded } from "../stickerbook/seen-store";
import {
  collectCompletedAchievementIdsFromSnapshot,
  unionCompletedAchievementIds,
} from "../game/pithka";
import { stripVengeanceFromCharacter } from "../game/vengeance";
import { fileItem, itemsFromSnapshot } from "../game/item-index";
import { syncItems } from "./game-items";
import { importCatalogBundle } from "../catalog/import";
import { blessingsFromCharacters } from "../game/learn";

/**
 * Replace the entire local DB with a fresh snapshot. Because Nirnside only ever
 * holds one account's data, a full replace inside a transaction is the simplest
 * correct strategy: no partial/stale rows can survive.
 *
 * Exception: completed achievement ids never shrink. Maelstrom Arena clears are
 * still character-bound in live ESO — if any toon has earned one, it stays
 * checked for the whole account.
 */
export function importSnapshot(
  scanned: AccountSnapshot,
): { items: number; characters: number; sets: number; deleted: number } {
  // A character deleted in game leaves Nirnside with its bags and its settings.
  const { snap, deleted } = withoutDeletedCharacters(scanned);
  const db = getDb();
  const persisted = (db.prepare("SELECT id FROM completed_achievements").all() as { id: number }[]).map(
    (r) => r.id,
  );
  let fromCharsTable: number[] = [];
  try {
    fromCharsTable = (
      db.prepare("SELECT DISTINCT id FROM character_completed_achievements").all() as { id: number }[]
    ).map((r) => r.id);
  } catch {
    fromCharsTable = [];
  }
  const previouslyCompletedRecords = (
    db.prepare("SELECT id FROM achievements WHERE completed = 1").all() as { id: number }[]
  ).map((r) => r.id);
  const previousMeta = getMeta<{ completedAchievementIds?: number[] }>("account")?.completedAchievementIds;
  const fromSnap = collectCompletedAchievementIdsFromSnapshot(snap);
  const completedAchievementIds = unionCompletedAchievementIds(
    unionCompletedAchievementIds(unionCompletedAchievementIds(persisted, fromCharsTable), previouslyCompletedRecords),
    unionCompletedAchievementIds(previousMeta, fromSnap),
  );
  const completedSet = new Set(completedAchievementIds);

  const tx = db.transaction(() => {
    const insCharDone = db.prepare(
      "INSERT OR IGNORE INTO character_completed_achievements (characterId, id) VALUES (?, ?)",
    );
    for (const [characterId, ids] of Object.entries(snap.characterCompletedIds ?? {})) {
      for (const id of ids) insCharDone.run(characterId, id);
    }

    // Note: only clear account-scoped rows. The catalog table and its meta
    // (source/patch) are a separate, shared dataset and must survive re-imports.
    // completed_achievements and character_completed_achievements are never deleted.
    db.exec("DELETE FROM characters; DELETE FROM items; DELETE FROM stickerbook; DELETE FROM achievements;");
    db.prepare("DELETE FROM meta WHERE key = 'account'").run();

    const rosterForGold = snap.characters;
    forgetCharacters(deleted.map((c) => c.id));
    const setMeta = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
    setMeta.run(
      "account",
      JSON.stringify({
        displayName: snap.displayName,
        region: snap.region,
        apiVersion: snap.apiVersion,
        esoPlus: snap.esoPlus,
        lastSnapshot: snap.lastSnapshot,
        gold: accountGold({
          characters: rosterForGold,
          bankGold: snap.currencies.bankGold,
          legacyGold: snap.gold,
        }),
        currencies: {
          ...canonicalizeCurrencies(snap.currencies),
          telVar: accountTelVar({
            characters: rosterForGold,
            legacyTelVar: snap.currencies.telVar,
          }),
          alliancePoints: accountAlliancePoints({
            characters: rosterForGold,
            legacyAlliancePoints: snap.currencies.alliancePoints,
          }),
        },
        guilds: snap.guilds,
        achievements: snap.achievements,
        completedAchievementIds,
        houses: snap.houses ?? [],
        outfitStyles: snap.outfitStyles ?? [],
        mythics: snap.mythics ?? [],
        companions: snap.companions ?? [],
        bankSpace: snap.bankSpace ?? null,
        rules: snap.rules ?? null,
      }),
    );

    const insDone = db.prepare("INSERT OR IGNORE INTO completed_achievements (id) VALUES (?)");
    for (const id of completedAchievementIds) insDone.run(id);

    const insChar = db.prepare(`
      INSERT INTO characters
        (id, name, class, race, alliance, level, championPoints,
         isVampire, vampireStage, isWerewolf, lastSeen, sortOrder, json,
         archivedAt, gold, telVar, alliancePoints, classMastery, gender, mundus, lines)
      VALUES (@id, @name, @class, @race, @alliance, @level, @championPoints,
              @isVampire, @vampireStage, @isWerewolf, @lastSeen, @sortOrder, @json,
              @archivedAt, @gold, @telVar, @alliancePoints, @classMastery, @gender, @mundus, @lines)
    `);
    const allChars = snap.characters.map((c) => stripVengeanceFromCharacter({ ...c, archivedAt: null }));
    allChars.forEach((c, i) => {
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
        archivedAt: c.archivedAt ?? null,
        gold: c.gold ?? 0,
        telVar: c.telVar ?? 0,
        alliancePoints: c.alliancePoints ?? 0,
        classMastery: c.classMastery ? 1 : 0,
        gender: c.gender ?? null,
        mundus: c.mundus ?? null,
        // Roster rows need line names and ranks only, never the abilities.
        lines: JSON.stringify(
          c.skillLines.map((l) => ({ name: l.name, category: l.category ?? "", rank: l.rank ?? 0, subclassed: l.subclassed ? 1 : 0 })),
        ),
      });
    });

    const insItem = db.prepare(`
      INSERT INTO items
        (itemId, name, icon, quality, count, ownerCharacter, location,
         setName, setId, trait, level, equipSlot, obtainable, bound, stolen, json)
      VALUES (@itemId, @name, @icon, @quality, @count, @ownerCharacter, @location,
              @setName, @setId, @trait, @level, @equipSlot, @obtainable, @bound, @stolen, @json)
    `);
    // Every item filed in its place (game/item-index.ts fileItem).
    for (const it of snap.items.map(fileItem)) {
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
      insSet.run({
        setId: s.setId,
        name: s.name,
        category: s.category,
        total: s.pieces.length,
        collected: s.pieces.filter((p) => p.collected).length,
        json: JSON.stringify(s),
      });
    }

    const insAch = db.prepare(`
      INSERT OR REPLACE INTO achievements
        (id, name, description, points, completed, category, content, title, json)
      VALUES (@id, @name, @description, @points, @completed, @category, @content, @title, @json)
    `);
    // Deduplicate by id (the game can surface the same achievement via multiple
    // category paths); last write wins, which is fine since they're identical.
    // If this account has ever completed the id, keep it completed even when the
    // current toon's journal reports false (Maelstrom Arena).
    for (const a of snap.achievementRecords) {
      const completed = a.completed || completedSet.has(a.id);
      insAch.run({
        id: a.id,
        name: a.name,
        description: a.description,
        points: a.points,
        completed: completed ? 1 : 0,
        category: a.category,
        content: a.content,
        title: a.title,
        json: JSON.stringify({ ...a, completed }),
      });
    }

    seedStickerbookSeenIfNeeded(snap.displayName, collectedPieceKeys(snap.stickerbook));
  });

  tx();
  // Bring the item index in line with what the account holds now.
  try {
    syncItems(itemsFromSnapshot(snap), snap.lastSnapshot || undefined);
  } catch (err) {
    console.warn("[nirnside] could not update the item index:", err);
  }
  // Each character's blessing text, as the game wrote it, upgrades the catalog's Mundus rows.
  try {
    const mundus = blessingsFromCharacters(snap.characters, snap.apiVersion ? `API${snap.apiVersion}` : "live");
    if (mundus.length) importCatalogBundle({ source: "ingame", patch: `API${snap.apiVersion}`, mundus }, { touchMeta: false });
  } catch (err) {
    console.warn("[nirnside] could not learn Mundus text:", err);
  }
  return {
    items: snap.items.length,
    characters: snap.characters.length,
    sets: snap.stickerbook.length,
    deleted: deleted.length,
  };
}

/**
 * Settings that only meant something for one character: its roles and its
 * own targets. Photos stay; they are the player's files, not settings.
 */
function forgetCharacters(ids: string[]) {
  if (ids.length === 0) return;
  const db = getDb();
  const roles = db.prepare("DELETE FROM character_roles WHERE characterId = ?");
  const goals = db.prepare("DELETE FROM goals WHERE scope = 'character' AND characterId = ?");
  for (const id of ids) {
    roles.run(id);
    goals.run(id);
  }
}
