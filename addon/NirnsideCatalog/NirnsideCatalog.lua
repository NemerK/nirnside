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
          lines[#lines + 1] = {
            id = lineId,
            name = lineName,
            category = safe(function() return zo_strformat("<<1>>", GetString("SI_SKILLTYPE", skillType)) end, "Skill"),
            source = "ingame",
          }
          local numAbilities = GetNumSkillAbilities(skillType, lineIndex)
          for a = 1, numAbilities do
            local aName, _, _, passive = GetSkillAbilityInfo(skillType, lineIndex, a)
            aName = zo_strformat("<<1>>", aName)
            if aName and aName ~= "" then
              local abilityId = safe(function()
                local pi = select(7, GetSkillAbilityInfo(skillType, lineIndex, a))
                return GetSkillAbilityId(skillType, lineIndex, a, false)
              end, nil)
              skills[#skills + 1] = {
                id = "sk-" .. slug(aName),
                name = aName,
                lineId = lineId,
                type = passive and "passive" or "active",
                description = safe(function()
                  return abilityId and zo_strformat("<<1>>", GetAbilityDescription(abilityId)) or ""
                end, ""),
                morphs = {},
                source = "ingame",
              }
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
        out[#out + 1] = {
          id = "set-" .. slug(name),
          name = name,
          setId = setId,
          category = category ~= "" and category or "Unknown",
          bonuses = {},
          source = "ingame",
        }
      end
      setId = safe(function() return GetNextItemSetCollectionId(setId) end, nil)
    end
  end)
  return out
end

----------------------------------------------------------------------
-- Orchestration
----------------------------------------------------------------------
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
  -- Scribing catalog scan is intentionally omitted until API coverage is
  -- verified; reference data covers it and is clearly flagged.
  sv.generatedAt = GetTimeStamp()

  d(string.format(
    "[Nirnside Catalog] Done: %d CP, %d skill lines, %d abilities, %d sets. /reloadui or log out to write the file.",
    #sv.cp, #sv.skillLines, #sv.skills, #sv.sets))
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
