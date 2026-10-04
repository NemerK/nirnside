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
-- ranks for base + both morphs via the live progression API.
-- Crafted/scribing skills crash GetSkillAbilityInfo — gather those separately.
--
-- A morph slot is "owned" only when it is the player's CURRENT form for this
-- ability: the base while unmorphed, or the chosen morph after morphing. ESO
-- shares one progression (and its XP) across the base and both morphs, so
-- GetProgressionSkillMorphSlotCurrentXP returns a number for EVERY slot — it is
-- not a per-slot ownership signal. Using it marked both morphs purchased at
-- once (impossible in game). Ownership follows the current morph slot, so
-- exactly one slot is owned per purchased ability.
local function morphSlotOwned(progressionId, slot, abilityOwned, currentMorph)
  if not abilityOwned then return false end
  local active = currentMorph
  if type(active) ~= "number" then active = MORPH_SLOT_BASE or 0 end
  return slot == active
end

local function craftedScriptName(scriptId)
  if not scriptId or scriptId == 0 then return nil end
  local name = safe(function()
    return GetCraftedAbilityScriptDisplayName and GetCraftedAbilityScriptDisplayName(scriptId) or nil
  end, nil)
  if not name or name == "" then return nil end
  return zo_strformat("<<1>>", name)
end

local function craftedAbilityIdToAbilityId(craftedId)
  local id = safe(function()
    return GetCraftedAbilityRepresentativeAbilityId and GetCraftedAbilityRepresentativeAbilityId(craftedId) or nil
  end, nil)
  if type(id) == "number" and id > 0 then return id end
  id = safe(function()
    return GetAbilityIdForCraftedAbilityId and GetAbilityIdForCraftedAbilityId(craftedId) or nil
  end, nil)
  if type(id) == "number" and id > 0 then return id end
  return safe(function()
    if not SCRIBING_DATA_MANAGER or not SCRIBING_DATA_MANAGER.GetCraftedAbilityData then return nil end
    local data = SCRIBING_DATA_MANAGER:GetCraftedAbilityData(craftedId)
    if not data then return nil end
    if data.GetAbilityId then return data:GetAbilityId() end
    if data.GetRepresentativeAbilityId then return data:GetRepresentativeAbilityId() end
    return nil
  end, nil)
end

