--[[
  Nirnside Snapshot
  =================
  Writes your account + current character data to SavedVariables so the local
  Nirnside app can read it. Design rules (see .cursor/rules/nirnside.mdc):

    * NEVER run during combat.
    * Only snapshot on logout / ReloadUI / Quit, plus a manual /nirnside command
      or keybind. NEVER on zone or instance changes (PLAYER_ACTIVATED `initial`
      is true for those too — do not use it). No timers, no bag events in play.
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

-- Bindings.xml is loaded after this file; these names must exist at parse time.
ZO_CreateStringId("SI_KEYBINDINGS_CATEGORY_NIRNSIDE", "Nirnside")
ZO_CreateStringId("SI_BINDING_NAME_NIRNSIDE_SNAPSHOT", "Save Nirnside snapshot")

-- Wrap a gather step so it can never error the game; return fallback on failure.
local function safe(fn, fallback)
  local ok, result = pcall(fn)
  if ok then return result end
  return fallback
end

-- In-game .dds path as ESO returns it (e.g. /esoui/art/icons/ability_x.dds).
local function normIcon(path)
  if not path or path == "" then return nil end
  path = tostring(path):gsub("\\", "/")
  if path == "" then return nil end
  return path
end

local function abilityDescription(abilityId)
  if not abilityId or abilityId == 0 or not GetAbilityDescription then return nil end
  local desc = GetAbilityDescription(abilityId)
  if not desc or desc == "" then return nil end
  return zo_strformat("<<1>>", desc)
end

local function abilityIcon(abilityId)
  if not abilityId or abilityId == 0 or not GetAbilityIcon then return nil end
  return normIcon(GetAbilityIcon(abilityId))
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

-- Readable English labels for a stickerbook piece's item type. English-only by
-- design (see rules), so we keep an explicit map rather than relying on locale
-- strings. buildLookup skips any constant missing in the current API.
local WEAPON_NAME = buildLookup({
  { WEAPONTYPE_AXE,               "Axe" },
  { WEAPONTYPE_HAMMER,            "Mace" },
  { WEAPONTYPE_SWORD,             "Sword" },
  { WEAPONTYPE_DAGGER,            "Dagger" },
  { WEAPONTYPE_TWO_HANDED_SWORD,  "Greatsword" },
  { WEAPONTYPE_TWO_HANDED_AXE,    "Battle Axe" },
  { WEAPONTYPE_TWO_HANDED_HAMMER, "Maul" },
  { WEAPONTYPE_BOW,               "Bow" },
  { WEAPONTYPE_FIRE_STAFF,        "Inferno Staff" },
  { WEAPONTYPE_FROST_STAFF,       "Ice Staff" },
  { WEAPONTYPE_LIGHTNING_STAFF,   "Lightning Staff" },
  { WEAPONTYPE_HEALING_STAFF,     "Restoration Staff" },
  { WEAPONTYPE_SHIELD,            "Shield" },
})

local EQUIP_SLOT_NAME = buildLookup({
  { EQUIP_TYPE_HEAD,      "Head" },
  { EQUIP_TYPE_CHEST,     "Chest" },
  { EQUIP_TYPE_SHOULDERS, "Shoulders" },
  { EQUIP_TYPE_HAND,      "Hands" },
  { EQUIP_TYPE_WAIST,     "Waist" },
  { EQUIP_TYPE_LEGS,      "Legs" },
  { EQUIP_TYPE_FEET,      "Feet" },
  { EQUIP_TYPE_NECK,      "Necklace" },
  { EQUIP_TYPE_RING,      "Ring" },
})

local ARMOR_WEIGHT = buildLookup({
  { ARMORTYPE_LIGHT,  "Light" },
  { ARMORTYPE_MEDIUM, "Medium" },
  { ARMORTYPE_HEAVY,  "Heavy" },
})

-- Returns (typeLabel, weight) for the item behind a link, e.g.
-- ("Heavy Head", "Heavy"), ("One-Handed Sword" ->) "Sword", ("Necklace", nil).
local function pieceTypeInfo(link)
  -- Weapons/shields first (shields report as armor itemType but have a weapon type).
  local wt = safe(function() return GetItemLinkWeaponType(link) end, nil)
  if wt and wt ~= 0 and wt ~= WEAPONTYPE_NONE then
    return WEAPON_NAME[wt] or "Weapon", nil
  end
  local et = safe(function() return GetItemLinkEquipType(link) end, nil)
  local slot = et and EQUIP_SLOT_NAME[et] or nil
  if not slot then return nil, nil end
  if et == EQUIP_TYPE_NECK or et == EQUIP_TYPE_RING then
    return slot, nil -- jewelry has no weight
  end
  local at = safe(function() return GetItemLinkArmorType(link) end, nil)
  local weight = at and ARMOR_WEIGHT[at] or nil
  if weight then return weight .. " " .. slot, weight end
  return slot, nil
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

local function readItem(bagId, slotIndex, location, owner, ownerId)
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
    ownerCharacterId = ownerId,
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

local function gatherItems(charName, charId)
  local items = {}
  for _, entry in ipairs(BAGS) do
    local bagId = entry.bag
    local size = safe(function() return GetBagSize(bagId) end, 0) or 0
    local owner = entry.accountWide and nil or charName
    local ownerId = entry.accountWide and nil or charId
    for slot = 0, size - 1 do
      local item = safe(function() return readItem(bagId, slot, entry.location, owner, ownerId) end, nil)
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

-- Morph-slot constants (U46+ progression API). Numeric fallbacks match
-- MORPH_SLOT_BASE / MORPH_SLOT_MORPH_1 / MORPH_SLOT_MORPH_2 so a missing
-- global never becomes a nil table key.
local function morphSlotBegin()
  return MORPH_SLOT_ITERATION_BEGIN or MORPH_SLOT_BASE or 0
end

local function morphSlotEnd()
  return MORPH_SLOT_ITERATION_END or MORPH_SLOT_MORPH_2 or 2
end

-- One ability: passives keep their upgrade rank; actives/ultimates snapshot
-- independent ranks for base + both morphs via the live progression API.
-- Skip crafted/scribing skills — GetSkillAbilityInfo can error on those.
-- A morph slot is purchased only when the player has XP in it, or the game's
-- progression info says this is the selected morph at rank I+. 
-- GetAbilityProgressionRankFromAbilityId can return a rank for an ability id
-- the player has never spent a point on — that must not mark the slot owned.
-- Rank is always recorded (including 0) so the skill book can show whether
-- the ability is leveled. Never invent I–IV.
local function morphSlotOwned(progressionId, slot, abilityOwned, currentMorph)
  if GetProgressionSkillMorphSlotCurrentXP then
    local xp = GetProgressionSkillMorphSlotCurrentXP(progressionId, slot)
    if type(xp) == "number" then return true end
    -- nil XP means not purchased. A maxed selected morph can also report nil;
    -- only then fall back to the ability-level purchase.
    if abilityOwned and currentMorph ~= nil and slot == currentMorph then
      return true
    end
    return false
  end
  return abilityOwned and currentMorph ~= nil and slot == currentMorph
end

local function gatherOneAbility(skillType, lineIndex, skillIndex)
  if IsCraftedAbilitySkill and IsCraftedAbilitySkill(skillType, lineIndex, skillIndex) then
    return nil
  end

  local aName, texture, earnedRank, passive, _, purchased, progressionIndex, currentRank =
    GetSkillAbilityInfo(skillType, lineIndex, skillIndex)
  aName = zo_strformat("<<1>>", aName)
  if not aName or aName == "" then return nil end

  -- earnedRank is 0 until a skill point is spent. `purchased` alone has been
  -- true for abilities the player has not bought.
  local abilityOwned = purchased == true and (earnedRank or 0) >= 1

  local entry = {
    name = aName,
    rank = currentRank or 0,
    morph = nil,
    purchased = abilityOwned,
    skillStyle = nil,
    passive = passive == true,
    icon = normIcon(texture),
    morphs = {},
  }

  -- GetSkillAbilityInfo's texture is often blank. The ability id's icon is the
  -- real portrait, purchased or not.
  local skillAbilityId = GetSkillAbilityId and GetSkillAbilityId(skillType, lineIndex, skillIndex, false)
  entry.icon = abilityIcon(skillAbilityId) or entry.icon

  if passive then
    local cur, maxUpgrade = GetSkillAbilityUpgradeInfo(skillType, lineIndex, skillIndex)
    if cur ~= nil then entry.rank = cur end
    if maxUpgrade ~= nil then entry.maxRank = maxUpgrade end
    entry.purchased = (cur or 0) >= 1 or abilityOwned
    -- Keep the upgrade rank even when not purchased so the skill book can show
    -- which level every ability is at on this character.
    local abilityId = GetSkillAbilityId and GetSkillAbilityId(skillType, lineIndex, skillIndex, false)
    entry.icon = abilityIcon(abilityId) or entry.icon
    entry.description = abilityDescription(abilityId)
    return entry
  end

  if not GetProgressionSkillProgressionId then
    entry.purchased = abilityOwned and (currentRank or 0) >= 1
    return entry
  end

  local progressionId = GetProgressionSkillProgressionId(skillType, lineIndex, skillIndex)
  if not progressionId or progressionId == 0 then
    entry.purchased = abilityOwned and (currentRank or 0) >= 1
    return entry
  end

  local currentMorph = GetProgressionSkillCurrentMorphSlot
    and GetProgressionSkillCurrentMorphSlot(progressionId)
    or nil
  entry.morph = currentMorph

  -- Player's selected morph and its rank, from the progression index (not the
  -- progression id). This is the level shown in the skills window.
  local progMorph, progRank = nil, nil
  if type(progressionIndex) == "number" and progressionIndex > 0 and GetAbilityProgressionInfo then
    local _, m, r = GetAbilityProgressionInfo(progressionIndex)
    if type(m) == "number" then progMorph = m end
    if type(r) == "number" then progRank = r end
  end
  if type(currentRank) == "number" and currentRank > (progRank or 0) then
    progRank = currentRank
    if progMorph == nil then progMorph = currentMorph end
  end
  if type(progRank) == "number" then entry.rank = progRank end

  entry.skillStyle = safe(function()
    local id
    if GetProgressionSkillCurrentSkillStyleId then
      id = GetProgressionSkillCurrentSkillStyleId(progressionId)
    end
    if (not id or id == 0) and GetSkillAbilitySkillStyleId then
      id = GetSkillAbilitySkillStyleId(skillType, lineIndex, skillIndex)
    end
    if not id or id == 0 then return nil end
    local n = GetCollectibleName and GetCollectibleName(id)
    if n and n ~= "" then return zo_strformat("<<1>>", n) end
    return nil
  end, nil)

  local anyOwned = false
  for slot = morphSlotBegin(), morphSlotEnd() do
    local morph = safe(function()
      local abilityId = GetProgressionSkillMorphSlotAbilityId
        and GetProgressionSkillMorphSlotAbilityId(progressionId, slot)
      if not abilityId or abilityId == 0 then return nil end
      local slotName = zo_strformat("<<1>>", GetAbilityName(abilityId))
      local owned = abilityOwned and morphSlotOwned(progressionId, slot, abilityOwned, currentMorph)
      -- A selected morph the game has ranked I+ is purchased even when the
      -- earnedRank heuristic missed it. Rank alone on some other slot is not.
      local selected = (progMorph ~= nil and slot == progMorph) or (currentMorph ~= nil and slot == currentMorph)
      if (not owned) and selected and type(progRank) == "number" and progRank >= 1 then
        owned = true
      end
      local slotRank = nil
      -- Per-morph rank from the skill line, including 0. This is the level.
      if GetSkillLineProgressionAbilityRank then
        local r = GetSkillLineProgressionAbilityRank(skillType, lineIndex, skillIndex, slot)
        if type(r) == "number" then slotRank = r end
      end
      if selected and type(progRank) == "number" and progRank > (slotRank or 0) then
        slotRank = progRank
      end
      -- Last resort only when the line API is missing. A non-nil 0 from the
      -- line API is a real "not ranked", not an invitation to substitute this.
      if slotRank == nil and GetAbilityProgressionRankFromAbilityId then
        local r = GetAbilityProgressionRankFromAbilityId(abilityId)
        if type(r) == "number" then slotRank = r end
      end
      local row = {
        slot = slot,
        name = (slotName ~= "" and slotName) or aName,
        abilityId = abilityId,
        purchased = owned == true,
        icon = abilityIcon(abilityId),
        description = abilityDescription(abilityId),
      }
      if slotRank ~= nil then row.rank = slotRank end
      -- XP toward the next rank, only if the game reports extents. Never guess.
      if owned and GetProgressionSkillMorphSlotCurrentXP then
        local xp = GetProgressionSkillMorphSlotCurrentXP(progressionId, slot)
        if type(xp) == "number" then row.xp = xp end
        if slotRank and GetProgressionSkillMorphSlotRankXPExtents then
          local startXP, endXP = GetProgressionSkillMorphSlotRankXPExtents(progressionId, slot, slotRank)
          if type(startXP) == "number" then row.xpMin = startXP end
          if type(endXP) == "number" then row.xpMax = endXP end
        end
      end
      return row
    end, nil)
    if morph then
      entry.morphs[#entry.morphs + 1] = morph
      if morph.purchased then anyOwned = true end
      if currentMorph ~= nil and slot == currentMorph and morph.purchased then
        entry.name = morph.name
        if morph.rank ~= nil then entry.rank = morph.rank end
        entry.abilityId = morph.abilityId
        if morph.icon then entry.icon = morph.icon end
        if morph.description then entry.description = morph.description end
      end
    end
  end

  entry.purchased = anyOwned
  -- Keep the best rank the game reported. Never wipe a known I–IV down to 0
  -- just because the purchase heuristic failed.
  local best = type(entry.rank) == "number" and entry.rank or 0
  for i = 1, #entry.morphs do
    local r = entry.morphs[i].rank
    if type(r) == "number" and r > best then best = r end
  end
  entry.rank = best
  if not entry.icon or entry.icon == "" then
    for i = 1, #entry.morphs do
      local ic = entry.morphs[i].icon
      if ic and ic ~= "" then
        entry.icon = ic
        break
      end
    end
  end

  return entry
end

-- Subclassing (U46+): a class skill line active on this character that is not
-- one of the character's own class lines is "subclassed" (borrowed). A class
-- line leveled to 50 becomes "mastered" and unlocks account-wide. We read this
-- through SKILLS_DATA_MANAGER by the line's skillLineId; every call is guarded
-- so a client without these methods simply reports nothing extra.
local function skillLineTraits(skillType, lineIndex)
  return safe(function()
    local skillLineId = select(4, GetSkillLineInfo(skillType, lineIndex))
    if not skillLineId or not SKILLS_DATA_MANAGER then return nil end
    local data = SKILLS_DATA_MANAGER:GetSkillLineDataById(skillLineId)
    if not data then return nil end
    local isClass = data.IsClassSkillLine and data:IsClassSkillLine() or false
    local isOwnClass = data.IsPlayerClassSkillLine and data:IsPlayerClassSkillLine() or false
    local active = data.IsActive and data:IsActive() or false
    local mastered = data.HasMastery and data:HasMastery() or false
    return {
      isClass = isClass,
      subclassed = isClass and active and not isOwnClass,
      mastered = isClass and mastered,
      name = data.GetName and zo_strformat("<<1>>", data:GetName()) or nil,
    }
  end, nil)
end

local function gatherSkills(masteriesOut)
  local lines = {}
  local seenMastery = {}
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
            -- Per-ability pcall: one bad skill must not drop the rest of the line.
            local ability = safe(function()
              return gatherOneAbility(skillType, lineIndex, a)
            end, nil)
            if ability then abilities[#abilities + 1] = ability end
          end
          local traits = skillLineTraits(skillType, lineIndex)
          local lineName = zo_strformat("<<1>>", name)
          if masteriesOut and traits and traits.mastered then
            local mName = traits.name or lineName
            if not seenMastery[mName] then
              seenMastery[mName] = true
              masteriesOut[#masteriesOut + 1] = mName
            end
          end
          lines[#lines + 1] = {
            name = lineName,
            category = safe(function() return GetString("SI_SKILLTYPE", skillType) end, "Skill"),
            rank = rank or 0,
            subclassed = (traits and traits.subclassed) or false,
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

-- Wizard's Wardrobe integration ------------------------------------------
-- WW writes its own SavedVariables global `WizardsWardrobeSV`. Because we load
-- after it (## OptionalDependsOn), that table is in memory when we snapshot.
-- We only READ it, resolve item/skill names + icons with in-game APIs, and copy
-- a display-ready structure into our own snapshot. Nothing is written back to
-- WW, nothing is computed, and if WW is absent this is a silent no-op.

-- WW gear keys are EQUIP_SLOT_* constants; map to readable labels.
local WW_GEAR_SLOTS = {
  { slot = EQUIP_SLOT_HEAD,        label = "Head" },
  { slot = EQUIP_SLOT_SHOULDERS,   label = "Shoulders" },
  { slot = EQUIP_SLOT_CHEST,       label = "Chest" },
  { slot = EQUIP_SLOT_HAND,        label = "Hands" },
  { slot = EQUIP_SLOT_WAIST,       label = "Waist" },
  { slot = EQUIP_SLOT_LEGS,        label = "Legs" },
  { slot = EQUIP_SLOT_FEET,        label = "Feet" },
  { slot = EQUIP_SLOT_NECK,        label = "Necklace" },
  { slot = EQUIP_SLOT_RING1,       label = "Ring 1" },
  { slot = EQUIP_SLOT_RING2,       label = "Ring 2" },
  { slot = EQUIP_SLOT_MAIN_HAND,   label = "Main Hand" },
  { slot = EQUIP_SLOT_OFF_HAND,    label = "Off Hand" },
  { slot = EQUIP_SLOT_BACKUP_MAIN, label = "Backup Main" },
  { slot = EQUIP_SLOT_BACKUP_OFF,  label = "Backup Off" },
  { slot = EQUIP_SLOT_POISON,      label = "Poison" },
  { slot = EQUIP_SLOT_BACKUP_POISON, label = "Backup Poison" },
}

-- Readable zone names for WW's tags. Falls back to the tag if unknown.
local WW_ZONE_NAMES = {
  GEN = "General", PVP = "PvP", SUB = "Substitution",
  AA = "Aetherian Archive", HRC = "Hel Ra Citadel", SO = "Sanctum Ophidia",
  MOL = "Maw of Lorkhaj", HOF = "Halls of Fabrication", AS = "Asylum Sanctorium",
  CR = "Cloudrest", SS = "Sunspire", KA = "Kyne's Aegis", RG = "Rockgrove",
  DSR = "Dreadsail Reef", SE = "Sanity's Edge", LC = "Lucent Citadel",
  OC = "Ossein Cage", IA = "Infinite Archive", BRP = "Blackrose Prison",
}

local function wwResolveGear(gearTable)
  if type(gearTable) ~= "table" then return {} end
  local mythicSlot = gearTable.mythic
  local pieces = {}
  for _, entry in ipairs(WW_GEAR_SLOTS) do
    local g = gearTable[entry.slot]
    local link = type(g) == "table" and g.link or nil
    if link and link ~= "" and (g.id == nil or tostring(g.id) ~= "0") then
      local hasSet, setName = safe(function() return GetItemLinkSetInfo(link, false) end, false)
      pieces[#pieces + 1] = {
        slot = entry.label,
        name = safe(function() return zo_strformat("<<1>>", GetItemLinkName(link)) end, entry.label),
        icon = safe(function() return normIcon(GetItemLinkIcon(link)) end, nil),
        setName = (hasSet and setName ~= "") and zo_strformat("<<1>>", setName) or nil,
        trait = traitString(link),
        quality = qualityString(link),
        mythic = (mythicSlot ~= nil and entry.slot == mythicSlot) or false,
      }
    end
  end
  return pieces
end

local function wwResolveBars(skillsTable)
  if type(skillsTable) ~= "table" then return {} end
  local bars = {}
  local map = { [0] = "front", [1] = "back" }
  for hotbar = 0, 1 do
    local slots = skillsTable[hotbar]
    if type(slots) == "table" then
      local skills = {}
      for slot = 3, 8 do
        local raw = slots[slot]
        local abilityId = type(raw) == "table" and raw.id or raw
        abilityId = tonumber(abilityId)
        if abilityId and abilityId > 0 then
          skills[#skills + 1] = {
            name = safe(function() return zo_strformat("<<1>>", GetAbilityName(abilityId)) end, nil),
            icon = safe(function() return normIcon(GetAbilityIcon(abilityId)) end, nil),
          }
        end
      end
      if #skills > 0 then bars[#bars + 1] = { bar = map[hotbar], skills = skills } end
    end
  end
  return bars
end

local function wwResolveCP(cpTable)
  local names = {}
  if type(cpTable) ~= "table" then return names end
  for _, starId in pairs(cpTable) do
    local id = tonumber(starId)
    if id and id > 0 and GetChampionSkillName then
      local n = safe(function() return zo_strformat("<<1>>", GetChampionSkillName(id)) end, nil)
      if n and n ~= "" then names[#names + 1] = n end
    end
  end
  return names
end

local function wwResolveFood(foodTable)
  if type(foodTable) ~= "table" then return nil end
  local link = foodTable.link
  if not link or link == "" then return nil end
  return {
    slot = "Food",
    name = safe(function() return zo_strformat("<<1>>", GetItemLinkName(link)) end, nil),
    icon = safe(function() return normIcon(GetItemLinkIcon(link)) end, nil),
  }
end

local function wwBuildZones(setups, pages)
  local zones = {}
  if type(setups) ~= "table" then return zones end
  for tag, pageMap in pairs(setups) do
    if type(pageMap) == "table" then
      local zone = { tag = tag, name = WW_ZONE_NAMES[tag] or tag, pages = {} }
      for pageId, setupList in pairs(pageMap) do
        -- pageId 0 is WW's "current page" pointer, not a real page.
        if type(pageId) == "number" and pageId >= 1 and type(setupList) == "table" then
          local pageInfo = (type(pages) == "table" and pages[tag] and pages[tag][pageId]) or nil
          local page = {
            name = (pageInfo and pageInfo.name) or ("Page " .. tostring(pageId)),
            setups = {},
          }
          for index = 1, #setupList do
            local s = setupList[index]
            if type(s) == "table" then
              page.setups[#page.setups + 1] = {
                name = s.name or "",
                gear = wwResolveGear(s.gear),
                bars = wwResolveBars(s.skills),
                cp = wwResolveCP(s.cp),
                food = wwResolveFood(s.food),
              }
            end
          end
          if #page.setups > 0 then zone.pages[#zone.pages + 1] = page end
        end
      end
      if #zone.pages > 0 then zones[#zones + 1] = zone end
    end
  end
  return zones
end

-- Read this character's Wizard's Wardrobe setups from WW's own SavedVariables.
local function gatherWardrobe(charId)
  return safe(function()
    if type(WizardsWardrobeSV) ~= "table" then return nil end
    local displayName = GetDisplayName()
    local root = WizardsWardrobeSV.Default and WizardsWardrobeSV.Default[displayName]
    if type(root) ~= "table" then return nil end

    -- Prefer this character's own storage; fall back to account-wide storage.
    local store = root[charId]
    local accountWide = false
    if type(store) ~= "table" or type(store.setups) ~= "table" then
      local acc = root["$AccountWide"]
      if type(acc) == "table" and type(acc.accountWideStorage) == "table" then
        store = acc.accountWideStorage
        accountWide = true
      end
    end
    if type(store) ~= "table" or type(store.setups) ~= "table" then return nil end

    local zones = wwBuildZones(store.setups, store.pages)
    if #zones == 0 then return nil end
    return { accountWide = accountWide, zones = zones }
  end, nil)
end

local function gatherCharacter()
  local name = safe(function() return zo_strformat("<<1>>", GetUnitName("player")) end, "Unknown")
  local vampire, werewolf = gatherCurse()
  local level = safe(function() return GetUnitLevel("player") end, 1)
  local charId = safe(function() return zo_strformat("<<1>>", GetCurrentCharacterId()) end, name)
  local classMasteries = {}
  local skillLines = gatherSkills(classMasteries)
  return {
    id = charId,
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
    classMasteries = classMasteries,
    skillLines = skillLines,
    champion = gatherChampion(),
    equipped = gatherEquipped(),
    companions = {},
    scribingScripts = {},
    research = {},
    lastSeen = GetTimeStamp(),
    gold = safe(function() return GetCurrencyAmount(CURT_MONEY, CURRENCY_LOCATION_CHARACTER) end, 0),
    telVar = safe(function() return GetCurrencyAmount(CURT_TELVAR_STONES, CURRENCY_LOCATION_CHARACTER) end, 0),
    archivedAt = nil,
    wardrobe = gatherWardrobe(charId),
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
    bankGold          = safe(function() return GetCurrencyAmount(CURT_MONEY, CURRENCY_LOCATION_BANK) end, 0),
  }
end

-- Item Set Collections (stickerbook). Iterated out of combat only; changes
-- rarely. Uses the real ESO collections API: walk every set id with
-- GetNextItemSetCollectionId, then read each piece's unlock state through
-- ITEM_SET_COLLECTIONS_DATA_MANAGER. (The old GetNumItemSetCollections /
-- GetItemSetCollectionInfo names never existed, so this silently returned
-- nothing -- that was the "stickerbook doesn't work" bug.)
local function stickerNormIcon(path)
  if not path or path == "" then return nil end
  return (path:gsub("\\", "/"))
end

local function stickerSlotLabel(slot)
  local name = safe(function() return zo_strformat("<<1>>", GetString("SI_ITEMSETCOLLECTIONSLOT", slot)) end, nil)
  if name and name ~= "" then return name end
  return "Slot " .. tostring(slot)
end

-- Resolve the item link for a collection piece. Some clients want a link style
-- argument, some don't — try both so we always get a link (and therefore the
-- real item name + icon) when the game can provide one.
local function pieceItemLink(pieceId)
  if not GetItemSetCollectionPieceItemLink then return nil end
  local link = safe(function() return GetItemSetCollectionPieceItemLink(pieceId, LINK_STYLE_DEFAULT) end, nil)
  if not link or link == "" then
    link = safe(function() return GetItemSetCollectionPieceItemLink(pieceId) end, nil)
  end
  if link == "" then link = nil end
  return link
end

-- Read one stickerbook piece into the rich shape the app expects. Name comes
-- from the game (authoritative): the item link's name first, the collections
-- manager's formatted name second, so labels are always the correct item name.
local function readStickerPiece(setId, i)
  local ok, pieceId, slot = pcall(GetItemSetCollectionPieceInfo, setId, i)
  if not ok or not pieceId then return nil end

  local pd = safe(function()
    local mgr = ITEM_SET_COLLECTIONS_DATA_MANAGER
    return mgr and mgr:GetOrCreateItemSetCollectionPieceData(pieceId, slot) or nil
  end, nil)
  local collected = pd and safe(function() return pd:IsUnlocked() == true end, false) or false
  local pdName = pd and safe(function() return zo_strformat("<<1>>", pd:GetFormattedName()) end, nil) or nil

  local link = pieceItemLink(pieceId)
  local linkName = link and safe(function() return zo_strformat("<<1>>", GetItemLinkName(link)) end, nil) or nil
  local icon = link and safe(function() return stickerNormIcon(GetItemLinkIcon(link)) end, nil) or nil
  local typeLabel, weight
  if link then typeLabel, weight = pieceTypeInfo(link) end

  local fallback = stickerSlotLabel(slot)
  local name
  if linkName and linkName ~= "" then
    name = linkName
  elseif pdName and pdName ~= "" then
    name = pdName
  else
    name = typeLabel or fallback
  end

  return {
    slot = fallback,
    type = (typeLabel and typeLabel ~= "") and typeLabel or fallback,
    weight = weight,
    name = name,
    icon = icon,
    collected = collected,
  }
end

-- Rich per-piece data so the app can show the real item icon + name for each
-- slot (like the in-game stickerbook), collected or not.
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
        -- Mirror the in-game two-level tree: a top-level category (Overland,
        -- Dungeons, Trials, …) with a specific subcategory (the zone/dungeon/
        -- trial). Capture the game's own ordering so the UI can match it.
        local subId = safe(function() return GetItemSetCollectionCategoryId(setId) end, nil)
        local subName = subId
          and safe(function() return zo_strformat("<<1>>", GetItemSetCollectionCategoryName(subId)) end, nil)
          or nil
        local parentId = subId
          and safe(function() return GetItemSetCollectionCategoryParentId(subId) end, nil)
          or nil
        if parentId == 0 then parentId = nil end
        local parentName = parentId
          and safe(function() return zo_strformat("<<1>>", GetItemSetCollectionCategoryName(parentId)) end, nil)
          or nil
        local category, subcategory, catOrder, subOrder
        if parentName and parentName ~= "" then
          category = parentName
          subcategory = subName
          catOrder = safe(function() return GetItemSetCollectionCategoryOrder(parentId) end, 0) or 0
          subOrder = safe(function() return GetItemSetCollectionCategoryOrder(subId) end, 0) or 0
        else
          category = subName or "Unknown"
          subcategory = nil
          catOrder = safe(function() return GetItemSetCollectionCategoryOrder(subId) end, 0) or 0
          subOrder = 0
        end
        local pieces = {}
        for i = 1, numPieces do
          local piece = readStickerPiece(setId, i)
          if piece then pieces[#pieces + 1] = piece end
        end
        sets[#sets + 1] = {
          setId = setId,
          name = name,
          category = (category and category ~= "") and category or "Unknown",
          subcategory = subcategory,
          categoryOrder = catOrder,
          subOrder = subOrder,
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

-- Pithka-tracked achievement ids (keep in sync with src/lib/achievements/pithka.ts).
-- Querying these directly with IsAchievementComplete is how the in-game tracker
-- works. Maelstrom Arena clears (1305 / 1330) are still CHARACTER-BOUND: an alt
-- that has not run them reports false. We remember each toon's completions and
-- union them so one clear checks the whole account.
local TRACKED_ACHIEVEMENT_IDS = {
  340, 342, 343, 421, 446, 448, 449, 451, 459, 461, 463, 464,
  465, 467, 545, 678, 679, 681, 876, 878, 880, 941, 942, 1084,
  1107, 1108, 1114, 1120, 1128, 1129, 1136, 1137, 1138, 1140, 1275, 1276,
  1279, 1303, 1305, 1330, 1344, 1368, 1391, 1462, 1474, 1503, 1505, 1506,
  1507, 1508, 1523, 1524, 1525, 1526, 1549, 1552, 1553, 1554, 1556, 1559,
  1560, 1561, 1563, 1564, 1565, 1568, 1569, 1570, 1572, 1573, 1576, 1577,
  1578, 1580, 1581, 1584, 1585, 1586, 1588, 1589, 1592, 1593, 1594, 1596,
  1597, 1600, 1601, 1602, 1604, 1607, 1608, 1609, 1610, 1613, 1614, 1615,
  1617, 1620, 1621, 1622, 1623, 1626, 1627, 1628, 1629, 1632, 1633, 1634,
  1635, 1638, 1639, 1640, 1641, 1644, 1645, 1646, 1647, 1650, 1651, 1652,
  1653, 1656, 1657, 1658, 1691, 1694, 1695, 1696, 1699, 1702, 1703, 1704,
  1810, 1829, 1836, 1838, 1960, 1963, 1964, 1965, 1966, 1967, 1976, 1979,
  1980, 1981, 1982, 1983, 1991, 2075, 2077, 2079, 2085, 2086, 2087, 2102,
  2133, 2134, 2135, 2136, 2139, 2140, 2153, 2154, 2155, 2156, 2158, 2159,
  2163, 2164, 2165, 2166, 2167, 2168, 2261, 2262, 2263, 2264, 2266, 2267,
  2271, 2272, 2273, 2274, 2275, 2276, 2301, 2305, 2363, 2364, 2365, 2366,
  2368, 2372, 2384, 2395, 2416, 2417, 2418, 2419, 2421, 2422, 2426, 2427,
  2428, 2429, 2430, 2431, 2435, 2466, 2467, 2468, 2469, 2470, 2540, 2541,
  2542, 2543, 2545, 2546, 2550, 2551, 2552, 2553, 2554, 2555, 2575, 2581,
  2677, 2679, 2695, 2697, 2698, 2700, 2701, 2705, 2706, 2707, 2708, 2709,
  2710, 2734, 2736, 2737, 2739, 2740, 2746, 2755, 2824, 2828, 2832, 2833,
  2834, 2835, 2837, 2838, 2842, 2843, 2844, 2845, 2846, 2847, 2883, 2886,
  2908, 2912, 2913, 2987, 3003, 3004, 3005, 3006, 3007, 3017, 3018, 3019,
  3020, 3022, 3023, 3027, 3028, 3029, 3030, 3031, 3032, 3035, 3042, 3105,
  3107, 3108, 3110, 3111, 3115, 3117, 3118, 3119, 3120, 3153, 3154, 3224,
  3226, 3244, 3248, 3249, 3250, 3251, 3252, 3376, 3377, 3378, 3379, 3380,
  3381, 3391, 3395, 3396, 3397, 3398, 3399, 3400, 3410, 3469, 3470, 3471,
  3472, 3473, 3474, 3484, 3530, 3531, 3532, 3533, 3534, 3535, 3538, 3560,
  3564, 3565, 3566, 3567, 3568, 3811, 3812, 3813, 3814, 3815, 3816, 3826,
  3852, 3853, 3854, 3855, 3856, 3857, 3867, 4015, 4019, 4020, 4021, 4022,
  4023, 4110, 4111, 4112, 4113, 4114, 4115, 4120, 4129, 4130, 4131, 4132,
  4133, 4134, 4139, 4268, 4272, 4273, 4274, 4275, 4276, 4312, 4313, 4314,
  4315, 4316, 4317, 4327, 4335, 4336, 4337, 4338, 4339, 4340, 4350, 4485,
  4517
}

-- Maelstrom Arena clears (vet Conqueror 1305, Perfect Run 1330, and the rest
-- of that tiny leftover set) are still CHARACTER-BOUND in live ESO.
-- IsAchievementComplete(1305) is false on a toon that has not run it, even if
-- another toon on the account has. We keep a per-character id list and union
-- them so the board cannot uncheck MSA vet when you log an alt.
local function collectIdsFromTable(t, done)
  if type(t) ~= "table" then return end
  for k, v in pairs(t) do
    if type(v) == "number" and v > 0 then
      done[v] = true
    elseif (v == true or v == 1) and type(k) == "number" and k > 0 then
      done[k] = true
    elseif type(v) == "string" then
      local n = tonumber(v)
      if n and n > 0 then done[n] = true end
    elseif type(k) == "string" then
      local n = tonumber(k)
      if n and n > 0 and (v == true or v == 1) then done[n] = true end
    end
  end
end

local function idsToSet(done)
  local set = {}
  for id, v in pairs(done) do
    if type(id) == "number" and id > 0 and v then set[id] = true end
  end
  return set
end

local function gatherLiveCompletedIds()
  local mine = {}
  safe(function()
    if not IsAchievementComplete then return end
    for i = 1, #TRACKED_ACHIEVEMENT_IDS do
      local id = TRACKED_ACHIEVEMENT_IDS[i]
      if safe(function() return IsAchievementComplete(id) end, false) then mine[id] = true end
    end
    if not GetNumAchievementCategories then return end
    local function scanId(id)
      if not id or id == 0 then return end
      local first = safe(function() return GetFirstAchievementInLine(id) end, 0)
      local cur = (first and first ~= 0) and first or id
      local guard = 0
      while cur and cur ~= 0 and guard < 60 do
        if safe(function() return IsAchievementComplete(cur) end, false) then mine[cur] = true end
        cur = safe(function() return GetNextAchievementInLine(cur) end, 0)
        guard = guard + 1
      end
    end
    local numCats = GetNumAchievementCategories()
    for c = 1, numCats do
      local _, numSub, numAch = GetAchievementCategoryInfo(c)
      for a = 1, (numAch or 0) do
        scanId(safe(function() return GetAchievementId(c, nil, a) end, 0))
      end
      for s = 1, (numSub or 0) do
        local _, subNumAch = GetAchievementSubCategoryInfo(c, s)
        for a = 1, (subNumAch or 0) do
          scanId(safe(function() return GetAchievementId(c, s, a) end, 0))
        end
      end
    end
  end)
  return mine
end

local function gatherCompletedAchievementIds(charId, records)
  local live = gatherLiveCompletedIds()
  sv.characterCompletedIds = sv.characterCompletedIds or {}
  if charId and charId ~= "" then
    -- Never shrink this toon's list. MSA is character-bound; if we once saw
    -- 1305 here, keep it even if this pass misses it.
    local mine = {}
    collectIdsFromTable(sv.characterCompletedIds[charId], mine)
    collectIdsFromTable(live, mine)
    sv.characterCompletedIds[charId] = idsToSet(mine)
  end
  local done = {}
  -- Keep previously written account ids (pairs, not ipairs: ZO_SavedVars
  -- proxies often skip ipairs).
  collectIdsFromTable(sv.completedAchievementIds, done)
  collectIdsFromTable(live, done)
  if type(sv.characterCompletedIds) == "table" then
    for _, set in pairs(sv.characterCompletedIds) do
      collectIdsFromTable(set, done)
    end
  end
  if type(records) == "table" then
    for _, rec in pairs(records) do
      if type(rec) == "table" and rec.completed and type(rec.id) == "number" and rec.id > 0 then
        done[rec.id] = true
      end
    end
  end
  return idsToSet(done)
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

local function upsertById(list, char)
  for i, existing in ipairs(list) do
    if existing.id == char.id then
      list[i] = char
      return
    end
  end
  list[#list + 1] = char
end

local function upsertCharacter(char)
  sv.characters = sv.characters or {}
  upsertById(sv.characters, char)
end

-- Live account roster from the game. Returns nil if the API looks unusable, so
-- we never archive everyone by accident.
local function collectLiveRoster()
  local okN, n = pcall(GetNumCharacters)
  if not okN or type(n) ~= "number" or n < 1 then return nil end

  local byId = {}
  local rows = {}
  for i = 1, n do
    local packed = { pcall(GetCharacterInfo, i) }
    if packed[1] then
      local name = packed[2]
      local formattedName = name and zo_strformat("<<1>>", name) or name
      local ids = {}
      for k = 3, #packed do
        local v = packed[k]
        if type(v) == "string" and v ~= "" then
          ids[v] = true
          local formatted = zo_strformat("<<1>>", v)
          if formatted then ids[formatted] = true end
        elseif type(v) == "number" and v > 1000 then
          ids[tostring(v)] = true
        end
      end
      local row = { name = formattedName, ids = ids, raw = packed }
      rows[#rows + 1] = row
      for id in pairs(ids) do byId[id] = row end
      if formattedName then byId["name:" .. formattedName] = row end
    end
  end

  local me = safe(function() return zo_strformat("<<1>>", GetCurrentCharacterId()) end, nil)
  if me and not byId[me] then
    return nil
  end
  return { rows = rows, byId = byId }
end

local function pickLiveId(row)
  local best = nil
  for id in pairs(row.ids) do
    if id ~= row.name and #tostring(id) >= 6 then
      if not best or #tostring(id) > #tostring(best) then best = id end
    end
  end
  return best or row.name
end

local function stubFromLive(row)
  local packed = row.raw
  local gender, f4, f5, f6 = packed[3], packed[5], packed[6], packed[7]
  local class, race = "Unknown", "Unknown"
  local allianceVal = f6
  if type(f4) == "number" and type(f5) == "number" then
    class = safe(function() return zo_strformat("<<1>>", GetClassName(gender, f4)) end, "Unknown")
    race = safe(function() return zo_strformat("<<1>>", GetRaceName(gender, f5)) end, "Unknown")
  elseif type(packed[5]) == "number" and type(packed[6]) == "string" then
    -- Character-select shape: name, gender, level, championPoints, class, race, alliance, id
    class = zo_strformat("<<1>>", packed[6])
    race = type(packed[7]) == "string" and zo_strformat("<<1>>", packed[7]) or "Unknown"
    allianceVal = packed[8]
  end
  local level = type(packed[4]) == "number" and packed[4] or 1
  return {
    id = pickLiveId(row),
    name = row.name,
    class = class ~= "" and class or "Unknown",
    race = race ~= "" and race or "Unknown",
    alliance = ALLIANCE[allianceVal] or "Aldmeri Dominion",
    gender = nil,
    level = level,
    championPoints = 0,
    mundus = nil,
    attributes = {},
    vampire = { isVampire = false, stage = 0 },
    werewolf = { isWerewolf = false },
    classMastery = false,
    skillLines = {},
    champion = {},
    equipped = {},
    companions = {},
    scribingScripts = {},
    research = {},
    lastSeen = nil,
    gold = 0,
    telVar = 0,
    archivedAt = nil,
  }
end

local function isLiveCharacter(char, live)
  if live.byId[char.id] then return true end
  if char.name and live.byId["name:" .. char.name] then return true end
  return false
end

-- Move deleted toons to archive; add never-logged stubs so the roster matches ESO.
local function syncRosterWithGame()
  local live = collectLiveRoster()
  if not live then return end

  sv.characters = sv.characters or {}
  sv.archivedCharacters = sv.archivedCharacters or {}

  local roster = {}
  for _, char in ipairs(sv.characters) do
    if isLiveCharacter(char, live) then
      char.archivedAt = nil
      roster[#roster + 1] = char
    else
      char.archivedAt = char.archivedAt or GetTimeStamp()
      upsertById(sv.archivedCharacters, char)
    end
  end

  -- A deleted toon that was already archived stays archived.
  -- If they somehow exist again (same id), pull them back.
  local stillArchived = {}
  for _, char in ipairs(sv.archivedCharacters) do
    if isLiveCharacter(char, live) then
      char.archivedAt = nil
      upsertById(roster, char)
    else
      stillArchived[#stillArchived + 1] = char
    end
  end
  sv.archivedCharacters = stillArchived

  local onRoster = {}
  for _, char in ipairs(roster) do
    onRoster[char.id] = true
    if char.name then onRoster["name:" .. char.name] = true end
  end
  for _, row in ipairs(live.rows) do
    local id = pickLiveId(row)
    if not onRoster[id] and not (row.name and onRoster["name:" .. row.name]) then
      roster[#roster + 1] = stubFromLive(row)
    end
  end

  sv.characters = roster
end

local function totalLiveGold()
  local total = 0
  for _, c in ipairs(sv.characters or {}) do
    total = total + (c.gold or 0)
  end
  local bank = (sv.currencies and sv.currencies.bankGold) or 0
  return total + bank
end

local function totalLiveTelVar()
  local total = 0
  for _, c in ipairs(sv.characters or {}) do
    total = total + (c.telVar or 0)
  end
  return total
end

local function takeSnapshot(reason)
  if not sv then return end
  if IsUnitInCombat("player") then
    d("[Nirnside] In combat — snapshot skipped.")
    return
  end

  local charName = safe(function() return zo_strformat("<<1>>", GetUnitName("player")) end, "Unknown")
  local charId = safe(function() return zo_strformat("<<1>>", GetCurrentCharacterId()) end, charName)

  sv.displayName = safe(function() return GetDisplayName() end, "@unknown")
  sv.region      = safe(function() return (GetWorldName() == "NA Megaserver") and "NA" or "EU" end, "EU")
  sv.apiVersion  = safe(function() return GetAPIVersion() end, 0)
  sv.esoPlus     = safe(function() return IsESOPlusSubscriber() end, false)
  sv.lastSnapshot = GetTimeStamp()
  sv.currencies  = gatherCurrencies()
  sv.guilds      = gatherGuilds()

  -- Account-wide bags + this character's bags in one pass.
  sv.items = sv.items or {}
  -- Rebuild: drop account bags + this character's items, then re-add fresh.
  local kept = {}
  for _, it in ipairs(sv.items) do
    local isAccountBag = it.location == "bank" or it.location == "subscriberBank" or it.location == "craftBag"
    local mine = (it.ownerCharacterId and it.ownerCharacterId == charId)
      or (not it.ownerCharacterId and it.ownerCharacter == charName)
    if not isAccountBag and not mine then
      kept[#kept + 1] = it
    end
  end
  local fresh = gatherItems(charName, charId)
  for _, it in ipairs(fresh) do kept[#kept + 1] = it end
  sv.items = kept

  sv.stickerbook = gatherStickerbook()
  local achRecords, achNames = gatherAchievements()
  sv.achievementRecords = achRecords
  sv.achievements = achNames
  sv.completedAchievementIds = gatherCompletedAchievementIds(charId, achRecords)

  upsertCharacter(gatherCharacter())
  syncRosterWithGame()
  -- Account gold / Tel Var are live wallets (+ bank for gold), never last logout.
  sv.gold = totalLiveGold()
  sv.currencies = sv.currencies or {}
  sv.currencies.telVar = totalLiveTelVar()

  -- Logout / ReloadUI / Quit hooks run *before* the game writes SavedVariables,
  -- so those captures land on disk in the same action. A manual/keybind capture
  -- stays in memory until the next logout or ReloadUI.
  if reason == "manual" or reason == "keybind" then
    d("[Nirnside] Snapshot saved. Log out or /reloadui to write it to disk.")
  end
end

----------------------------------------------------------------------
-- Lifecycle
----------------------------------------------------------------------

-- Called from Bindings.xml (must be global).
function Nirnside_TakeSnapshot()
  safe(function() takeSnapshot("keybind") end)
end

local function hookUnload(fnName, reason)
  if type(ZO_PreHook) ~= "function" then return end
  ZO_PreHook(fnName, function()
    safe(function() takeSnapshot(reason) end)
  end)
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
    archivedCharacters = {},
    stickerbook = {},
    achievements = {},
    achievementRecords = {},
    completedAchievementIds = {},
    characterCompletedIds = {},
  })

  -- Do not use EVENT_PLAYER_ACTIVATED: its `initial` flag is true on login *and*
  -- on every zone/instance load screen, which is exactly the hitch we must avoid.
  hookUnload("ReloadUI", "reloadui")
  hookUnload("Logout", "logout")
  hookUnload("Quit", "quit")

  SLASH_COMMANDS["/nirnside"] = function() safe(function() takeSnapshot("manual") end) end
end

EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED, onAddOnLoaded)
