--[[
  Nirnside Snapshot
  =================
  Writes your account + current character data to SavedVariables so the local
  Nirnside app can read it. Design rules (see .cursor/rules/nirnside.mdc):

    * NEVER run during combat.
    * Only snapshot on login / ReloadUI (the `initial` PLAYER_ACTIVATED), plus a
      manual /nirnside command. No timers, no per-item bag events during play.
    * NEVER throw a Lua error: every gather step is wrapped in pcall, so a bad
      API call degrades to empty data instead of erroring in your game.
    * Reads only. Never touches the game state. Never uploads anything — it just
      writes a file the Nirnside app reads from your own disk.

  The written shape matches the AccountSnapshot contract in the app
  (src/lib/snapshot/schema.ts). Data lands under:
    NirnsideData.Default["@you"]["$AccountWide"]
]]--

local ADDON_NAME = "NirnsideSnapshot"
local sv -- ZO_SavedVars account-wide handle

-- Wrap a gather step so it can never error the game; return fallback on failure.
local function safe(fn, fallback)
  local ok, result = pcall(fn)
  if ok then return result end
  return fallback
end

----------------------------------------------------------------------
-- Value mappers
----------------------------------------------------------------------

-- Built at load time from a list of {constant, label} pairs. Any constant that
-- is missing in the current API (nil) is simply skipped, instead of being used
-- as a nil table key -- which would throw "table index is nil" and error the
-- game the instant the addon loads. Mythic is handled separately (display
-- quality), because it has no functional-quality constant.
local function buildLookup(pairs_)
  local t = {}
  for _, pair in ipairs(pairs_) do
    if pair[1] ~= nil then t[pair[1]] = pair[2] end
  end
  return t
end

local QUALITY = buildLookup({
  { ITEM_FUNCTIONAL_QUALITY_TRASH,     "trash" },
  { ITEM_FUNCTIONAL_QUALITY_NORMAL,    "normal" },
  { ITEM_FUNCTIONAL_QUALITY_MAGIC,     "fine" },
  { ITEM_FUNCTIONAL_QUALITY_ARCANE,    "superior" },
  { ITEM_FUNCTIONAL_QUALITY_ARTIFACT,  "epic" },
  { ITEM_FUNCTIONAL_QUALITY_LEGENDARY, "legendary" },
})

local ALLIANCE = buildLookup({
  { ALLIANCE_ALDMERI_DOMINION,    "Aldmeri Dominion" },
  { ALLIANCE_DAGGERFALL_COVENANT, "Daggerfall Covenant" },
  { ALLIANCE_EBONHEART_PACT,      "Ebonheart Pact" },
})

local function qualityString(link)
  local isMythic = safe(function()
    return ITEM_DISPLAY_QUALITY_MYTHIC_OVERRIDE ~= nil
      and GetItemLinkDisplayQuality
      and GetItemLinkDisplayQuality(link) == ITEM_DISPLAY_QUALITY_MYTHIC_OVERRIDE
  end, false)
  if isMythic then return "mythic" end
  local q = safe(function() return GetItemLinkFunctionalQuality(link) end, nil)
  return q and QUALITY[q] or "normal"
end

local function traitString(link)
  local t = safe(function() return GetItemLinkTraitInfo(link) end, nil)
  if not t or t == ITEM_TRAIT_TYPE_NONE then return nil end
  return safe(function() return GetString("SI_ITEMTRAITTYPE", t) end, nil)
end

----------------------------------------------------------------------
-- Bags / items
----------------------------------------------------------------------

local BAGS = {
  { bag = BAG_WORN,            location = "worn",           accountWide = false },
  { bag = BAG_BACKPACK,        location = "backpack",       accountWide = false },
  { bag = BAG_BANK,            location = "bank",           accountWide = true  },
  { bag = BAG_SUBSCRIBER_BANK, location = "subscriberBank", accountWide = true  },
  { bag = BAG_VIRTUAL,         location = "craftBag",       accountWide = true  },
}

