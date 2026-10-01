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

local function safe(fn, fallback)
  local ok, res = pcall(fn)
  if ok then return res end
  return fallback
end

local function slug(s)
  s = zo_strformat("<<1>>", s or "")
  s = s:lower():gsub("[^%w]+", "-"):gsub("^-+", ""):gsub("-+$", "")
  return s
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
local function gatherSkills()
  local lines, skills = {}, {}
  safe(function()
    local numTypes = GetNumSkillTypes()
    for skillType = 1, numTypes do
      local numLines = GetNumSkillLines(skillType)
      for lineIndex = 1, numLines do
        local lineName = zo_strformat("<<1>>", GetSkillLineInfo(skillType, lineIndex))
        if lineName and lineName ~= "" then
          local lineId = "line-" .. slug(lineName)
          local line = {
            id = lineId,
            name = lineName,
            category = safe(function() return zo_strformat("<<1>>", GetString("SI_SKILLTYPE", skillType)) end, "Skill"),
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
-- Item sets (id/name/category; bonuses left to reference via field merge)
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
        out[#out + 1] = {
          id = "set-" .. slug(name),
          name = name,
          setId = setId,
          category = category ~= "" and category or "Unknown",
          bonuses = {},
          icon = icon,
          source = "ingame",
        }
      end
      setId = safe(function() return GetNextItemSetCollectionId(setId) end, nil)
    end
  end)
  return out
end

local function gatherScribing()
  local grimoires, scripts = {}, {}
  safe(function()
    if not GetNumCraftedAbilityScripts or not GetCraftedAbilityScriptIdAtIndex then return end
    for i = 1, GetNumCraftedAbilityScripts() do
      local id = GetCraftedAbilityScriptIdAtIndex(i)
      if id and id ~= 0 then
        local name = safe(function()
          return GetCraftedAbilityScriptDisplayName and zo_strformat("<<1>>", GetCraftedAbilityScriptDisplayName(id)) or nil
        end, nil)
        if name and name ~= "" then
          local slotName = safe(function()
            local slot = GetCraftedAbilityScriptScribingSlot and GetCraftedAbilityScriptScribingSlot(id)
            if slot == SCRIBING_SLOT_PRIMARY or slot == 1 then return "focus" end
            if slot == SCRIBING_SLOT_SECONDARY or slot == 2 then return "signature" end
            if slot == SCRIBING_SLOT_TERTIARY or slot == 3 then return "affix" end
            return "focus"
          end, "focus")
          scripts[#scripts + 1] = {
            id = "scr-" .. slug(name),
            name = name,
            slot = slotName,
            effect = safe(function()
              return GetCraftedAbilityScriptDescription
                and zo_strformat("<<1>>", GetCraftedAbilityScriptDescription(id))
                or ""
            end, ""),
            source = "ingame",
          }
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
  sv.generatedAt = GetTimeStamp()

  d(string.format(
    "[Nirnside Catalog] Done: %d CP, %d skill lines, %d abilities, %d sets, %d grimoires, %d scripts. /reloadui or log out to write the file.",
    #sv.cp, #sv.skillLines, #sv.skills, #sv.sets, #sv.grimoires, #sv.scripts))
end

local function onLoaded(_, name)
  if name ~= ADDON_NAME then return end
  EVENT_MANAGER:UnregisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED)
  sv = ZO_SavedVars:NewAccountWide("NirnsideCatalog", 1, nil, {
    patch = "live", source = "ingame",
    cp = {}, skillLines = {}, skills = {}, sets = {}, grimoires = {}, scripts = {}, achievements = {},
  })
  SLASH_COMMANDS["/nirncatalog"] = function() safe(scan) end
end

EVENT_MANAGER:RegisterForEvent(ADDON_NAME, EVENT_ADD_ON_LOADED, onLoaded)
