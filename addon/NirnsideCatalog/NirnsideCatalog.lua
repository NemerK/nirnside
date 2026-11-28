--[[
  Nirnside Catalog
  ================
  OPT-IN scanner that exports the live, in-game catalog (the authoritative,
  in-game-verified source) for the Nirnside encyclopedia. Design rules
  (see .cursor/rules/nirnside.mdc):

    * OPT-IN ONLY. Runs solely via the manual /nirncatalog command. There is no
      automatic trigger, no login hook, no timer.
    * NEVER during combat, and intended to be run while AFK (it walks large game
      tables). Refuses to run in combat.
    * NEVER throws: every step is pcall-guarded, so a bad API degrades to empty.
    * Reads only. Writes NirnsideCatalog SavedVariables, which the app imports
      and treats as source = "ingame" (overrides bundled reference data field by
      field; fields it cannot fill keep the reference values).

  Output shape matches CatalogBundle in src/lib/catalog/schema.ts.
]]--

local ADDON_NAME = "NirnsideCatalog"
local sv

local function packReturns(...)
  return { n = select("#", ...), ... }
end

-- Keep every return. Set info and bonus lines are later returns; a single
-- `local ok, result = pcall(fn)` would drop them.
local function safe(fn, fallback)
  local packed = packReturns(pcall(fn))
  if not packed[1] then return fallback end
  return unpack(packed, 2, packed.n)
end