-- Scribing grimoires. Never call GetSkillAbilityInfo here — it errors.
local function gatherCraftedAbility(skillType, lineIndex, skillIndex)
  local craftedId = safe(function()
    return GetCraftedAbilitySkillCraftedAbilityId
      and GetCraftedAbilitySkillCraftedAbilityId(skillType, lineIndex, skillIndex)
      or nil
  end, nil)
  if not craftedId or craftedId == 0 then return nil end

  local aName = safe(function()
    return GetCraftedAbilityDisplayName and GetCraftedAbilityDisplayName(craftedId) or nil
  end, nil)
  aName = aName and zo_strformat("<<1>>", aName) or nil
  if not aName or aName == "" then return nil end

  local unlocked = safe(function()
    return IsCraftedAbilityUnlocked and IsCraftedAbilityUnlocked(craftedId) == true
  end, false)
  local icon = safe(function()
    return GetCraftedAbilityIcon and normIcon(GetCraftedAbilityIcon(craftedId)) or nil
  end, nil)
  local abilityId = craftedAbilityIdToAbilityId(craftedId)
  if (not icon or icon == "") and abilityId then
    icon = abilityIcon(abilityId)
  end

  local description = safe(function()
    if not GetCraftedAbilityDescription then return nil end
    local desc = GetCraftedAbilityDescription(craftedId)
    if not desc or desc == "" then return nil end
    return zo_strformat("<<1>>", desc)
  end, nil)
  if not description then description = abilityDescription(abilityId) end

  local scripts = {}
  local scribed = false
  safe(function()
    if not GetCraftedAbilityActiveScriptIds then return end
    local primary, signature, affix = GetCraftedAbilityActiveScriptIds(craftedId)
    for _, sid in ipairs({ primary, signature, affix }) do
      local n = craftedScriptName(sid)
      if n then
        scripts[#scripts + 1] = n
        scribed = true
      end
    end
  end)
  if not scribed then
    scribed = safe(function()
      return IsCraftedAbilityScribed and IsCraftedAbilityScribed(craftedId) == true
    end, false)
  end

  return {
    name = aName,
    abilityId = abilityId,
    rank = unlocked and 1 or 0,
    morph = nil,
    purchased = unlocked == true,
    skillStyle = nil,
    passive = false,
    crafted = true,
    scribed = scribed == true,
    scripts = scripts,
    icon = icon,
    description = description,
    morphs = {},
  }
end

local function gatherScribingScripts()
  local out, seen = {}, {}
  local function add(name)
    if name and name ~= "" and not seen[name] then
      seen[name] = true
      out[#out + 1] = name
    end
  end
  safe(function()
    if not GetNumCraftedAbilityScripts or not GetCraftedAbilityScriptIdAtIndex then return end
    for i = 1, GetNumCraftedAbilityScripts() do
      local id = GetCraftedAbilityScriptIdAtIndex(i)
      if id and id ~= 0 then
        local unlocked = true
        if IsCraftedAbilityScriptUnlocked then
          unlocked = IsCraftedAbilityScriptUnlocked(id) == true
        else
          unlocked = false
        end
        if unlocked then add(craftedScriptName(id)) end
      end
    end
  end)
  if #out == 0 then
    safe(function()
      if not GetNumCraftedAbilities or not GetCraftedAbilityIdAtIndex then return end
      for i = 1, GetNumCraftedAbilities() do
        local cid = GetCraftedAbilityIdAtIndex(i)
        if cid and GetCraftedAbilityActiveScriptIds then
          local primary, signature, affix = GetCraftedAbilityActiveScriptIds(cid)
          add(craftedScriptName(primary))
          add(craftedScriptName(signature))
          add(craftedScriptName(affix))
        end
      end
    end)
  end
  return out
end

-- The skills window's own purchase bit. Class Mastery spends Class Mastery
-- Points through the point allocator; GetSkillAbilityInfo's purchased flag
-- still follows regular skill points and can stay false on a bought passive.
local function skillDataPurchased(skillType, lineIndex, skillIndex)
  return safe(function()
    if not SKILLS_DATA_MANAGER or not SKILLS_DATA_MANAGER.GetSkillLineDataById then return false end
    local skillLineId = select(4, GetSkillLineInfo(skillType, lineIndex))
    if not skillLineId then return false end
    local lineData = SKILLS_DATA_MANAGER:GetSkillLineDataById(skillLineId)
    if not lineData then return false end
    local skillData = lineData.GetSkillDataByIndex and lineData:GetSkillDataByIndex(skillIndex) or nil
    if not skillData then return false end
    if skillData.GetPointAllocator then
      local alloc = skillData:GetPointAllocator()
      if alloc and alloc.IsPurchased and alloc:IsPurchased() then return true end
    end
    if skillData.IsPurchased and skillData:IsPurchased() then return true end
    return false
  end, false)
end

local function gatherOneAbility(skillType, lineIndex, skillIndex, classMasteryLine)
  if IsCraftedAbilitySkill and IsCraftedAbilitySkill(skillType, lineIndex, skillIndex) then
    return gatherCraftedAbility(skillType, lineIndex, skillIndex)
  end

  local aName, texture, earnedRank, passive, _, purchased, progressionIndex, currentRank =
    GetSkillAbilityInfo(skillType, lineIndex, skillIndex)
  aName = zo_strformat("<<1>>", aName)
  if not aName or aName == "" then return nil end

  -- earnedRank is 0 until a skill point is spent. `purchased` alone has been
  -- true for abilities the player has not bought. Class Mastery passives spend
  -- Class Mastery Points instead, so the game's purchased flag is the truth
  -- even when earnedRank stays 0.
  local abilityOwned = purchased == true and (earnedRank or 0) >= 1
  if classMasteryLine and (purchased == true or skillDataPurchased(skillType, lineIndex, skillIndex)) then
    abilityOwned = true
  end

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
    if classMasteryLine and (purchased == true or abilityOwned) then
      entry.purchased = true
      if (entry.rank or 0) < 1 then entry.rank = 1 end
    end
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

  -- The CURRENT form's morph + rank (the active morph, or the base while
  -- unmorphed). Per-morph remembered ranks are read separately, per slot, below
  -- — ESO remembers the rank the base and EACH morph reached even after a
  -- respec, so they can differ (base IV, morph 1 IV, morph 2 II). Never invent.
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
      -- Ownership follows the current form only: a slot is purchased when the
      -- ability currently has a skill point in it AND this is its active morph.
      -- We do NOT infer ownership from a remembered rank — a base or morph that
      -- was leveled and later respec'd out still carries its rank but is not
      -- purchased, so it must show greyed.
      local owned = morphSlotOwned(progressionId, slot, abilityOwned, currentMorph)
      local selected = (progMorph ~= nil and slot == progMorph) or (currentMorph ~= nil and slot == currentMorph)
      -- Per-slot remembered rank straight from the game: this is how the skills
      -- UI reads each morph node's level (ZO_ActiveSkillProgressionData
      -- currentRank = GetAbilityProgressionRankFromAbilityId(slot's abilityId)).
      -- nil = never owned (show as unranked); a number = the remembered rank,
      -- kept even when the slot is not currently purchased. Never propagated
      -- across slots — each morph keeps its own real value.
      local slotRank = nil
      if GetAbilityProgressionRankFromAbilityId then
        local r = GetAbilityProgressionRankFromAbilityId(abilityId)
        if type(r) == "number" then slotRank = r end
      end
      if selected and type(progRank) == "number" and progRank > (slotRank or -1) then
        slotRank = progRank
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
  -- The ability's headline rank is the rank of its CURRENT form (the owned
  -- morph, or the base). entry.rank was already set from that above. We do NOT
  -- copy a rank onto the other morph slots: each slot keeps the real per-slot
  -- value the game reported, so a morph the player never chose never looks
  -- leveled when it isn't. If the current-morph rank is missing, fall back to
  -- the highest real slot rank so a known I–IV is never shown as 0.
  if type(entry.rank) ~= "number" or entry.rank <= 0 then
    for i = 1, #entry.morphs do
      local r = entry.morphs[i].rank
      if type(r) == "number" and r > (type(entry.rank) == "number" and entry.rank or 0) then
        entry.rank = r
      end
    end
  end
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

local function isClassMasteryLineName(name)
  if type(name) ~= "string" then return false end
  return zo_strlower(name) == "class mastery"
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

local function gatherSkills(masteriesOut, classMasteryOut)
  local lines = {}
  local seenMastery = {}
  safe(function()
    local numTypes = GetNumSkillTypes()
    for skillType = 1, numTypes do
      local numLines = GetNumSkillLines(skillType)
      for lineIndex = 1, numLines do
        local name, rank, discovered = GetSkillLineInfo(skillType, lineIndex)
        local lineName = zo_strformat("<<1>>", name)
        local classMasteryLine = isClassMasteryLineName(lineName)
        -- Class Mastery is greyed-out (still listed) until unlocked, and hidden
        -- while subclassing. Always dump the line when the game still lists it
        -- so purchased passives can show; skip only when the API omits it.
        if discovered or classMasteryLine then
          local abilities = {}
          local numAbilities = GetNumSkillAbilities(skillType, lineIndex)
          for a = 1, numAbilities do
            -- Per-ability pcall: one bad skill must not drop the rest of the line.
            local ability = safe(function()
              return gatherOneAbility(skillType, lineIndex, a, classMasteryLine)
            end, nil)
            if ability then abilities[#abilities + 1] = ability end
          end
          local traits = skillLineTraits(skillType, lineIndex)
          if masteriesOut and traits and traits.mastered then
            local mName = traits.name or lineName
            if not seenMastery[mName] then
              seenMastery[mName] = true
              masteriesOut[#masteriesOut + 1] = mName
            end
          end
          if classMasteryLine and classMasteryOut and discovered then
            classMasteryOut.unlocked = true
          end
          lines[#lines + 1] = {
            name = lineName,
            category = safe(function() return GetString("SI_SKILLTYPE", skillType) end, "Skill"),
            rank = rank or 0,
            subclassed = (traits and traits.subclassed) or false,
            classMastery = classMasteryLine,
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

----------------------------------------------------------------------
-- Dailies: random dungeon rewards, crafting writs, Undaunted pledges
--
-- Journal + LFG APIs at logout, plus tiny quest-event flags so a turn-in
-- still counts after the quest leaves the journal. Flags live in
-- sv.dailyFlags (addon-internal) and expire at the megaserver daily reset
-- (EU 03:00 UTC, NA 10:00 UTC — same clock as pledges / writs / randoms).
-- Event handlers only write a flag — they never scan bags or take a snapshot.
-- Writs/pledges not in the journal and not flagged done are unknown, never
-- invented as available — the game does not say "already completed today".
----------------------------------------------------------------------

-- ZOS / ESO-Hub: EU 03:00 UTC, NA 10:00 UTC. Never a single 10:00 clock.
local function megaserverResetHourUtc()
  local world = safe(function()
    if GetWorldName then return GetWorldName() end
  end, "") or ""
  if tostring(world):find("NA", 1, true) then return 10 end
  return 3
end

local WRIT_DEFS = {
  { craft = "blacksmithing", name = "Blacksmith Writ", match = "blacksmith" },
  { craft = "clothing", name = "Clothier Writ", match = "clothier" },
  { craft = "woodworking", name = "Woodworker Writ", match = "woodworker" },
  { craft = "enchanting", name = "Enchanter Writ", match = "enchanter" },
  { craft = "alchemy", name = "Alchemist Writ", match = "alchemist" },
  { craft = "provisioning", name = "Provisioner Writ", match = "provisioner" },
  { craft = "jewelry", name = "Jewelry Crafting Writ", match = "jewelry" },
}

-- Same live NPC split the hub uses. English names only.
-- Maj = 12 original easier I/II. Glirion = 12 original harder (CoA + CoH).
-- Urgarlag = every DLC dungeon from Imperial City Prison onward.
local PLEDGE_GIVERS = {
  maj = {
    "Fungal Grotto I", "Fungal Grotto II",
    "Banished Cells I", "Banished Cells II",
    "Spindleclutch I", "Spindleclutch II",
    "Darkshade Caverns I", "Darkshade Caverns II",
    "Elden Hollow I", "Elden Hollow II",
    "Wayrest Sewers I", "Wayrest Sewers II",
  },
  glirion = {
    "Arx Corinium", "Blackheart Haven", "Blessed Crucible", "Direfrost Keep",
    "Selene's Web", "Tempest Island", "Vaults of Madness", "Volenfell",
    "Crypt of Hearts I", "Crypt of Hearts II",
    "City of Ash I", "City of Ash II",
  },
  urgarlag = {
    "Imperial City Prison", "White-Gold Tower", "White Gold Tower",
    "Cradle of Shadows", "Ruins of Mazzatun",
    "Bloodroot Forge", "Falkreath Hold",
    "Fang Lair", "Scalecaller Peak",
    "Moon Hunter Keep", "March of Sacrifices",
    "Frostvault", "Depths of Malatar",
    "Lair of Maarselok", "Moongrave Fane",
    "Icereach", "Unhallowed Grave",
    "Castle Thorn", "Stone Garden",
    "Black Drake Villa", "The Cauldron", "Cauldron",
    "Red Petal Bastion", "Dread Cellar", "The Dread Cellar",
    "Coral Aerie", "Shipwright's Regret",
    "Earthen Root Enclave", "Graven Deep",
    "Bal Sunnar", "Scrivener's Hall",
    "Oathsworn Pit", "Bedlam Veil",
    "Exiled Redoubt", "Lep Seclusa",
    "Naj-Caldeesh", "Black Gem Foundry",
  },
}

local PLEDGE_GIVER_NAMES = {
  maj = "Maj al-Ragath",
  glirion = "Glirion the Redbeard",
  urgarlag = "Urgarlag Chief-bane",
}

local PLEDGE_ORDER = { "maj", "glirion", "urgarlag" }

-- In-game pledge quest IDs (WPamA PID). Giver is this table, never the NPC
-- you happen to be standing next to at logout.
local PLEDGE_BY_ID = {
  [5244] = { giver = "maj", dungeon = "Banished Cells I" },
  [5246] = { giver = "maj", dungeon = "Banished Cells II" },
  [5247] = { giver = "maj", dungeon = "Fungal Grotto I" },
  [5248] = { giver = "maj", dungeon = "Fungal Grotto II" },
  [5260] = { giver = "maj", dungeon = "Spindleclutch I" },
  [5273] = { giver = "maj", dungeon = "Spindleclutch II" },
  [5274] = { giver = "maj", dungeon = "Darkshade Caverns I" },
  [5275] = { giver = "maj", dungeon = "Darkshade Caverns II" },
  [5276] = { giver = "maj", dungeon = "Elden Hollow I" },
  [5277] = { giver = "maj", dungeon = "Elden Hollow II" },
  [5278] = { giver = "maj", dungeon = "Wayrest Sewers I" },
  [5282] = { giver = "maj", dungeon = "Wayrest Sewers II" },
  [5283] = { giver = "glirion", dungeon = "Crypt of Hearts I" },
  [5284] = { giver = "glirion", dungeon = "Crypt of Hearts II" },
  [5288] = { giver = "glirion", dungeon = "Arx Corinium" },
  [5290] = { giver = "glirion", dungeon = "City of Ash I" },
  [5291] = { giver = "glirion", dungeon = "Direfrost Keep" },
  [5301] = { giver = "glirion", dungeon = "Tempest Island" },
  [5303] = { giver = "glirion", dungeon = "Volenfell" },
  [5305] = { giver = "glirion", dungeon = "Blackheart Haven" },
  [5306] = { giver = "glirion", dungeon = "Blessed Crucible" },
  [5307] = { giver = "glirion", dungeon = "Selene's Web" },
  [5309] = { giver = "glirion", dungeon = "Vaults of Madness" },
  [5381] = { giver = "glirion", dungeon = "City of Ash II" },
  [5382] = { giver = "urgarlag", dungeon = "Imperial City Prison" },
  [5431] = { giver = "urgarlag", dungeon = "White-Gold Tower" },
  [5636] = { giver = "urgarlag", dungeon = "Ruins of Mazzatun" },
  [5780] = { giver = "urgarlag", dungeon = "Cradle of Shadows" },
  [6053] = { giver = "urgarlag", dungeon = "Bloodroot Forge" },
  [6054] = { giver = "urgarlag", dungeon = "Falkreath Hold" },
  [6154] = { giver = "urgarlag", dungeon = "Scalecaller Peak" },
  [6155] = { giver = "urgarlag", dungeon = "Fang Lair" },
  [6187] = { giver = "urgarlag", dungeon = "Moon Hunter Keep" },
  [6189] = { giver = "urgarlag", dungeon = "March of Sacrifices" },
  [6250] = { giver = "urgarlag", dungeon = "Frostvault" },
  [6252] = { giver = "urgarlag", dungeon = "Depths of Malatar" },
  [6350] = { giver = "urgarlag", dungeon = "Moongrave Fane" },
  [6352] = { giver = "urgarlag", dungeon = "Lair of Maarselok" },
  [6415] = { giver = "urgarlag", dungeon = "Icereach" },
  [6417] = { giver = "urgarlag", dungeon = "Unhallowed Grave" },
  [6506] = { giver = "urgarlag", dungeon = "Stone Garden" },
  [6508] = { giver = "urgarlag", dungeon = "Castle Thorn" },
  [6577] = { giver = "urgarlag", dungeon = "Black Drake Villa" },
  [6579] = { giver = "urgarlag", dungeon = "The Cauldron" },
  [6684] = { giver = "urgarlag", dungeon = "Red Petal Bastion" },
  [6686] = { giver = "urgarlag", dungeon = "The Dread Cellar" },
  [6741] = { giver = "urgarlag", dungeon = "Coral Aerie" },
  [6743] = { giver = "urgarlag", dungeon = "Shipwright's Regret" },
  [6836] = { giver = "urgarlag", dungeon = "Earthen Root Enclave" },
  [6838] = { giver = "urgarlag", dungeon = "Graven Deep" },
  [6897] = { giver = "urgarlag", dungeon = "Bal Sunnar" },
  [7028] = { giver = "urgarlag", dungeon = "Scrivener's Hall" },
  [7106] = { giver = "urgarlag", dungeon = "Oathsworn Pit" },
  [7156] = { giver = "urgarlag", dungeon = "Bedlam Veil" },
  [7236] = { giver = "urgarlag", dungeon = "Exiled Redoubt" },
  [7238] = { giver = "urgarlag", dungeon = "Lep Seclusa" },
  [7321] = { giver = "urgarlag", dungeon = "Naj-Caldeesh" },
  [7324] = { giver = "urgarlag", dungeon = "Black Gem Foundry" },
}

local WRIT_BY_ID = {
  [5368] = "blacksmithing", [5377] = "blacksmithing", [5392] = "blacksmithing",
  [5374] = "clothing", [5388] = "clothing", [5389] = "clothing",
  [5394] = "woodworking", [5395] = "woodworking", [5396] = "woodworking",
  [5415] = "alchemy", [5416] = "alchemy", [5417] = "alchemy", [5418] = "alchemy",
  [6098] = "alchemy", [6099] = "alchemy", [6100] = "alchemy", [6101] = "alchemy",
  [6102] = "alchemy", [6103] = "alchemy", [6104] = "alchemy", [6105] = "alchemy",
  [5400] = "enchanting", [5406] = "enchanting", [5407] = "enchanting",
  [5409] = "provisioning", [5412] = "provisioning", [5413] = "provisioning", [5414] = "provisioning",
  [6218] = "jewelry", [6227] = "jewelry", [6228] = "jewelry",
}

-- WPamA world-boss daily quest IDs. One pick per zone per day.
local WORLD_BOSS_BY_ID = {
  [5522] = "wrothgar", [5523] = "wrothgar", [5524] = "wrothgar",
  [5519] = "wrothgar", [5518] = "wrothgar", [5521] = "wrothgar",
  [5865] = "vvardenfell", [5904] = "vvardenfell", [5866] = "vvardenfell",
  [5918] = "vvardenfell", [5916] = "vvardenfell", [5906] = "vvardenfell",
  [5606] = "gold-coast", [5605] = "gold-coast",
  [6082] = "summerset", [6087] = "summerset", [6083] = "summerset",
  [6084] = "summerset", [6086] = "summerset", [6085] = "summerset",
  [6380] = "northern-elsweyr", [6382] = "northern-elsweyr", [6381] = "northern-elsweyr",
  [6377] = "northern-elsweyr", [6378] = "northern-elsweyr", [6379] = "northern-elsweyr",
  [6509] = "western-skyrim", [6517] = "western-skyrim", [6518] = "western-skyrim", [6519] = "western-skyrim",
  [6526] = "blackreach", [6527] = "blackreach",
  [6651] = "blackwood", [6652] = "blackwood", [6650] = "blackwood",
  [6653] = "blackwood", [6645] = "blackwood", [6649] = "blackwood",
  [6816] = "high-isle", [6807] = "high-isle", [6821] = "high-isle",
  [6808] = "high-isle", [6803] = "high-isle", [6822] = "high-isle",
  [7040] = "telvanni", [7044] = "telvanni",
  [7039] = "apocrypha", [7041] = "apocrypha", [7042] = "apocrypha", [7043] = "apocrypha",
  [7109] = "gold-road", [7116] = "gold-road", [7117] = "gold-road",
  [7118] = "gold-road", [7119] = "gold-road", [7120] = "gold-road",
  [7266] = "solstice", [7264] = "solstice", [7265] = "solstice",
  [7271] = "solstice", [7272] = "solstice", [7270] = "solstice",
}

local function normDungeon(name)
  if not name then return "" end
  local s = tostring(name):lower()
  s = s:gsub("^pledge:%s*", "")
  s = s:gsub("^the%s+", "")
  s = s:gsub("%-", " ")
  s = s:gsub("%s+", " ")
  s = s:match("^%s*(.-)%s*$") or ""
  return s
end

local PLEDGE_BY_DUNGEON = {}
for giver, list in pairs(PLEDGE_GIVERS) do
  for _, name in ipairs(list) do
    PLEDGE_BY_DUNGEON[normDungeon(name)] = giver
  end
end

local function nextResetAt(ts)
  ts = ts or GetTimeStamp()
  local hour = megaserverResetHourUtc()
  local remain = safe(function()
    if GetTimeUntilNextDailyLoginRewardClaimS then
      return GetTimeUntilNextDailyLoginRewardClaimS()
    end
  end, nil)
  if type(remain) == "number" and remain > 0 and remain < 36 * 3600 then
    return ts + math.floor(remain)
  end
  local secs = ts % 86400
  local today = ts - secs + hour * 3600
  if ts < today then return today end
  return today + 86400
end

-- Civil date from a UTC unix timestamp. ESO's os.date is local and has no `!`.
local function utcYmd(ts)
  local z = math.floor(ts / 86400) + 719468
  local era = math.floor(z / 146097)
  if z < 0 then era = math.floor((z - 146096) / 146097) end
  local doe = z - era * 146097
  local yoe = math.floor((doe - math.floor(doe / 1460) + math.floor(doe / 36524) - math.floor(doe / 146096)) / 365)
  local y = yoe + era * 400
  local doy = doe - (365 * yoe + math.floor(yoe / 4) - math.floor(yoe / 100) + math.floor(yoe / 400))
  local mp = math.floor((5 * doy + 2) / 153)
  local d = doy - math.floor((153 * mp + 2) / 5) + 1
  local m = mp + (mp < 10 and 3 or -9)
  y = y + (m <= 2 and 1 or 0)
  return string.format("%04d-%02d-%02d", y, m, d)
end

local function esoDayKey(ts)
  ts = ts or GetTimeStamp()
  return utcYmd(ts - megaserverResetHourUtc() * 3600)
end

local function currentCharId()
  return safe(function() return zo_strformat("<<1>>", GetCurrentCharacterId()) end, nil)
end

local function cleanQuestName(name)
  if not name or name == "" then return "" end
  local formatted = safe(function() return zo_strformat("<<1>>", name) end, name)
  return tostring(formatted or name)
end

-- ZO_SavedVars may reload a character id as a number or a string. Try both.
local function dailyFlagKeys(charId)
  local keys = { tostring(charId) }
  local n = tonumber(charId)
  if n then keys[#keys + 1] = n end
  return keys
end

local function ensureDailyBucket(charId)
  if not sv or not charId then return nil end
  sv.dailyFlags = sv.dailyFlags or {}
  local today = esoDayKey()
  for _, k in ipairs(dailyFlagKeys(charId)) do
    local bucket = sv.dailyFlags[k]
    if type(bucket) == "table" and bucket.dayKey == today then
      bucket.writs = bucket.writs or {}
      bucket.pledges = bucket.pledges or {}
      bucket.worldBosses = bucket.worldBosses or {}
      return bucket
    end
  end
  local bucket = { dayKey = today, writs = {}, pledges = {}, worldBosses = {} }
  sv.dailyFlags[tostring(charId)] = bucket
  return bucket
end

local CRAFT_BY_TYPE = {}
if CRAFTING_TYPE_BLACKSMITHING then CRAFT_BY_TYPE[CRAFTING_TYPE_BLACKSMITHING] = "blacksmithing" end
if CRAFTING_TYPE_CLOTHIER then CRAFT_BY_TYPE[CRAFTING_TYPE_CLOTHIER] = "clothing" end
if CRAFTING_TYPE_WOODWORKING then CRAFT_BY_TYPE[CRAFTING_TYPE_WOODWORKING] = "woodworking" end
if CRAFTING_TYPE_ENCHANTING then CRAFT_BY_TYPE[CRAFTING_TYPE_ENCHANTING] = "enchanting" end
if CRAFTING_TYPE_ALCHEMY then CRAFT_BY_TYPE[CRAFTING_TYPE_ALCHEMY] = "alchemy" end
if CRAFTING_TYPE_PROVISIONING then CRAFT_BY_TYPE[CRAFTING_TYPE_PROVISIONING] = "provisioning" end
if CRAFTING_TYPE_JEWELRYCRAFTING then CRAFT_BY_TYPE[CRAFTING_TYPE_JEWELRYCRAFTING] = "jewelry" end

local function journalQuestId(journalIndex, fallbackId)
  if type(fallbackId) == "number" and fallbackId > 0 then return fallbackId end
  if not journalIndex or not GetJournalQuestId then return nil end
  local id = safe(function() return GetJournalQuestId(journalIndex) end, nil)
  if type(id) == "number" and id > 0 then return id end
  return nil
end

local function questNameFromId(id)
  if not id or not GetQuestName then return "" end
  return cleanQuestName(safe(function() return GetQuestName(id) end, ""))
end

local function matchWrit(questName, questId)
  if type(questId) == "number" and WRIT_BY_ID[questId] then
    local craft = WRIT_BY_ID[questId]
    for _, def in ipairs(WRIT_DEFS) do
      if def.craft == craft then return def end
    end
  end
  if not questName then return nil end
  local lower = tostring(questName):lower()
  if lower:find("masterful", 1, true) or lower:find("master writ", 1, true) then
    return nil
  end
  for _, def in ipairs(WRIT_DEFS) do
    if lower:find(def.match, 1, true) then return def end
  end
  return nil
end

local function giverFromNpcName(name)
  if not name or name == "" then return nil end
  local n = tostring(name):lower()
  if n:find("urgarlag", 1, true) then return "urgarlag" end
  if n:find("glirion", 1, true) then return "glirion" end
  if n:find("maj", 1, true) and n:find("ragath", 1, true) then return "maj" end
  if n:find("maj al", 1, true) then return "maj" end
  return nil
end

local function interactGiver()
  for _, tag in ipairs({ "interact", "reticleover" }) do
    local name = cleanQuestName(safe(function()
      if GetUnitName then return GetUnitName(tag) end
    end, ""))
    local giver = giverFromNpcName(name)
    if giver then return giver end
  end
  return nil
end

local function scanTextForGiver(text)
  return giverFromNpcName(text)
end

-- In-game giver from the journal text (who sent you), not a dungeon-name table.
local function giverFromJournal(journalIndex)
  if not journalIndex then return nil end
  if GetJournalQuestInfo then
    local packed = { pcall(GetJournalQuestInfo, journalIndex) }
    if packed[1] then
      for i = 2, #packed do
        if type(packed[i]) == "string" then
          local giver = scanTextForGiver(packed[i])
          if giver then return giver end
        end
      end
    end
  end
  if GetJournalQuestConditionInfo then
    local steps = safe(function()
      return GetJournalQuestNumSteps and GetJournalQuestNumSteps(journalIndex)
    end, 4) or 4
    for step = 1, math.max(1, steps) do
      for cond = 1, 8 do
        local packed = { pcall(GetJournalQuestConditionInfo, journalIndex, step, cond) }
        if packed[1] and type(packed[2]) == "string" then
          local giver = scanTextForGiver(packed[2])
          if giver then return giver end
        end
      end
    end
  end
  return nil
end

local PLEDGE_BY_NAME = nil
local function ensurePledgeNameMap()
  if PLEDGE_BY_NAME then return end
  PLEDGE_BY_NAME = {}
  for id, row in pairs(PLEDGE_BY_ID) do
    local n = questNameFromId(id)
    if n ~= "" then PLEDGE_BY_NAME[n:lower()] = row end
  end
end

-- WPamA: giver is dungeon → NPC from the pledge quest id, never the interact unit.
local function matchPledge(questName, journalIndex, questId)
  questId = journalQuestId(journalIndex, questId)
  if questId and PLEDGE_BY_ID[questId] then
    local row = PLEDGE_BY_ID[questId]
    return row.giver, row.dungeon, questId
  end
  ensurePledgeNameMap()
  local name = cleanQuestName(questName)
  if name ~= "" and PLEDGE_BY_NAME[name:lower()] then
    local row = PLEDGE_BY_NAME[name:lower()]
    return row.giver, row.dungeon, questId
  end
  if not name or name == "" then return nil, nil, questId end
  local dungeon = tostring(name):gsub("^Pledge:%s*", ""):gsub("^pledge:%s*", "")
  dungeon = dungeon:match("^%s*(.-)%s*$") or dungeon
  local giver = PLEDGE_BY_DUNGEON[normDungeon(dungeon)]
  if not giver then return nil, dungeon, questId end
  return giver, dungeon, questId
end

local function pledgeStepReady(journalIndex)
  if not journalIndex or not GetJournalQuestInfo then return false end
  local packed = { pcall(GetJournalQuestInfo, journalIndex) }
  if not packed[1] then return false end
  for i = 2, #packed do
    if type(packed[i]) == "string" and packed[i] ~= "" then
      local text = packed[i]
      if text:find("Return to", 1, true) or text:find("Talk to", 1, true)
        or text:find("return to", 1, true) or text:find("talk to", 1, true) then
        return true
      end
    end
  end
  return false
end

-- Undaunted pledges do not write "Hard Mode" on the Death Challenge. Live
-- journal shape (UESP / in-game): required "Kill <boss>", hidden "Enter
-- <dungeon> in Veteran Mode", optional Death Challenge (Scroll / altar / …)
-- which only appears after you enter Veteran. Incomplete optionals are not
-- unfinished combat — treating them as such left every Normal clear as a
-- blank check. Mirror of src/lib/dailies/pledge-objectives.ts.
local function journalPledgeObjectives(journalIndex)
  local difficulty, hardMode = nil, nil
  local requiredDone, requiredOpen = false, false
  local sawVeteran, veteranDone = false, false
  local sawHm, hmDone = false, false
  if not journalIndex or not GetJournalQuestConditionInfo then
    return difficulty, hardMode, false
  end
  local numSteps = safe(function()
    return GetJournalQuestNumSteps and GetJournalQuestNumSteps(journalIndex)
  end, 0) or 0
  if type(numSteps) ~= "number" or numSteps < 1 then numSteps = 4 end

  for step = 1, numSteps do
    local stepText, visibility, numCond = "", nil, nil
    if GetJournalQuestStepInfo then
      local packed = { pcall(GetJournalQuestStepInfo, journalIndex, step) }
      if packed[1] then
        if type(packed[2]) == "string" then stepText = packed[2] end
        visibility = packed[3]
        if type(packed[6]) == "number" then numCond = packed[6] end
      end
    end
    local stepLower = stepText:lower()
    local optionalStep = stepLower:find("optional", 1, true)
      or (QUEST_STEP_VISIBILITY_HINT ~= nil and visibility == QUEST_STEP_VISIBILITY_HINT)
    local hiddenStep = stepLower:find("hidden", 1, true)
      or stepLower:find("veteran mode", 1, true)
      or (QUEST_STEP_VISIBILITY_HIDDEN ~= nil and visibility == QUEST_STEP_VISIBILITY_HIDDEN)

    if type(numCond) ~= "number" or numCond < 1 then
      numCond = safe(function()
        return GetJournalQuestNumConditions and GetJournalQuestNumConditions(journalIndex, step)
      end, 8) or 8
    end
    if type(numCond) ~= "number" or numCond < 1 then numCond = 8 end

    for cond = 1, numCond do
      local packed = { pcall(GetJournalQuestConditionInfo, journalIndex, step, cond) }
      if packed[1] and type(packed[2]) == "string" and packed[2] ~= "" then
        local text = packed[2]:lower()
        local current, maxv, isComplete, isVisible = packed[3], packed[4], packed[6], packed[8]
        local done = isComplete == true
          or (type(current) == "number" and type(maxv) == "number" and maxv > 0 and current >= maxv)
        local turnIn = text:find("return", 1, true) or text:find("talk to", 1, true)
        local hidden = hiddenStep or isVisible == false
        local isVet = text:find("veteran", 1, true) or stepLower:find("veteran", 1, true)
        local isHm = (not isVet) and (
          text:find("hard mode", 1, true) or text:find("hardmode", 1, true)
          or text:find("glorious battle", 1, true)
          or optionalStep
        )
        if turnIn then
          -- Turn-in step. Not a mode signal.
        elseif isVet then
          sawVeteran = true
          if done then veteranDone = true end
        elseif isHm then
          sawHm = true
          if done then hmDone = true end
        elseif hidden then
          -- Other hidden rows are not required combat.
        elseif done then
          requiredDone = true
        else
          requiredOpen = true
        end
      end
    end
  end

  local questComplete = safe(function()
    return GetJournalQuestIsComplete and GetJournalQuestIsComplete(journalIndex)
  end, false)
  local ready = questComplete == true or (requiredDone and not requiredOpen)

  if hmDone then
    difficulty = "veteran"
    hardMode = true
  elseif veteranDone or sawHm then
    -- Death Challenge only appears after entering Veteran.
    difficulty = "veteran"
    hardMode = false
  elseif ready and not veteranDone and not sawHm and (sawVeteran or requiredDone) then
    difficulty = "normal"
    hardMode = false
  end
  return difficulty, hardMode, ready
end

-- Journal writs sometimes have a blank name / QUEST_TYPE_NONE. Craft type from
-- the condition is the in-game truth (same path Lazy Writ Crafter uses).
local function journalWritCraft(journalIndex)
  if GetQuestConditionItemInfo then
    for step = 1, 2 do
      for cond = 1, 6 do
        local packed = { pcall(GetQuestConditionItemInfo, journalIndex, step, cond) }
        if packed[1] then
          local craftType = packed[4] or packed[3]
          if type(craftType) == "number" and CRAFT_BY_TYPE[craftType] then
            return CRAFT_BY_TYPE[craftType]
          end
        end
      end
    end
  end
  return nil
end

local function flagWrit(questName, status, journalIndex, questId)
  questId = journalQuestId(journalIndex, questId)
  local craft = journalIndex and journalWritCraft(journalIndex) or nil
  if not craft then
    local def = matchWrit(questName, questId)
    craft = def and def.craft or nil
  end
  if not craft then return end
  local bucket = ensureDailyBucket(currentCharId())
  if not bucket then return end
  if status == "cleared" then
    if bucket.writs[craft] ~= "done" then bucket.writs[craft] = nil end
    return
  end
  if status == "done" or bucket.writs[craft] ~= "done" then
    bucket.writs[craft] = status
  end
end

local WORLD_BOSS_BY_NAME = nil
local function ensureWorldBossNameMap()
  if WORLD_BOSS_BY_NAME then return end
  WORLD_BOSS_BY_NAME = {}
  for id, zone in pairs(WORLD_BOSS_BY_ID) do
    local n = questNameFromId(id)
    if n ~= "" then WORLD_BOSS_BY_NAME[n:lower()] = { zone = zone, questId = id } end
  end
end

local function flagWorldBoss(questName, status, journalIndex, questId)
  questId = journalQuestId(journalIndex, questId)
  local zone = questId and WORLD_BOSS_BY_ID[questId] or nil
  if not zone then
    ensureWorldBossNameMap()
    local row = WORLD_BOSS_BY_NAME[tostring(cleanQuestName(questName) or ""):lower()]
    if row then
      zone = row.zone
      questId = row.questId
    end
  end
  if not zone or not questId then return end
  local bucket = ensureDailyBucket(currentCharId())
  if not bucket then return end
  bucket.worldBosses = bucket.worldBosses or {}
  local name = cleanQuestName(questName)
  if name == "" then name = questNameFromId(questId) end
  local prev = bucket.worldBosses[tostring(questId)]
  if status == "cleared" then
    if prev and prev.status ~= "done" then bucket.worldBosses[tostring(questId)] = nil end
    return
  end
  if prev and prev.status == "done" and status ~= "done" then return end
  bucket.worldBosses[tostring(questId)] = {
    zone = zone,
    questId = questId,
    name = name,
    status = status,
  }
end

-- Instance APIs only while the player is in a dungeon. Journal hidden /
-- optional steps are the source of truth in town; this is the in-dungeon backup.
local function instancePledgeMode()
  local difficulty = nil
  local hardMode = nil
  local zoneDiff = safe(function()
    if GetCurrentZoneDungeonDifficulty then return GetCurrentZoneDungeonDifficulty() end
  end, nil)
  if DUNGEON_DIFFICULTY_VETERAN and zoneDiff == DUNGEON_DIFFICULTY_VETERAN then
    difficulty = "veteran"
  elseif DUNGEON_DIFFICULTY_NORMAL and zoneDiff == DUNGEON_DIFFICULTY_NORMAL then
    difficulty = "normal"
  end

  -- Raid revive counters are a trial signal; only treat them as HM on Veteran.
  if difficulty == "veteran" then
    local starting = safe(function()
      if GetCurrentRaidStartingReviveCounters then return GetCurrentRaidStartingReviveCounters() end
    end, nil)
    if type(starting) == "number" and starting > 0 then hardMode = true end
  end

  if hardMode ~= true and difficulty == "veteran" then
    for _, tag in ipairs({ "boss1", "reticleover" }) do
      local d = safe(function()
        if GetUnitDifficulty then return GetUnitDifficulty(tag) end
      end, nil)
      if d ~= nil and MONSTER_DIFFICULTY_DEADLY ~= nil and d >= MONSTER_DIFFICULTY_DEADLY then
        hardMode = true
        break
      end
    end
  end

  if hardMode == nil and difficulty == "normal" then hardMode = false end
  if hardMode == true then difficulty = difficulty or "veteran" end
  return difficulty, hardMode
end

-- Never downgrade Veteran → Normal or HM → not-HM. A later town scan that
-- only sees "Return to …" must not erase the mode we stamped in the dungeon.
local function mergePledgeMode(prev, dungeon, status, difficulty, hardMode)
  local row = { status = status, dungeon = dungeon }
  if prev then
    if not dungeon or dungeon == "" then row.dungeon = prev.dungeon end
    row.difficulty = prev.difficulty
    row.hardMode = prev.hardMode
  end
  if difficulty == "veteran" then
    row.difficulty = "veteran"
  elseif difficulty == "normal" and row.difficulty ~= "veteran" then
    row.difficulty = "normal"
  end
  if hardMode == true then
    row.hardMode = true
    row.difficulty = "veteran"
  elseif hardMode == false and row.hardMode ~= true then
    row.hardMode = false
  end
  return row
end

local function zoneMatchesPledge(dungeon)
  if not dungeon or dungeon == "" then return false end
  local zone = cleanQuestName(safe(function()
    if GetUnitZone then return GetUnitZone("player") end
  end, ""))
  if zone == "" then
    zone = cleanQuestName(safe(function()
      if GetMapName then return GetMapName() end
    end, ""))
  end
  if zone == "" then return false end
  local a, b = normDungeon(zone), normDungeon(dungeon)
  if a == "" or b == "" then return false end
  if a == b or a:find(b, 1, true) or b:find(a, 1, true) then return true end
  -- "The Banished Cells" map vs "Banished Cells II" pledge.
  local function base(s)
    return (s:gsub("%s+iii$", ""):gsub("%s+ii$", ""):gsub("%s+iv$", ""):gsub("%s+i$", ""))
  end
  local ab, bb = base(a), base(b)
  return ab ~= "" and ab == bb
end

local function readPledgeMode(journalIndex, dungeon)
  local jDiff, jHM, ready = journalPledgeObjectives(journalIndex)
  local iDiff, iHM = nil, nil
  if zoneMatchesPledge(dungeon) then
    iDiff, iHM = instancePledgeMode()
  end
  local difficulty = jDiff or iDiff
  local hardMode = nil
  if jHM == true or iHM == true then
    hardMode = true
  elseif jHM == false or iHM == false then
    hardMode = false
  end
  if hardMode == true then difficulty = "veteran" end
  return difficulty, hardMode, ready
end

local function flagPledge(questName, status, journalIndex, questId)
  local giver, dungeon = matchPledge(questName, journalIndex, questId)
  if not giver then return end
  local bucket = ensureDailyBucket(currentCharId())
  if not bucket then return end
  local difficulty, hardMode, ready = readPledgeMode(journalIndex, dungeon)
  if (ready or pledgeStepReady(journalIndex)) and (status == "accepted" or status == nil) then
    status = "ready"
  end
  if status == "cleared" then
    local prev = bucket.pledges[giver]
    if prev and prev.status ~= "done" then bucket.pledges[giver] = nil end
    return
  end
  local prev = bucket.pledges[giver]
  if prev and prev.status == "ready" and status == "accepted" then status = "ready" end
  local row = mergePledgeMode(prev, dungeon, status, difficulty, hardMode)
  if status == "done" or not prev or prev.status ~= "done" then
    bucket.pledges[giver] = row
  elseif prev then
    -- Keep a later hard-mode stamp even after the quest already left as done.
    if row.hardMode == true or (row.difficulty and not prev.difficulty) then
      prev.dungeon = row.dungeon or prev.dungeon
      prev.difficulty = row.difficulty or prev.difficulty
      if row.hardMode == true then prev.hardMode = true end
      bucket.pledges[giver] = prev
    end
  end
end

-- Tiny flag writes only. Safe in combat so a turn-in mid-fight is not lost.
local function onQuestComplete(_, questName, _level, _prevXp, _xp, _cp, questType)
  safe(function()
    local name = cleanQuestName(questName)
    if name == "" then return end
    local isWrit = (QUEST_TYPE_CRAFTING ~= nil and questType == QUEST_TYPE_CRAFTING) or matchWrit(name)
    local isPledge = (QUEST_TYPE_UNDAUNTED_PLEDGE ~= nil and questType == QUEST_TYPE_UNDAUNTED_PLEDGE)
      or name:lower():find("pledge", 1, true)
    if isWrit then flagWrit(name, "done") end
    if isPledge then flagPledge(name, "done") end
    flagWorldBoss(name, "done")
  end)
end

-- WPamA: REMOVED + isCompleted = Done; REMOVED without complete = wipe ACT.
local function onQuestRemoved(_, isCompleted, journalIndex, questName, _zone, _poi, questId)
  safe(function()
    local name = cleanQuestName(questName)
    if name == "" and journalIndex then
      name = cleanQuestName(safe(function() return GetJournalQuestName(journalIndex) end, ""))
    end
    questId = journalQuestId(journalIndex, questId)
    if isCompleted then
      flagWrit(name, "done", journalIndex, questId)
      if name ~= "" then flagPledge(name, "done", journalIndex, questId) end
      flagWorldBoss(name, "done", journalIndex, questId)
    else
      flagWrit(name, "cleared", journalIndex, questId)
      if name ~= "" then flagPledge(name, "cleared", journalIndex, questId) end
      flagWorldBoss(name, "cleared", journalIndex, questId)
    end
  end)
end

local function onQuestAdded(_, journalIndex, questName, _objective, questId)
  safe(function()
    local name = cleanQuestName(questName)
    questId = journalQuestId(journalIndex, questId)
    flagWrit(name, "accepted", journalIndex, questId)
    if name ~= "" then flagPledge(name, "accepted", journalIndex, questId) end
    flagWorldBoss(name, "accepted", journalIndex, questId)
  end)
end

-- Stamp mode on every pledge condition change — not only when the quest is
-- "complete" (that stays false until the Undaunted turn-in).
local function onQuestCondition(_, journalIndex, questName)
  safe(function()
    if not journalIndex then return end
    local name = cleanQuestName(questName)
    if name == "" then
      name = cleanQuestName(safe(function() return GetJournalQuestName(journalIndex) end, ""))
    end
    if name == "" then return end
    local questId = journalQuestId(journalIndex)
    local qtype = safe(function() return GetJournalQuestType(journalIndex) end, nil)
    local isPledge = (QUEST_TYPE_UNDAUNTED_PLEDGE ~= nil and qtype == QUEST_TYPE_UNDAUNTED_PLEDGE)
      or (questId and PLEDGE_BY_ID[questId])
      or name:lower():find("pledge", 1, true)
    if not isPledge then return end
    local _, _, ready = journalPledgeObjectives(journalIndex)
    if pledgeStepReady(journalIndex) then ready = true end
    flagPledge(name, ready and "ready" or "accepted", journalIndex, questId)
  end)
end

local function onQuestAdvanced(_, journalIndex, questName)
  onQuestCondition(_, journalIndex, questName)
end

local function lfgRemaining()
  if not GetLFGCooldownTimeRemainingSeconds then return 0 end
  local types = {
    LFG_COOLDOWN_DUNGEON_REWARD_GRANTED,
    LFG_COOLDOWN_ACTIVITY_STARTED,
  }
  for _, t in ipairs(types) do
    if t ~= nil then
      local n = safe(function() return GetLFGCooldownTimeRemainingSeconds(t) end, 0)
      if type(n) == "number" and n > 0 then return math.floor(n) end
    end
  end
  return 0
end

local function randomStatus(activityType)
  if not activityType or not IsActivityEligibleForDailyReward then
    return { status = "unknown" }
  end
  local eligible = safe(function() return IsActivityEligibleForDailyReward(activityType) end, nil)
  if eligible == nil then return { status = "unknown" } end
  if eligible then return { status = "available" } end
  local remain = lfgRemaining()
  if remain > 0 then
    return { status = "cooldown", remainingSeconds = remain }
  end
  return { status = "done" }
end

local function gatherDailies(charId)
  local now = GetTimeStamp()
  local bucket = ensureDailyBucket(charId)
  local writStatus = {}
  local pledgeStatus = {}
  local pledgesInJournal = {}
  local worldBosses = {}
  local bossesInJournal = {}
  if bucket then
    for craft, status in pairs(bucket.writs or {}) do
      if status == "done" then writStatus[craft] = status end
    end
    -- WPamA FindUpdateQuests: wipe ACT unless Completed today. Rebuild from journal.
    for giver, info in pairs(bucket.pledges or {}) do
      if type(info) == "table" and info.status == "done" then
        pledgeStatus[giver] = info
      end
    end
    for key, info in pairs(bucket.worldBosses or {}) do
      if type(info) == "table" and info.status == "done" then
        worldBosses[key] = info
      end
    end
  end

  safe(function()
    local n = GetNumJournalQuests and GetNumJournalQuests() or 0
    for i = 1, n do
      local name = cleanQuestName(safe(function() return GetJournalQuestName(i) end, ""))
      local qtype = safe(function() return GetJournalQuestType(i) end, nil)
      local questId = journalQuestId(i)
      local repeatType = safe(function()
        return GetJournalQuestRepeatType and GetJournalQuestRepeatType(i)
      end, nil)
      local complete = safe(function()
        return GetJournalQuestIsComplete and GetJournalQuestIsComplete(i)
      end, false)
      local status = (complete or pledgeStepReady(i)) and "ready" or "accepted"
      local craft = journalWritCraft(i)
      local def = matchWrit(name, questId)
      local daily = (QUEST_REPEAT_DAILY == nil) or (repeatType == QUEST_REPEAT_DAILY) or (repeatType == nil)
      if daily and (craft or def or (QUEST_TYPE_CRAFTING ~= nil and qtype == QUEST_TYPE_CRAFTING)) then
        local key = craft or (def and def.craft)
        if key and writStatus[key] ~= "done" then
          writStatus[key] = status
        end
      end
      local isPledge = (questId and PLEDGE_BY_ID[questId])
        or (QUEST_TYPE_UNDAUNTED_PLEDGE ~= nil and qtype == QUEST_TYPE_UNDAUNTED_PLEDGE)
        or (name ~= "" and name:lower():find("pledge", 1, true))
      if isPledge then
        local giver, dungeon = matchPledge(name, i, questId)
        if giver then
          local difficulty, hardMode, ready = readPledgeMode(i, dungeon)
          if ready or pledgeStepReady(i) then status = "ready" end
          pledgesInJournal[giver] = true
          local prev = pledgeStatus[giver]
          if not prev or prev.status ~= "done" then
            pledgeStatus[giver] = mergePledgeMode(prev, dungeon, status, difficulty, hardMode)
          else
            pledgeStatus[giver] = mergePledgeMode(prev, prev.dungeon or dungeon, prev.status, difficulty, hardMode)
          end
          if bucket then bucket.pledges[giver] = pledgeStatus[giver] end
        end
      end
      if questId and WORLD_BOSS_BY_ID[questId] then
        local zone = WORLD_BOSS_BY_ID[questId]
        local key = tostring(questId)
        bossesInJournal[key] = true
        if not worldBosses[key] or worldBosses[key].status ~= "done" then
          worldBosses[key] = {
            zone = zone,
            questId = questId,
            name = name ~= "" and name or questNameFromId(questId),
            status = status,
          }
          if bucket then
            bucket.worldBosses = bucket.worldBosses or {}
            bucket.worldBosses[key] = worldBosses[key]
          end
        end
      end
    end
  end)

  if bucket then
    for giver, info in pairs(bucket.pledges or {}) do
      if type(info) == "table" and info.status ~= "done" and not pledgesInJournal[giver] then
        bucket.pledges[giver] = nil
      end
    end
    for key, info in pairs(bucket.worldBosses or {}) do
      if type(info) == "table" and info.status ~= "done" and not bossesInJournal[key] then
        bucket.worldBosses[key] = nil
      end
    end
  end

  -- Not in the journal and no turn-in flag ≠ available. The game does not
  -- expose "this daily was already completed today" after the quest leaves
  -- the journal — inventing available is how the board filled with dashes.
  local writs = {}
  for _, def in ipairs(WRIT_DEFS) do
    writs[#writs + 1] = {
      craft = def.craft,
      name = def.name,
      status = writStatus[def.craft] or "unknown",
    }
  end

  local pledges = {}
  for _, giver in ipairs(PLEDGE_ORDER) do
    local info = pledgeStatus[giver]
    local inJournal = pledgesInJournal[giver] == true
    local status = (info and info.status) or "unknown"
    if status == "accepted" and not inJournal then status = "unknown" end
    pledges[#pledges + 1] = {
      giver = giver,
      giverName = PLEDGE_GIVER_NAMES[giver],
      dungeon = info and info.dungeon or nil,
      status = status,
      difficulty = info and info.difficulty or nil,
      hardMode = info and info.hardMode,
      inJournal = inJournal,
    }
  end

  local worldBossList = {}
  for _, info in pairs(worldBosses) do
    worldBossList[#worldBossList + 1] = {
      zone = info.zone,
      questId = info.questId,
      name = info.name or "",
      status = info.status or "unknown",
    }
  end

  return {
    dayKey = esoDayKey(now),
    resetAt = nextResetAt(now),
    capturedAt = now,
    randomNormal = randomStatus(LFG_ACTIVITY_DUNGEON),
    randomVeteran = randomStatus(LFG_ACTIVITY_MASTER_DUNGEON),
    writs = writs,
    pledges = pledges,
    worldBosses = worldBossList,
  }
end

----------------------------------------------------------------------
-- Houses: unlocked house collectibles (ownership only — not house banks)
----------------------------------------------------------------------

local function houseLocation(collectibleId, houseId)
  local loc = safe(function()
    if houseId and houseId > 0 and GetHouseFoundInZoneId and GetZoneNameById then
      local zoneId = GetHouseFoundInZoneId(houseId)
      if zoneId and zoneId > 0 then
        local name = zo_strformat("<<1>>", GetZoneNameById(zoneId))
        if name and name ~= "" then return name end
      end
    end
    return nil
  end, nil)
  if loc then return loc end
  return safe(function()
    if GetCollectibleHint then
      local hint = GetCollectibleHint(collectibleId)
      if hint and hint ~= "" then
        local cleaned = zo_strformat("<<1>>", hint)
        if cleaned and #cleaned < 80 then return cleaned end
      end
    end
    return nil
  end, nil)
end

local function gatherHouses()
  local out = {}
  safe(function()
    if not COLLECTIBLE_CATEGORY_TYPE_HOUSE then return end
    if not GetTotalCollectiblesByCategoryType or not GetCollectibleIdFromType then return end
    local n = GetTotalCollectiblesByCategoryType(COLLECTIBLE_CATEGORY_TYPE_HOUSE)
    if type(n) ~= "number" or n < 1 then return end
    local primaryHouseId = safe(function()
      return GetHousingPrimaryHouse and GetHousingPrimaryHouse()
    end, nil)
    for i = 1, n do
      local id = safe(function() return GetCollectibleIdFromType(COLLECTIBLE_CATEGORY_TYPE_HOUSE, i) end, nil)
      if id and id > 0 then
        local unlocked = safe(function() return IsCollectibleUnlocked(id) end, false)
        if unlocked then
          local houseId = safe(function()
            return GetCollectibleReferenceId and GetCollectibleReferenceId(id)
          end, nil)
          out[#out + 1] = {
            collectibleId = id,
            houseId = houseId,
            name = safe(function() return zo_strformat("<<1>>", GetCollectibleName(id)) end, "House"),
            location = houseLocation(id, houseId),
            icon = safe(function() return normIcon(GetCollectibleIcon(id)) end, nil),
            primary = primaryHouseId ~= nil and houseId ~= nil and houseId == primaryHouseId,
          }
        end
      end
    end
  end)
  return out
end

local function gatherCharacter()
  local name = safe(function() return zo_strformat("<<1>>", GetUnitName("player")) end, "Unknown")
  local vampire, werewolf = gatherCurse()
  local level = safe(function() return GetUnitLevel("player") end, 1)
  local charId = safe(function() return zo_strformat("<<1>>", GetCurrentCharacterId()) end, name)
  local classMasteries = {}
  local classMasteryState = { unlocked = false }
  local skillLines = gatherSkills(classMasteries, classMasteryState)
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
    classMastery = classMasteryState.unlocked == true,
    classMasteries = classMasteries,
    skillLines = skillLines,
    champion = gatherChampion(),
    equipped = gatherEquipped(),
    companions = {},
    scribingScripts = gatherScribingScripts(),
    research = {},
    lastSeen = GetTimeStamp(),
    gold = safe(function() return GetCurrencyAmount(CURT_MONEY, CURRENCY_LOCATION_CHARACTER) end, 0),
    telVar = safe(function() return GetCurrencyAmount(CURT_TELVAR_STONES, CURRENCY_LOCATION_CHARACTER) end, 0),
    alliancePoints = safe(function() return GetCurrencyAmount(CURT_ALLIANCE_POINTS, CURRENCY_LOCATION_CHARACTER) end, 0),
    dailies = safe(function() return gatherDailies(charId) end, nil),
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

-- Strip color/grammar markers without zo_strformat("<<1>>"), which singularizes
-- "^pAlliance Points" into "Alliance Point" and used to write a second key.
local function cleanCurrencyName(raw)
  if not raw or raw == "" then return nil end
  local name = raw:gsub("|c%x%x%x%x%x%x%x%x", ""):gsub("|r", ""):gsub("%^%a", "")
  name = name:match("^%s*(.-)%s*$")
  if not name or name == "" then return nil end
  return name
end

local function currencyKeyFromName(name)
  if not name or name == "" then return nil end
  local lower = name:lower()
  local known = {
    ["alliance points"] = "alliancePoints",
    ["alliance point"] = "alliancePoints",
    ["archival fortunes"] = "archivalFortunes",
    ["archival fortune"] = "archivalFortunes",
    ["caches of tome points"] = "cachesOfTomePoints",
    ["cache of tome points"] = "cachesOfTomePoints",
    ["crown gems"] = "crownGems",
    ["crown gem"] = "crownGems",
    ["crowns"] = "crowns",
    ["crown"] = "crowns",
    ["imperial fragments"] = "imperialFragments",
    ["imperial fragment"] = "imperialFragments",
    ["outfit change tokens"] = "outfitChangeTokens",
    ["outfit change token"] = "outfitChangeTokens",
    ["style stones"] = "outfitChangeTokens",
    ["style stone"] = "outfitChangeTokens",
    ["premium tome tokens"] = "premiumTomeTokens",
    ["premium tome token"] = "premiumTomeTokens",
    ["seals"] = "seals",
    ["seal"] = "seals",
    ["seals of endeavor"] = "seals",
    ["seal of endeavor"] = "seals",
    ["tome points"] = "tomePoints",
    ["tome point"] = "tomePoints",
    ["trade bars"] = "tradeBars",
    ["trade bar"] = "tradeBars",
    ["transmute crystals"] = "transmuteCrystals",
    ["transmute crystal"] = "transmuteCrystals",
    ["chaotic creatia"] = "transmuteCrystals",
    ["undaunted keys"] = "undauntedKeys",
    ["undaunted key"] = "undauntedKeys",
    ["writ vouchers"] = "writVouchers",
    ["writ voucher"] = "writVouchers",
    ["event tickets"] = "eventTickets",
    ["event ticket"] = "eventTickets",
  }
  if known[lower] then return known[lower] end
  -- Skip character-bound / gold — those live on the character and gold table.
  if lower == "gold" or lower == "money" or lower == "tel var stones" or lower == "tel var"
    or lower == "alliance points" or lower == "alliance point" then
    return nil
  end
  local parts = {}
  for w in name:gmatch("%S+") do
    local clean = w:gsub("[^%w]", "")
    if clean ~= "" then parts[#parts + 1] = clean end
  end
  if #parts == 0 then return nil end
  local key = parts[1]:lower()
  for i = 2, #parts do
    local w = parts[i]
    key = key .. w:sub(1, 1):upper() .. w:sub(2):lower()
  end
  return key
end

-- AP (and gold / Tel Var) are character-bound. Never store them on the account
-- wallet as "whoever logged out last".
local CHARACTER_ONLY_CURRENCY_KEYS = {
  alliancePoints = true,
  alliancePoint = true,
  gold = true,
  telVar = true,
}

local function accountCurrencyAmount(curt)
  if not curt then return 0 end
  if CURRENCY_LOCATION_ACCOUNT and DoesCurrencyLocationHaveCurrencyType
    and DoesCurrencyLocationHaveCurrencyType(CURRENCY_LOCATION_ACCOUNT, curt) then
    return GetCurrencyAmount(curt, CURRENCY_LOCATION_ACCOUNT) or 0
  end
  -- Character-only types are gathered on the toon, not here.
  if CURRENCY_LOCATION_CHARACTER and DoesCurrencyLocationHaveCurrencyType
    and DoesCurrencyLocationHaveCurrencyType(CURRENCY_LOCATION_CHARACTER, curt)
    and not DoesCurrencyLocationHaveCurrencyType(CURRENCY_LOCATION_ACCOUNT, curt) then
    return nil
  end
  return GetCurrencyAmount(curt, CURRENCY_LOCATION_ACCOUNT) or 0
end

local function gatherCurrencies()
  local out = {
    bankGold = safe(function() return GetCurrencyAmount(CURT_MONEY, CURRENCY_LOCATION_BANK) end, 0),
  }
  local seenTypes = {}

  local function put(key, amount)
    if not key or CHARACTER_ONLY_CURRENCY_KEYS[key] then return end
    amount = type(amount) == "number" and amount or 0
    -- Upgrade a named-constant 0 when the live iterator finds the real amount.
    if out[key] == nil or (out[key] == 0 and amount > 0) then
      out[key] = amount
    end
  end

  -- Named constants first so keys stay stable across patches.
  local named = {
    { "transmuteCrystals",  function() return CURT_CHAOTIC_CREATIA end },
    { "writVouchers",       function() return CURT_WRIT_VOUCHERS end },
    { "eventTickets",       function() return CURT_EVENT_TICKETS end },
    { "tradeBars",          function() return CURT_TRADE_BARS end },
    { "undauntedKeys",      function() return CURT_UNDAUNTED_KEYS end },
    { "crowns",             function() return CURT_CROWNS end },
    { "crownGems",          function() return CURT_CROWN_GEMS end },
    { "seals",              function() return CURT_ENDEAVOR_SEALS end },
    { "outfitChangeTokens", function() return CURT_STYLE_STONES end },
    { "archivalFortunes",   function() return CURT_ARCHIVAL_FORTUNES end },
    { "imperialFragments",  function() return CURT_IMPERIAL_FRAGMENTS end },
    { "tomePoints",         function() return CURT_TOME_POINTS end },
    { "premiumTomeTokens",  function() return CURT_PREMIUM_TOME_TOKENS end },
    { "cachesOfTomePoints", function() return CURT_TOME_POINT_CACHES or CURT_CACHES_OF_TOME_POINTS end },
  }
  for _, row in ipairs(named) do
    local key, curtFn = row[1], row[2]
    local curt = safe(curtFn, nil)
    if type(curt) == "number" then
      seenTypes[curt] = true
      local amount = safe(function() return accountCurrencyAmount(curt) end, 0)
      if amount ~= nil then put(key, amount) end
    end
  end

  -- Catch anything the live patch added that we don't have a constant for.
  safe(function()
    local beginT = CURRENCY_TYPE_ITERATION_BEGIN or 1
    local endT = CURRENCY_TYPE_ITERATION_END or 40
    for t = beginT, endT do
      if t ~= (CURT_NONE or 0) and t ~= CURT_MONEY and t ~= CURT_TELVAR_STONES and t ~= CURT_ALLIANCE_POINTS then
        if not seenTypes[t] then
          local raw = safe(function()
            return GetCurrencyName and (GetCurrencyName(t, true) or GetCurrencyName(t, false)) or nil
          end, nil)
          local key = currencyKeyFromName(cleanCurrencyName(raw) or "")
          if key then
            local amount = safe(function() return accountCurrencyAmount(t) end, 0)
            if amount ~= nil then put(key, amount) end
          end
          seenTypes[t] = true
        end
      end
    end
  end)

  return out
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
  sv.houses = gatherHouses()

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
    houses = {},
    dailyFlags = {},
  })

  -- Do not use EVENT_PLAYER_ACTIVATED: its `initial` flag is true on login *and*
  -- on every zone/instance load screen, which is exactly the hitch we must avoid.
  hookUnload("ReloadUI", "reloadui")
  hookUnload("Logout", "logout")
  hookUnload("Quit", "quit")

  -- Flag-only: a completed writ/pledge must survive leaving the journal.
  -- Writes a table entry; never scans bags or snapshots. Allowed in combat.
  EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_QUEST_COMPLETE, onQuestComplete)
  EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_QUEST_REMOVED, onQuestRemoved)
  EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_QUEST_ADDED, onQuestAdded)
  if EVENT_QUEST_CONDITION_COUNTER_CHANGED then
    EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_QUEST_CONDITION_COUNTER_CHANGED, onQuestCondition)
  end
  if EVENT_QUEST_ADVANCED then
    EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_QUEST_ADVANCED, onQuestAdvanced)
  end

  SLASH_COMMANDS["/nirnside"] = function() safe(function() takeSnapshot("manual") end) end
end

EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED, onAddOnLoaded)