local function readItem(bagId, slotIndex, location, owner)
  local link = safe(function() return GetItemLink(bagId, slotIndex) end, "")
  if not link or link == "" then return nil end

  local hasSet, setName, _, _, _, setId = safe(function()
    return GetItemLinkSetInfo(link, false)
  end, false)

  local item = {
    itemId    = safe(function() return GetItemLinkItemId(link) end, 0),
    itemLink  = link,
    name      = safe(function() return zo_strformat("<<1>>", GetItemLinkName(link)) end, "Unknown"),
    quality   = qualityString(link),
    count     = safe(function() return select(1, GetSlotStackSize(bagId, slotIndex)) end, 1),
    ownerCharacter = owner,
    location  = location,
    setName   = hasSet and setName ~= "" and setName or nil,
    setId     = hasSet and setId or nil,
    trait     = traitString(link),
    level     = safe(function() return GetItemLinkRequiredChampionPoints(link) end, 0),
    bound     = safe(function() return IsItemLinkBound(link) end, false),
    stolen    = safe(function() return IsItemLinkStolen(link) end, false),
    obtainable = true,
  }
  if item.level == 0 then item.level = nil end
  if item.setName then item.setName = zo_strformat("<<1>>", item.setName) end
  return item
end

local function gatherItems(charName)
  local items = {}
  for _, entry in ipairs(BAGS) do
    local bagId = entry.bag
    local size = safe(function() return GetBagSize(bagId) end, 0) or 0
    local owner = entry.accountWide and nil or charName
    for slot = 0, size - 1 do
      local item = safe(function() return readItem(bagId, slot, entry.location, owner) end, nil)
      if item then items[#items + 1] = item end
    end
  end
  return items
end

----------------------------------------------------------------------
-- Character: identity, vamp/werewolf, skills, CP, equipped
----------------------------------------------------------------------

-- Vampire / werewolf are detected from the World skill lines (persistent state,
-- not a buff). Stage is best-effort; see rule 2 about surfacing unverified data.
local function gatherCurse()
  local vampire = { isVampire = false, stage = 0 }
  local werewolf = { isWerewolf = false }
  safe(function()
    local worldType = SKILL_TYPE_WORLD
    local numLines = GetNumSkillLines(worldType)
    for i = 1, numLines do
      local name = GetSkillLineInfo(worldType, i)
      local discovered = select(4, GetSkillLineInfo(worldType, i))
      if name == GetString(SI_SKILLS_WORLD_VAMPIRE) or name == "Vampire" then
        vampire.isVampire = discovered == true
      elseif name == GetString(SI_SKILLS_WORLD_WEREWOLF) or name == "Werewolf" then
        werewolf.isWerewolf = discovered == true
      end
    end
  end)
  -- Vampire stage via the active stage buff, if available.
  vampire.stage = safe(function()
    local stage = GetVampireStage and GetVampireStage("player") or 0
    return stage or 0
  end, 0)
  return vampire, werewolf
end

local function gatherSkills()
  local lines = {}
  safe(function()
    local numTypes = GetNumSkillTypes()
    for skillType = 1, numTypes do
      local numLines = GetNumSkillLines(skillType)
      for lineIndex = 1, numLines do
        local name, rank, discovered = GetSkillLineInfo(skillType, lineIndex)
        if discovered then
          local abilities = {}
          local numAbilities = GetNumSkillAbilities(skillType, lineIndex)
          for a = 1, numAbilities do
            local aName, _, earnedRank, passive, _, purchased, progressionIndex, currentRank =
              GetSkillAbilityInfo(skillType, lineIndex, a)
            abilities[#abilities + 1] = {
              name = zo_strformat("<<1>>", aName),
              rank = currentRank or 0,
              morph = nil,
              purchased = purchased == true,
              skillStyle = nil,
            }
          end
          lines[#lines + 1] = {
            name = zo_strformat("<<1>>", name),
            category = safe(function() return GetString("SI_SKILLTYPE", skillType) end, "Skill"),
            rank = rank or 0,
            subclassed = false, -- U50 subclassing detection: needs in-game verification
            abilities = abilities,
          }
        end
      end
    end
  end)
  return lines
end

local function gatherChampion()
  local disciplines = {}
  safe(function()
    local numDisc = GetNumChampionDisciplines()
    for d = 1, numDisc do
      local discId = GetChampionDisciplineId(d)
      local discName = GetChampionDisciplineName(discId)
      local stars = {}
      local numSkills = GetNumChampionDisciplineSkills(discId)
      for s = 1, numSkills do
        local skillId = GetChampionSkillId(discId, s)
        local spent = GetNumPointsSpentOnChampionSkill(skillId) or 0
        if spent > 0 then
          stars[#stars + 1] = {
            name = zo_strformat("<<1>>", GetChampionSkillName(skillId)),
            points = spent,
            slotted = safe(function() return IsChampionSkillSlotted and IsChampionSkillSlotted(skillId) or false end, false),
          }
        end
      end
      if #stars > 0 then
        disciplines[#disciplines + 1] = { name = zo_strformat("<<1>>", discName), stars = stars }
      end
    end
  end)
  return disciplines
end

local EQUIP_SLOTS = {
  { slot = EQUIP_SLOT_HEAD,        label = "Head",       bar = nil },
  { slot = EQUIP_SLOT_SHOULDERS,   label = "Shoulders",  bar = nil },
  { slot = EQUIP_SLOT_CHEST,       label = "Chest",      bar = nil },
  { slot = EQUIP_SLOT_HAND,        label = "Hands",      bar = nil },
  { slot = EQUIP_SLOT_WAIST,       label = "Waist",      bar = nil },
  { slot = EQUIP_SLOT_LEGS,        label = "Legs",       bar = nil },
  { slot = EQUIP_SLOT_FEET,        label = "Feet",       bar = nil },
  { slot = EQUIP_SLOT_NECK,        label = "Necklace",   bar = nil },
  { slot = EQUIP_SLOT_RING1,       label = "Ring 1",     bar = nil },
  { slot = EQUIP_SLOT_RING2,       label = "Ring 2",     bar = nil },
  { slot = EQUIP_SLOT_MAIN_HAND,   label = "Main Hand",  bar = "front" },
  { slot = EQUIP_SLOT_OFF_HAND,    label = "Off Hand",   bar = "front" },
  { slot = EQUIP_SLOT_BACKUP_MAIN, label = "Main Hand",  bar = "back" },
  { slot = EQUIP_SLOT_BACKUP_OFF,  label = "Off Hand",   bar = "back" },
}

local function gatherEquipped()
  local equipped = {}
  for _, e in ipairs(EQUIP_SLOTS) do
    local link = safe(function() return GetItemLink(BAG_WORN, e.slot) end, "")
    if link and link ~= "" then
      local hasSet, setName = safe(function() return GetItemLinkSetInfo(link, false) end, false)
      local _, _, enchantName = safe(function() return GetItemLinkEnchantInfo(link) end, nil)
      equipped[#equipped + 1] = {
        slot = e.label,
        bar = e.bar,
        itemId = safe(function() return GetItemLinkItemId(link) end, 0),
        name = safe(function() return zo_strformat("<<1>>", GetItemLinkName(link)) end, "Unknown"),
        quality = qualityString(link),
        setName = hasSet and setName ~= "" and zo_strformat("<<1>>", setName) or nil,
        trait = traitString(link),
        enchant = enchantName and enchantName ~= "" and zo_strformat("<<1>>", enchantName) or nil,
        scribing = {},
      }
    end
  end
  return equipped
end

local function gatherCharacter()
  local name = safe(function() return zo_strformat("<<1>>", GetUnitName("player")) end, "Unknown")
  local vampire, werewolf = gatherCurse()
  local level = safe(function() return GetUnitLevel("player") end, 1)
  return {
    id = safe(function() return zo_strformat("<<1>>", GetCurrentCharacterId()) end, name),
    name = name,
    class = safe(function() return zo_strformat("<<1>>", GetUnitClass("player")) end, "Unknown"),
    race = safe(function() return zo_strformat("<<1>>", GetUnitRace("player")) end, "Unknown"),
    alliance = ALLIANCE[safe(function() return GetUnitAlliance("player") end, 0)] or "Aldmeri Dominion",
    gender = nil,
    level = level,
    championPoints = safe(function() return GetPlayerChampionPointsEarned() end, 0),
    mundus = nil, -- best-effort; needs buff lookup, left nil until verified
    attributes = {
      magicka = safe(function() return GetAttributeSpentPoints(ATTRIBUTE_MAGICKA) end, 0),
      health  = safe(function() return GetAttributeSpentPoints(ATTRIBUTE_HEALTH) end, 0),
      stamina = safe(function() return GetAttributeSpentPoints(ATTRIBUTE_STAMINA) end, 0),
    },
    vampire = vampire,
    werewolf = werewolf,
    classMastery = false,
    skillLines = gatherSkills(),
    champion = gatherChampion(),
    equipped = gatherEquipped(),
    companions = {},
    scribingScripts = {},
    research = {},
    lastSeen = GetTimeStamp(),
  }
end

----------------------------------------------------------------------
-- Account-wide: guilds, currencies, stickerbook
----------------------------------------------------------------------

local function gatherGuilds()
  local guilds = {}
  safe(function()
    for i = 1, GetNumGuilds() do
      local guildId = GetGuildId(i)
      guilds[#guilds + 1] = {
        name = zo_strformat("<<1>>", GetGuildName(guildId)),
        rank = nil,
        trader = safe(function() return GetGuildOwnedKioskInfo and select(1, GetGuildOwnedKioskInfo(guildId)) ~= nil end, false),
      }
    end
  end)
  return guilds
end

local function gatherCurrencies()
  return {
    transmuteCrystals = safe(function() return GetCurrencyAmount(CURT_CHAOTIC_CREATIA, CURRENCY_LOCATION_ACCOUNT) end, 0),
    telVar            = safe(function() return GetCurrencyAmount(CURT_TELVAR_STONES, CURRENCY_LOCATION_CHARACTER) end, 0),
    alliancePoints    = safe(function() return GetCurrencyAmount(CURT_ALLIANCE_POINTS, CURRENCY_LOCATION_ACCOUNT) end, 0),
    writVouchers      = safe(function() return GetCurrencyAmount(CURT_WRIT_VOUCHERS, CURRENCY_LOCATION_ACCOUNT) end, 0),
    eventTickets      = safe(function() return GetCurrencyAmount(CURT_EVENT_TICKETS, CURRENCY_LOCATION_ACCOUNT) end, 0),
    undauntedKeys     = safe(function() return GetCurrencyAmount(CURT_UNDAUNTED_KEYS, CURRENCY_LOCATION_ACCOUNT) end, 0),
  }
end

-- Item Set Collections (stickerbook). Iterated out of combat only; changes
-- rarely. Uses the real ESO collections API: walk every set id with
-- GetNextItemSetCollectionId, then read each piece's unlock state through
-- ITEM_SET_COLLECTIONS_DATA_MANAGER. (The old GetNumItemSetCollections /
-- GetItemSetCollectionInfo names never existed, so this silently returned
-- nothing -- that was the "stickerbook doesn't work" bug.)
local function stickerSlotLabel(slot)
  local name = safe(function() return zo_strformat("<<1>>", GetString("SI_ITEMSETCOLLECTIONSLOT", slot)) end, nil)
  if name and name ~= "" then return name end
  return "Slot " .. tostring(slot)
end

local function pieceUnlocked(pieceId, slot)
  return safe(function()
    local mgr = ITEM_SET_COLLECTIONS_DATA_MANAGER
    if not mgr then return false end
    local pd = mgr:GetOrCreateItemSetCollectionPieceData(pieceId, slot)
    return (pd and pd:IsUnlocked()) == true
  end, false)
end

local function gatherStickerbook()
  local sets = {}
  safe(function()
    if not GetNextItemSetCollectionId then return end
    local setId = GetNextItemSetCollectionId(nil)
    local guard = 0
    while setId and setId ~= 0 and guard < 10000 do
      guard = guard + 1
      local numPieces = safe(function() return GetNumItemSetCollectionPieces(setId) end, 0) or 0
      local name = safe(function() return zo_strformat("<<1>>", GetItemSetName(setId)) end, nil)
      if name and name ~= "" and numPieces > 0 then
        local catId = safe(function() return GetItemSetCollectionCategoryId(setId) end, nil)
        local category = catId
          and safe(function() return zo_strformat("<<1>>", GetItemSetCollectionCategoryName(catId)) end, "Unknown")
          or "Unknown"
        local pieces = {}
        for i = 1, numPieces do
          local ok, pieceId, slot = pcall(GetItemSetCollectionPieceInfo, setId, i)
          if ok and pieceId then
            local label = stickerSlotLabel(slot)
            -- Avoid clobbering when two pieces share a slot label.
            if pieces[label] ~= nil then label = label .. " " .. i end
            pieces[label] = pieceUnlocked(pieceId, slot)
          end
        end
        sets[#sets + 1] = {
          setId = setId,
          name = name,
          category = category ~= "" and category or "Unknown",
          pieces = pieces,
        }
      end
      setId = safe(function() return GetNextItemSetCollectionId(setId) end, nil)
    end
  end)
  return sets
end

-- Account-wide achievements (Pithka-style). ESO achievements are account-wide.
-- We export the FULL structured record (name, description, points, completion,
-- category, content) for every Trial / Dungeon / Arena achievement — earned or
-- not — so the app's board is driven entirely by real game data and never has
-- to guess names. Iterated out of combat on logout/ReloadUI only; read-only.

-- Map ESO's localized category name to our coarse content type. We match on
-- keywords so it works regardless of exact wording ("Group Arenas", etc.).
local function classifyCategory(name)
  local n = name and name:lower() or ""
  if n:find("trial") then return "Trial" end
  if n:find("arena") then return "Arena" end
  if n:find("dungeon") then return "Dungeon" end
  return nil
end

-- Record one achievement id (deduped) into `out` with full detail.
local function recordAchievement(out, seen, id, category, content)
  if not id or id == 0 or seen[id] then return end
  seen[id] = true
  local name, description, points, completed, date = safe(function()
    local n, d, p, _, c, dt = GetAchievementInfo(id)
    return n, d, p, c, dt
  end, nil, nil, 0, false, nil)
  if not name or name == "" then return end
  -- Cross-check completion with the dedicated getter when present.
  completed = safe(function()
    if IsAchievementComplete then return IsAchievementComplete(id) == true end
    return completed == true
  end, completed == true)
  if date == "" then date = nil end
  local title = safe(function()
    local t = GetAchievementRewardTitle and GetAchievementRewardTitle(id) or nil
    if t and t ~= "" then return zo_strformat("<<1>>", t) end
    return nil
  end, nil)
  out[#out + 1] = {
    id = id,
    name = zo_strformat("<<1>>", name),
    description = description and zo_strformat("<<1>>", description) or "",
    points = points or 0,
    completed = completed,
    category = category,
    content = content,
    title = title,
    date = date,
  }
end

-- The category listing returns only the "current" achievement in a chain (e.g.
-- the next uncompleted tier). Walk the whole line so we capture every tier
-- (base clear -> hard mode -> trifecta) with its own completion state.
local function recordLine(out, seen, listedId, category, content)
  if not listedId or listedId == 0 then return end
  local first = safe(function() return GetFirstAchievementInLine(listedId) end, 0)
  local id = (first and first ~= 0) and first or listedId
  local guard = 0
  while id and id ~= 0 and guard < 50 do
    recordAchievement(out, seen, id, category, content)
    id = safe(function() return GetNextAchievementInLine(id) end, 0)
    guard = guard + 1
  end
end

local function gatherAchievements()
  local out = {}
  local seen = {}
  safe(function()
    local numCats = GetNumAchievementCategories()
    for c = 1, numCats do
      local catName, numSubCats, numAch = GetAchievementCategoryInfo(c)
      local category = classifyCategory(catName and zo_strformat("<<1>>", catName) or "")
      if category then
        local catLabel = zo_strformat("<<1>>", catName)
        -- Top-level achievements (no subcategory).
        for a = 1, (numAch or 0) do
          local id = safe(function() return GetAchievementId(c, nil, a) end, 0)
          recordLine(out, seen, id, category, catLabel)
        end
        -- Subcategories are the individual dungeons / trials / arenas.
        for s = 1, (numSubCats or 0) do
          local subName, subNumAch = GetAchievementSubCategoryInfo(c, s)
          local content = (subName and subName ~= "") and zo_strformat("<<1>>", subName) or catLabel
          for a = 1, (subNumAch or 0) do
            local id = safe(function() return GetAchievementId(c, s, a) end, 0)
            recordLine(out, seen, id, category, content)
          end
        end
      end
    end
  end)
  -- Legacy earned-names list, derived so older importers still work.
  local names = {}
  for _, r in ipairs(out) do
    if r.completed then names[#names + 1] = r.name end
  end
  return out, names
end

----------------------------------------------------------------------
-- Snapshot orchestration
----------------------------------------------------------------------

local function upsertCharacter(char)
  sv.characters = sv.characters or {}
  for i, existing in ipairs(sv.characters) do
    if existing.id == char.id then
      sv.characters[i] = char
      return
    end
  end
  sv.characters[#sv.characters + 1] = char
end

local function takeSnapshot(reason)
  if IsUnitInCombat("player") then
    d("[Nirnside] In combat — snapshot skipped (will run next login/ReloadUI).")
    return
  end

  local charName = safe(function() return zo_strformat("<<1>>", GetUnitName("player")) end, "Unknown")

  sv.displayName = safe(function() return GetDisplayName() end, "@unknown")
  sv.region      = safe(function() return (GetWorldName() == "NA Megaserver") and "NA" or "EU" end, "EU")
  sv.apiVersion  = safe(function() return GetAPIVersion() end, 0)
  sv.esoPlus     = safe(function() return IsESOPlusSubscriber() end, false)
  sv.lastSnapshot = GetTimeStamp()
  sv.gold        = safe(function() return GetCurrencyAmount(CURT_MONEY, CURRENCY_LOCATION_CHARACTER) end, 0)
  sv.currencies  = gatherCurrencies()
  sv.guilds      = gatherGuilds()

  -- Account-wide bags + this character's bags in one pass.
  sv.items = sv.items or {}
  -- Rebuild: drop account bags + this character's items, then re-add fresh.
  local kept = {}
  for _, it in ipairs(sv.items) do
    local isAccountBag = it.location == "bank" or it.location == "subscriberBank" or it.location == "craftBag"
    if not isAccountBag and it.ownerCharacter ~= charName then
      kept[#kept + 1] = it
    end
  end
  local fresh = gatherItems(charName)
  for _, it in ipairs(fresh) do kept[#kept + 1] = it end
  sv.items = kept

  sv.stickerbook = gatherStickerbook()
  local achRecords, achNames = gatherAchievements()
  sv.achievementRecords = achRecords
  sv.achievements = achNames

  upsertCharacter(gatherCharacter())

  d(string.format("[Nirnside] Snapshot saved (%s). Log out or /reloadui to write to disk.", reason or "manual"))
end

----------------------------------------------------------------------
-- Lifecycle
----------------------------------------------------------------------

local function onPlayerActivated(_, initial)
  -- `initial` is true only on login and after /reloadui — never on zone changes.
  if not initial then return end
  zo_callLater(function() safe(function() takeSnapshot("login/reloadui") end) end, 2000)
end

local function onAddOnLoaded(_, name)
  if name ~= ADDON_NAME then return end
  EVENT_MANAGER:UnregisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED)

  -- Account-wide store. Defaults are empty; snapshots fill them in.
  sv = ZO_SavedVars:NewAccountWide("NirnsideData", 1, nil, {
    displayName = "@unknown",
    region = "EU",
    apiVersion = 0,
    esoPlus = false,
    lastSnapshot = 0,
    gold = 0,
    currencies = {},
    guilds = {},
    items = {},
    characters = {},
    stickerbook = {},
    achievements = {},
    achievementRecords = {},
  })

  EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_PLAYER_ACTIVATED, onPlayerActivated)

  SLASH_COMMANDS["/nirnside"] = function() safe(function() takeSnapshot("manual") end) end
end

EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED, onAddOnLoaded)