-- The game's own bonus lines for one set, from its first collection piece.
local function setBonusesFromId(setId)
  if not GetItemLinkSetBonusInfo or not GetItemSetCollectionPieceInfo then return nil, nil end
  if not GetItemSetCollectionPieceItemLink then return nil, nil end
  local pieceId = safe(function() return GetItemSetCollectionPieceInfo(setId, 1) end, nil)
  if not pieceId then return nil, nil end
  local link = safe(function() return GetItemSetCollectionPieceItemLink(pieceId, LINK_STYLE_DEFAULT) end, nil)
  if not link or link == "" then
    link = safe(function() return GetItemSetCollectionPieceItemLink(pieceId) end, nil)
  end
  if not link or link == "" then return nil, nil end
  local hasSet, _, numBonuses, _, maxEquipped = safe(function()
    return GetItemLinkSetInfo(link, false)
  end, false)
  if not hasSet then return nil, nil end
  local bonuses = {}
  for i = 1, (tonumber(numBonuses) or 0) do
    -- The third return marks the perfected line, which only perfected pieces count toward.
    local numRequired, description, isPerfected = safe(function()
      return GetItemLinkSetBonusInfo(link, false, i)
    end, nil)
    if type(description) == "string" and description ~= "" then
      description = zo_strformat("<<1>>", description)
      local pieces = tonumber(numRequired) or i
      if pieces < 1 then pieces = i end
      if pieces > 12 then pieces = 12 end
      if description ~= "" then
        bonuses[#bonuses + 1] = { pieces = pieces, text = description, perfected = isPerfected == true or nil }
      end
    end
  end
  local maxEquip = tonumber(maxEquipped)
  if not maxEquip or maxEquip < 1 or maxEquip > 12 then maxEquip = nil end
  if #bonuses == 0 then bonuses = nil end
  return bonuses, maxEquip
end

local function slug(s)
  s = zo_strformat("<<1>>", s or "")
  s = s:lower():gsub("[^%w]+", "-"):gsub("^-+", ""):gsub("-+$", "")
  return s
end

-- Skill-line ids in the seed drop apostrophes (line-dawns-wrath). The general
-- slug keeps them as hyphens, which would file a second copy with no class.
local function lineSlug(s)
  s = zo_strformat("<<1>>", s or "")
  s = s:gsub("['’]", "")
  return slug(s)
end

-- Normalize an in-game .dds texture path to the plain path the app resolves
-- against the icon CDN (e.g. "/esoui/art/icons/ability_x.dds").
local function normIcon(path)
  if not path or path == "" then return nil end
  path = path:gsub("\\", "/")
  return path
end

----------------------------------------------------------------------
-- Champion Points (accurate: names, descriptions, type, max points)
----------------------------------------------------------------------
local function gatherCP()
  local out = {}
  safe(function()
    local numDisc = GetNumChampionDisciplines()
    for d = 1, numDisc do
      local discId = GetChampionDisciplineId(d)
      local discName = zo_strformat("<<1>>", GetChampionDisciplineName(discId))
      local numSkills = GetNumChampionDisciplineSkills(discId)
      for s = 1, numSkills do
        local skillId = GetChampionSkillId(discId, s)
        local name = safe(function() return zo_strformat("<<1>>", GetChampionSkillName(skillId)) end, nil)
        if name and name ~= "" then
          local slottable = safe(function()
            return GetChampionSkillType(skillId) == CHAMPION_SKILL_TYPE_SLOTTABLE
          end, false)
          out[#out + 1] = {
            id = "cp-" .. slug(discName) .. "-" .. slug(name),
            name = name,
            category = discName,
            type = slottable and "slottable" or "passive",
            description = safe(function() return zo_strformat("<<1>>", GetChampionSkillDescription(skillId)) end, ""),
            maxPoints = safe(function() return GetChampionSkillMaxPoints(skillId) end, 50) or 50,
            icon = safe(function()
              return GetChampionSkillIcon and normIcon(GetChampionSkillIcon(skillId)) or nil
            end, nil),
            source = "ingame",
          }
        end
      end
    end
  end)
  return out
end

----------------------------------------------------------------------
-- Skill lines + abilities (names, descriptions, morphs)
----------------------------------------------------------------------
-- Vengeance is a separate Cyrodiil ruleset. Those lines are not the live catalog.
local function isVengeanceLine(skillType, lineIndex, lineName)
  local n = zo_strlower(lineName or "")
  if n == "vengeance" or n:find("^vengeance ") == 1 then return true end
  local category = safe(function()
    return zo_strlower(zo_strformat("<<1>>", GetString("SI_SKILLTYPE", skillType)))
  end, "")
  if category == "vengeance" then return true end
  local flagged = safe(function()
    if type(IsSkillLineVengeance) == "function" then
      return IsSkillLineVengeance(skillType, lineIndex) == true
    end
    if not SKILLS_DATA_MANAGER or not SKILLS_DATA_MANAGER.GetSkillLineDataByIndices then return false end
    local data = SKILLS_DATA_MANAGER:GetSkillLineDataByIndices(skillType, lineIndex)
    if data and type(data.IsVengeanceSkillLine) == "function" then
      return data:IsVengeanceSkillLine() == true
    end
    return false
  end, false)
  return flagged == true
end

-- The class a class skill line belongs to, as the game names it: the player's
-- class for their own lines, else the class id the game gives the line. Nil
-- when this client offers neither; the app then keeps the class it already knows.
local function classOfSkillLine(skillType, lineIndex)
  local data = safe(function()
    if not SKILLS_DATA_MANAGER or not SKILLS_DATA_MANAGER.GetSkillLineDataByIndices then return nil end
    return SKILLS_DATA_MANAGER:GetSkillLineDataByIndices(skillType, lineIndex)
  end, nil)
  if not data or type(data.IsClassSkillLine) ~= "function" or not data:IsClassSkillLine() then return nil end
  if type(data.IsPlayerClassSkillLine) == "function" and data:IsPlayerClassSkillLine() then
    local own = safe(function() return zo_strformat("<<1>>", GetUnitClass("player")) end, nil)
    if own and own ~= "" then return own end
  end
  local classId = safe(function()
    if type(data.GetClassId) == "function" then return data:GetClassId() end
    local skillLineId = select(4, GetSkillLineInfo(skillType, lineIndex))
    if type(GetSkillLineClassId) == "function" and skillLineId then return GetSkillLineClassId(skillLineId) end
    return nil
  end, nil)
  if type(classId) ~= "number" or classId <= 0 or type(GetClassName) ~= "function" then return nil end
  local name = safe(function() return zo_strformat("<<1>>", GetClassName(GENDER_MALE, classId)) end, nil)
  return name ~= "" and name or nil
end

local function gatherSkills()
  local lines, skills = {}, {}
  safe(function()
    local numTypes = GetNumSkillTypes()
    for skillType = 1, numTypes do
      local numLines = GetNumSkillLines(skillType)
      for lineIndex = 1, numLines do
        local lineName = zo_strformat("<<1>>", GetSkillLineInfo(skillType, lineIndex))
        if lineName and lineName ~= "" and not isVengeanceLine(skillType, lineIndex, lineName) then
          local className = classOfSkillLine(skillType, lineIndex)
          local lineId = "line-" .. lineSlug(lineName)
          -- Class Mastery is one tree per class under one name; its id carries the class.
          if lineId == "line-class-mastery" and className then lineId = lineId .. "-" .. slug(className) end
          local line = {
            id = lineId,
            name = lineName,
            category = safe(function() return zo_strformat("<<1>>", GetString("SI_SKILLTYPE", skillType)) end, "Skill"),
            className = className,
            icon = nil,
            source = "ingame",
          }
          lines[#lines + 1] = line
          local numAbilities = GetNumSkillAbilities(skillType, lineIndex)
          for a = 1, numAbilities do
            local crafted = IsCraftedAbilitySkill and IsCraftedAbilitySkill(skillType, lineIndex, a)
            if crafted then
              local craftedId = safe(function()
                return GetCraftedAbilitySkillCraftedAbilityId
                  and GetCraftedAbilitySkillCraftedAbilityId(skillType, lineIndex, a)
                  or nil
              end, nil)
              local aName = craftedId and safe(function()
                return GetCraftedAbilityDisplayName and zo_strformat("<<1>>", GetCraftedAbilityDisplayName(craftedId)) or nil
              end, nil)
              if aName and aName ~= "" then
                local icon = safe(function()
                  return GetCraftedAbilityIcon and normIcon(GetCraftedAbilityIcon(craftedId)) or nil
                end, nil)
                local description = safe(function()
                  return GetCraftedAbilityDescription and zo_strformat("<<1>>", GetCraftedAbilityDescription(craftedId)) or ""
                end, "")
                if icon and not line.icon then line.icon = icon end
                skills[#skills + 1] = {
                  id = "sk-" .. slug(aName),
                  name = aName,
                  lineId = lineId,
                  type = "active",
                  description = description,
                  icon = icon,
                  morphs = {},
                  source = "ingame",
                }
              end
            else
            local aName, texture, _, passive = GetSkillAbilityInfo(skillType, lineIndex, a)
            aName = zo_strformat("<<1>>", aName)
            if aName and aName ~= "" then
              local abilityId = safe(function()
                return GetSkillAbilityId(skillType, lineIndex, a, false)
              end, nil)
              local icon = safe(function()
                return (abilityId and GetAbilityIcon and normIcon(GetAbilityIcon(abilityId)))
                  or normIcon(texture)
              end, nil)
              -- First active ability's icon represents the line in the list view.
              if icon and not line.icon and not passive then line.icon = icon end
              local morphs = {}
              safe(function()
                if passive or not GetProgressionSkillProgressionId then return end
                local progressionId = GetProgressionSkillProgressionId(skillType, lineIndex, a)
                if not progressionId or progressionId == 0 then return end
                local baseSlot = MORPH_SLOT_BASE or 0
                local baseId = GetProgressionSkillMorphSlotAbilityId
                  and GetProgressionSkillMorphSlotAbilityId(progressionId, baseSlot)
                if baseId and baseId > 0 then
                  local baseName = zo_strformat("<<1>>", GetAbilityName(baseId))
                  if baseName ~= "" then aName = baseName end
                  abilityId = baseId
                  if GetAbilityIcon then icon = normIcon(GetAbilityIcon(baseId)) or icon end
                end
                local beginSlot = MORPH_SLOT_MORPH_1 or 1
                local endSlot = MORPH_SLOT_ITERATION_END or MORPH_SLOT_MORPH_2 or 2
                for slot = beginSlot, endSlot do
                  local morphId = GetProgressionSkillMorphSlotAbilityId
                    and GetProgressionSkillMorphSlotAbilityId(progressionId, slot)
                  if morphId and morphId > 0 then
                    morphs[#morphs + 1] = {
                      name = zo_strformat("<<1>>", GetAbilityName(morphId)),
                      abilityId = morphId,
                      isMorph = true,
                      icon = GetAbilityIcon and normIcon(GetAbilityIcon(morphId)) or nil,
                      description = GetAbilityDescription
                        and zo_strformat("<<1>>", GetAbilityDescription(morphId))
                        or "",
                    }
                  end
                end
              end)
              skills[#skills + 1] = {
                id = "sk-" .. slug(aName),
                name = aName,
                lineId = lineId,
                type = passive and "passive" or "active",
                description = safe(function()
                  return abilityId and GetAbilityDescription and zo_strformat("<<1>>", GetAbilityDescription(abilityId)) or ""
                end, ""),
                icon = icon,
                morphs = morphs,
                source = "ingame",
              }
            end
            end
          end
        end
      end
    end
  end)
  return lines, skills
end

----------------------------------------------------------------------
-- Item sets. Bonus lines come from the piece link when the client can read them.
----------------------------------------------------------------------
local function gatherSets()
  local out = {}
  safe(function()
    if not GetNextItemSetCollectionId then return end
    local setId = GetNextItemSetCollectionId(nil)
    local guard = 0
    while setId and setId ~= 0 and guard < 10000 do
      guard = guard + 1
      local name = safe(function() return zo_strformat("<<1>>", GetItemSetName(setId)) end, nil)
      if name and name ~= "" then
        local catId = safe(function() return GetItemSetCollectionCategoryId(setId) end, nil)
        local category = catId
          and safe(function() return zo_strformat("<<1>>", GetItemSetCollectionCategoryName(catId)) end, "Unknown")
          or "Unknown"
        local icon = safe(function()
          local numPieces = GetNumItemSetCollectionPieces(setId) or 0
          if numPieces < 1 or not GetItemSetCollectionPieceItemLink then return nil end
          local pieceId = select(1, GetItemSetCollectionPieceInfo(setId, 1))
          local link = pieceId and GetItemSetCollectionPieceItemLink(pieceId)
          return link and normIcon(GetItemLinkIcon(link)) or nil
        end, nil)
        local bonuses, maxEquip = setBonusesFromId(setId)
        local row = {
          id = "set-" .. slug(name),
          name = name,
          setId = setId,
          category = category ~= "" and category or "Unknown",
          bonuses = bonuses or {},
          icon = icon,
          source = "ingame",
        }
        if maxEquip then row.maxEquip = maxEquip end
        out[#out + 1] = row
      end
      setId = safe(function() return GetNextItemSetCollectionId(setId) end, nil)
    end
  end)
  return out
end

local function gatherScribing()
  local grimoires, scripts = {}, {}
  safe(function()
    -- Same walk as the snapshot: every grimoire slot, not a function the
    -- live API does not have. One script is shared by many grimoires.
    if not GetNumCraftedAbilities or not GetCraftedAbilityIdAtIndex then return end
    if not GetNumScriptsInSlotForCraftedAbility or not GetScriptIdAtSlotIndexForCraftedAbility then return end
    local seen = {}
    local slotBegin = SCRIBING_SLOT_ITERATION_BEGIN or SCRIBING_SLOT_PRIMARY or 1
    local slotEnd = SCRIBING_SLOT_ITERATION_END or SCRIBING_SLOT_TERTIARY or 3
    for i = 1, GetNumCraftedAbilities() do
      local craftedId = GetCraftedAbilityIdAtIndex(i)
      if craftedId and craftedId ~= 0 then
        for slot = slotBegin, slotEnd do
          local count = GetNumScriptsInSlotForCraftedAbility(craftedId, slot) or 0
          for index = 1, count do
            local id = GetScriptIdAtSlotIndexForCraftedAbility(craftedId, slot, index)
            if id and id ~= 0 and not seen[id] then
              seen[id] = true
              local name = safe(function()
                return GetCraftedAbilityScriptDisplayName and zo_strformat("<<1>>", GetCraftedAbilityScriptDisplayName(id)) or nil
              end, nil)
              if name and name ~= "" and not seen[zo_strlower(name)] then
                seen[zo_strlower(name)] = true
                local slotName = safe(function()
                  local scriptSlot = GetCraftedAbilityScriptScribingSlot and GetCraftedAbilityScriptScribingSlot(id)
                  if scriptSlot == SCRIBING_SLOT_PRIMARY or scriptSlot == 1 then return "focus" end
                  if scriptSlot == SCRIBING_SLOT_SECONDARY or scriptSlot == 2 then return "signature" end
                  if scriptSlot == SCRIBING_SLOT_TERTIARY or scriptSlot == 3 then return "affix" end
                  return nil
                end, nil)
                if slotName then
                  scripts[#scripts + 1] = {
                    id = "scr-" .. slug(name),
                    name = name,
                    slot = slotName,
                    icon = safe(function()
                      return GetCraftedAbilityScriptIcon and normIcon(GetCraftedAbilityScriptIcon(id)) or nil
                    end, nil),
                    effect = safe(function()
                      if GetCraftedAbilityScriptGeneralDescription then
                        local text = GetCraftedAbilityScriptGeneralDescription(id)
                        if text and text ~= "" then return zo_strformat("<<1>>", text) end
                      end
                      if GetCraftedAbilityScriptDescription then
                        local text = GetCraftedAbilityScriptDescription(craftedId, id)
                        if text and text ~= "" then return zo_strformat("<<1>>", text) end
                      end
                      return ""
                    end, ""),
                    source = "ingame",
                  }
                end
              end
            end
          end
        end
      end
    end
  end)
  safe(function()
    if not GetNumCraftedAbilities or not GetCraftedAbilityIdAtIndex then return end
    for i = 1, GetNumCraftedAbilities() do
      local id = GetCraftedAbilityIdAtIndex(i)
      if id and id ~= 0 then
        local name = safe(function()
          return GetCraftedAbilityDisplayName and zo_strformat("<<1>>", GetCraftedAbilityDisplayName(id)) or nil
        end, nil)
        if name and name ~= "" then
          local lineName = safe(function()
            local skillType, lineIndex
            if GetCraftedAbilitySkillAbilityIndices then
              skillType, lineIndex = GetCraftedAbilitySkillAbilityIndices(id)
            elseif GetCraftedAbilitySkillIndices then
              skillType, lineIndex = GetCraftedAbilitySkillIndices(id)
            end
            if skillType and lineIndex then
              return zo_strformat("<<1>>", GetSkillLineInfo(skillType, lineIndex))
            end
            return "Scribing"
          end, "Scribing")
          grimoires[#grimoires + 1] = {
            id = "grim-" .. slug(name),
            name = name,
            skillLine = lineName ~= "" and lineName or "Scribing",
            description = safe(function()
              return GetCraftedAbilityDescription and zo_strformat("<<1>>", GetCraftedAbilityDescription(id)) or ""
            end, ""),
            icon = safe(function()
              return GetCraftedAbilityIcon and normIcon(GetCraftedAbilityIcon(id)) or nil
            end, nil),
            source = "ingame",
          }
        end
      end
    end
  end)
  return grimoires, scripts
end
----------------------------------------------------------------------
-- Mundus blessings, with this patch's text and numbers. The ids are the
-- thirteen "Boon:" abilities; each is kept only when the game names it a
-- boon, so a wrong or retired id is skipped rather than recorded.
----------------------------------------------------------------------
local BOON_IDS = { 13940, 13943, 13974, 13975, 13976, 13977, 13978, 13979, 13980, 13981, 13982, 13984, 13985 }

local function gatherMundus()
  local out = {}
  if not GetAbilityName or not GetAbilityDescription then return out end
  for _, id in ipairs(BOON_IDS) do
    safe(function()
      local raw = GetAbilityName(id)
      local stone = raw and zo_strformat("<<1>>", raw):match("^[Bb]oon:%s*(.+)$")
      if not stone or stone == "" then return end
      local description = zo_strformat("<<1>>", GetAbilityDescription(id) or "")
      out[#out + 1] = {
        id = "mundus-" .. slug(stone),
        name = stone,
        abilityId = id,
        description = description,
        icon = GetAbilityIcon and normIcon(GetAbilityIcon(id)) or nil,
        source = "ingame",
      }
    end)
  end
  return out
end

----------------------------------------------------------------------
-- Food and drink: every provisioning recipe, the dish it makes and the
-- buff that dish gives, as the game's tooltip states it.
----------------------------------------------------------------------
local function gatherFood()
  local out = {}
  if not GetNumRecipeLists or not GetRecipeInfo or not GetRecipeResultItemLink then return out end
  local seen = {}
  for listIndex = 1, (safe(GetNumRecipeLists, 0) or 0) do
    local listName, numRecipes = safe(function() return GetRecipeListInfo(listIndex) end, nil)
    listName = listName and zo_strformat("<<1>>", listName) or ""
    for recipeIndex = 1, (tonumber(numRecipes) or 0) do
      safe(function()
        local packed = { GetRecipeInfo(listIndex, recipeIndex) }
        local special = packed[6]
        if PROVISIONER_SPECIAL_INGREDIENT_TYPE_FURNISHING and special == PROVISIONER_SPECIAL_INGREDIENT_TYPE_FURNISHING then return end
        local link = GetRecipeResultItemLink(listIndex, recipeIndex, LINK_STYLE_DEFAULT)
        if not link or link == "" then return end
        local itemId = GetItemLinkItemId(link)
        if not itemId or itemId == 0 or seen[itemId] then return end
        seen[itemId] = true
        local name = zo_strformat("<<1>>", GetItemLinkName(link) or "")
        if name == "" then return end
        local _, header, buff = GetItemLinkOnUseAbilityInfo(link)
        local itemType, specializedType = GetItemLinkItemType(link)
        out[#out + 1] = {
          id = "food-" .. tostring(itemId),
          name = name,
          itemId = itemId,
          recipeList = listName,
          quality = GetItemLinkDisplayQuality and GetItemLinkDisplayQuality(link) or nil,
          kind = type(itemType) == "number" and zo_strformat("<<1>>", GetString("SI_ITEMTYPE", itemType)) or nil,
          subtype = type(specializedType) == "number" and specializedType > 0
            and zo_strformat("<<1>>", GetString("SI_SPECIALIZEDITEMTYPE", specializedType)) or nil,
          buffName = header and header ~= "" and zo_strformat("<<1>>", header) or nil,
          buff = buff and buff ~= "" and zo_strformat("<<1>>", buff) or "",
          icon = normIcon(GetItemLinkIcon(link)),
          source = "ingame",
        }
      end)
    end
  end
  return out
end

local function scan()
  if IsUnitInCombat("player") then
    d("[Nirnside Catalog] In combat — scan refused. Run /nirncatalog while AFK.")
    return
  end
  d("[Nirnside Catalog] Scanning live catalog… (this can take a few seconds)")

  sv.patch = safe(function() return "API" .. tostring(GetAPIVersion()) end, "live")
  sv.source = "ingame"
  sv.cp = gatherCP()
  local lines, skills = gatherSkills()
  sv.skillLines = lines
  sv.skills = skills
  sv.sets = gatherSets()
  local grimoires, scripts = gatherScribing()
  sv.grimoires = grimoires
  sv.scripts = scripts
  sv.mundus = gatherMundus()
  sv.food = gatherFood()
  sv.generatedAt = GetTimeStamp()

  d(string.format(
    "[Nirnside Catalog] Done: %d CP, %d skill lines, %d abilities, %d sets, %d grimoires, %d scripts, %d Mundus stones, %d dishes. /reloadui or log out to write the file.",
    #sv.cp, #sv.skillLines, #sv.skills, #sv.sets, #sv.grimoires, #sv.scripts, #sv.mundus, #sv.food))
end

local function onLoaded(_, name)
  if name ~= ADDON_NAME then return end
  EVENT_MANAGER:UnregisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED)
  sv = ZO_SavedVars:NewAccountWide("NirnsideCatalog", 1, nil, {
    patch = "live", source = "ingame",
    cp = {}, skillLines = {}, skills = {}, sets = {}, grimoires = {}, scripts = {}, achievements = {}, mundus = {}, food = {},
  })
  SLASH_COMMANDS["/nirncatalog"] = function() safe(scan) end
end

EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED, onLoaded)
