-- Sample Nirnside SavedVariables (Update 50 / Season One era).
-- This mimics exactly what the NirnsideSnapshot addon writes on logout/ReloadUI,
-- so the parser, importer and UI can be developed and demoed without the game.
-- Region EU, one @account, ESO+ active.
NirnsideData =
{
    ["Default"] =
    {
        ["@AzuraStar"] =
        {
            ["$AccountWide"] =
            {
                ["version"] = 1,
                ["displayName"] = "@AzuraStar",
                ["region"] = "EU",
                ["apiVersion"] = 101046,
                ["esoPlus"] = true,
                ["lastSnapshot"] = 1757800920,
                ["gold"] = 4218764,
                ["currencies"] =
                {
                    ["transmuteCrystals"] = 812,
                    ["telVar"] = 15230,
                    ["alliancePoints"] = 402118,
                    ["writVouchers"] = 6640,
                    ["eventTickets"] = 12,
                    ["undauntedKeys"] = 21,
                },
                ["guilds"] =
                {
                    {
                        ["name"] = "Tamriel Trade Co",
                        ["rank"] = "Merchant",
                        ["trader"] = true,
                    },
                    {
                        ["name"] = "Nightfall Raiders",
                        ["rank"] = "Officer",
                        ["trader"] = false,
                    },
                    {
                        ["name"] = "Housing & Chill",
                        ["rank"] = "Member",
                        ["trader"] = false,
                    },
                },
                ["characters"] =
                {
                    {
                        ["id"] = "char-001",
                        ["name"] = "Sings-With-Shadows",
                        ["class"] = "Nightblade",
                        ["race"] = "Khajiit",
                        ["alliance"] = "Aldmeri Dominion",
                        ["gender"] = "Female",
                        ["level"] = 50,
                        ["championPoints"] = 3600,
                        ["mundus"] = "The Shadow",
                        ["attributes"] = { ["magicka"] = 0, ["health"] = 15, ["stamina"] = 49 },
                        ["vampire"] = { ["isVampire"] = true, ["stage"] = 3 },
                        ["werewolf"] = { ["isWerewolf"] = false },
                        ["classMastery"] = false,
                        ["lastSeen"] = 1757800920,
                        ["skillLines"] =
                        {
                            {
                                ["name"] = "Assassination",
                                ["category"] = "Class",
                                ["rank"] = 50,
                                ["subclassed"] = false,
                                ["abilities"] =
                                {
                                    { ["name"] = "Merciless Resolve", ["rank"] = 4, ["morph"] = 1, ["purchased"] = true, ["skillStyle"] = "Order of the Hour" },
                                    { ["name"] = "Killer's Blade", ["rank"] = 4, ["morph"] = 2, ["purchased"] = true },
                                    { ["name"] = "Relentless Focus", ["rank"] = 4, ["morph"] = 1, ["purchased"] = true },
                                },
                            },
                            {
                                ["name"] = "Herald of the Tome",
                                ["category"] = "Class",
                                ["rank"] = 38,
                                ["subclassed"] = true,
                                ["abilities"] =
                                {
                                    { ["name"] = "Fatecarver", ["rank"] = 4, ["morph"] = 1, ["purchased"] = true },
                                    { ["name"] = "The Unblinking Eye", ["rank"] = 3, ["morph"] = 0, ["purchased"] = true },
                                },
                            },
                            {
                                ["name"] = "Dual Wield",
                                ["category"] = "Weapon",
                                ["rank"] = 50,
                                ["subclassed"] = false,
                                ["abilities"] =
                                {
                                    { ["name"] = "Flurry", ["rank"] = 4, ["morph"] = 2, ["purchased"] = true },
                                },
                            },
                            {
                                ["name"] = "Vampire",
                                ["category"] = "World",
                                ["rank"] = 10,
                                ["subclassed"] = false,
                                ["abilities"] =
                                {
                                    { ["name"] = "Blood Scion", ["rank"] = 4, ["morph"] = 1, ["purchased"] = true },
                                    { ["name"] = "Mesmerize", ["rank"] = 2, ["morph"] = 0, ["purchased"] = false },
                                },
                            },
                            {
                                ["name"] = "Soul Magic",
                                ["category"] = "Guild",
                                ["rank"] = 6,
                                ["subclassed"] = false,
                                ["abilities"] = {},
                            },
                        },
                        ["champion"] =
                        {
                            {
                                ["name"] = "Warfare",
                                ["stars"] =
                                {
                                    { ["name"] = "Deadly Aim", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Master-at-Arms", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Backstabber", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Fighting Finesse", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Wrathful Strikes", ["points"] = 50, ["slotted"] = false },
                                },
                            },
                            {
                                ["name"] = "Fitness",
                                ["stars"] =
                                {
                                    { ["name"] = "Boundless Vitality", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Fortified", ["points"] = 20, ["slotted"] = true },
                                    { ["name"] = "Rejuvenation", ["points"] = 50, ["slotted"] = false },
                                },
                            },
                            {
                                ["name"] = "Craft",
                                ["stars"] =
                                {
                                    { ["name"] = "Steed's Blessing", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Gifted Rider", ["points"] = 75, ["slotted"] = true },
                                    { ["name"] = "Treasure Hunter", ["points"] = 50, ["slotted"] = true },
                                },
                            },
                        },
                        ["equipped"] =
                        {
                            { ["slot"] = "Head", ["bar"] = nil, ["name"] = "Slimecraw's Helm", ["quality"] = "legendary", ["setName"] = "Slimecraw", ["trait"] = "Divines", ["enchant"] = "Max Magicka" },
                            { ["slot"] = "Chest", ["bar"] = nil, ["name"] = "Coral Riptide Jack", ["quality"] = "legendary", ["setName"] = "Coral Riptide", ["trait"] = "Divines", ["enchant"] = "Max Stamina" },
                            { ["slot"] = "Shoulders", ["bar"] = nil, ["name"] = "Slimecraw's Pauldron", ["quality"] = "legendary", ["setName"] = "Slimecraw", ["trait"] = "Divines", ["enchant"] = "Max Stamina" },
                            { ["slot"] = "Main Hand", ["bar"] = "front", ["name"] = "Coral Riptide Dagger", ["quality"] = "legendary", ["setName"] = "Coral Riptide", ["trait"] = "Nirnhoned", ["enchant"] = "Weapon Damage", ["scribing"] = {} },
                            { ["slot"] = "Off Hand", ["bar"] = "front", ["name"] = "Coral Riptide Dagger", ["quality"] = "legendary", ["setName"] = "Coral Riptide", ["trait"] = "Sharpened", ["enchant"] = "Flame Damage" },
                            { ["slot"] = "Main Hand", ["bar"] = "back", ["name"] = "Sul-Xan's Bow", ["quality"] = "legendary", ["setName"] = "Sul-Xan's Torment", ["trait"] = "Infused", ["enchant"] = "Weakening", ["scribing"] = { "Ulfsild's Contingency" } },
                        },
                        ["companions"] =
                        {
                            { ["name"] = "Azandar al-Cybiades", ["rapport"] = "Cherished", ["level"] = 20 },
                            { ["name"] = "Sharp-as-Night", ["rapport"] = "Allied", ["level"] = 20 },
                        },
                        ["scribingScripts"] =
                        {
                            "Ulfsild's Contingency",
                            "Traveling Knife",
                            "Class Mastery: Assassin",
                            "Anchorite's Cruelty",
                        },
                        ["research"] =
                        {
                            { ["craft"] = "Blacksmithing", ["trait"] = "Nirnhoned", ["remaining"] = "12d 4h" },
                            { ["craft"] = "Clothing", ["trait"] = "Infused", ["remaining"] = "6d 1h" },
                        },
                    },
                    {
                        ["id"] = "char-002",
                        ["name"] = "Draugr-Bane",
                        ["class"] = "Dragonknight",
                        ["race"] = "Nord",
                        ["alliance"] = "Ebonheart Pact",
                        ["gender"] = "Male",
                        ["level"] = 50,
                        ["championPoints"] = 3600,
                        ["mundus"] = "The Lord",
                        ["attributes"] = { ["magicka"] = 0, ["health"] = 64, ["stamina"] = 0 },
                        ["vampire"] = { ["isVampire"] = false, ["stage"] = 0 },
                        ["werewolf"] = { ["isWerewolf"] = true },
                        ["classMastery"] = true,
                        ["lastSeen"] = 1757714520,
                        ["skillLines"] =
                        {
                            {
                                ["name"] = "Draconic Power",
                                ["category"] = "Class",
                                ["rank"] = 50,
                                ["subclassed"] = false,
                                ["abilities"] =
                                {
                                    { ["name"] = "Dragon Blood", ["rank"] = 4, ["morph"] = 1, ["purchased"] = true },
                                    { ["name"] = "Green Dragon Blood", ["rank"] = 4, ["morph"] = 2, ["purchased"] = true },
                                },
                            },
                            {
                                ["name"] = "Werewolf",
                                ["category"] = "World",
                                ["rank"] = 10,
                                ["subclassed"] = false,
                                ["abilities"] =
                                {
                                    { ["name"] = "Pack Leader", ["rank"] = 4, ["morph"] = 1, ["purchased"] = true },
                                    { ["name"] = "Hircine's Fortitude", ["rank"] = 4, ["morph"] = 2, ["purchased"] = true },
                                },
                            },
                            {
                                ["name"] = "One Hand and Shield",
                                ["category"] = "Weapon",
                                ["rank"] = 50,
                                ["subclassed"] = false,
                                ["abilities"] =
                                {
                                    { ["name"] = "Pierce Armor", ["rank"] = 4, ["morph"] = 1, ["purchased"] = true },
                                },
                            },
                        },
                        ["champion"] =
                        {
                            {
                                ["name"] = "Fitness",
                                ["stars"] =
                                {
                                    { ["name"] = "Boundless Vitality", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Bastion", ["points"] = 50, ["slotted"] = true },
                                    { ["name"] = "Ironclad", ["points"] = 50, ["slotted"] = true },
                                },
                            },
                        },
                        ["equipped"] =
                        {
                            { ["slot"] = "Head", ["bar"] = nil, ["name"] = "Nazaray Helm", ["quality"] = "legendary", ["setName"] = "Nazaray", ["trait"] = "Reinforced", ["enchant"] = "Max Health" },
                            { ["slot"] = "Chest", ["bar"] = nil, ["name"] = "Turning Tide Cuirass", ["quality"] = "legendary", ["setName"] = "Turning Tide", ["trait"] = "Reinforced", ["enchant"] = "Max Health" },
                            { ["slot"] = "Main Hand", ["bar"] = "front", ["name"] = "Lucent Echoes Sword", ["quality"] = "legendary", ["setName"] = "Lucent Echoes", ["trait"] = "Charged", ["enchant"] = "Crusher" },
                        },
                        ["companions"] = {},
                        ["scribingScripts"] = { "Class Mastery: Draconic", "Vault" },
                        ["research"] = {},
                    },
                    {
                        ["id"] = "char-003",
                        ["name"] = "Bakes-Sweet-Rolls",
                        ["class"] = "Arcanist",
                        ["race"] = "High Elf",
                        ["alliance"] = "Aldmeri Dominion",
                        ["gender"] = "Female",
                        ["level"] = 32,
                        ["championPoints"] = 0,
                        ["mundus"] = "The Atronach",
                        ["attributes"] = { ["magicka"] = 20, ["health"] = 0, ["stamina"] = 0 },
                        ["vampire"] = { ["isVampire"] = false, ["stage"] = 0 },
                        ["werewolf"] = { ["isWerewolf"] = false },
                        ["classMastery"] = false,
                        ["lastSeen"] = nil,
                        ["skillLines"] = {},
                        ["champion"] = {},
                        ["equipped"] = {},
                        ["companions"] = {},
                        ["scribingScripts"] = {},
                        ["research"] = {},
                    },
                },
                ["items"] =
                {
                    { ["itemId"] = 194512, ["name"] = "Coral Riptide Dagger", ["quality"] = "legendary", ["count"] = 1, ["ownerCharacter"] = "Sings-With-Shadows", ["location"] = "worn", ["setName"] = "Coral Riptide", ["setId"] = 693, ["trait"] = "Nirnhoned", ["level"] = 160, ["equipSlot"] = "Main Hand" },
                    { ["itemId"] = 187224, ["name"] = "Slimecraw's Helm", ["quality"] = "legendary", ["count"] = 1, ["ownerCharacter"] = "Sings-With-Shadows", ["location"] = "worn", ["setName"] = "Slimecraw", ["setId"] = 154, ["trait"] = "Divines", ["level"] = 160, ["equipSlot"] = "Head" },
                    { ["itemId"] = 147323, ["name"] = "Perfected Coral Riptide Bow", ["quality"] = "legendary", ["count"] = 1, ["ownerCharacter"] = "Sings-With-Shadows", ["location"] = "backpack", ["setName"] = "Coral Riptide", ["setId"] = 693, ["trait"] = "Infused", ["level"] = 160, ["equipSlot"] = "Two Hand" },
                    { ["itemId"] = 45814, ["name"] = "Rubedite Ingot", ["quality"] = "normal", ["count"] = 480, ["ownerCharacter"] = nil, ["location"] = "craftBag", ["trait"] = nil, ["level"] = nil },
                    { ["itemId"] = 23219, ["name"] = "Dwarven Oil", ["quality"] = "fine", ["count"] = 214, ["ownerCharacter"] = nil, ["location"] = "craftBag" },
                    { ["itemId"] = 64509, ["name"] = "Perfect Roe", ["quality"] = "legendary", ["count"] = 61, ["ownerCharacter"] = nil, ["location"] = "craftBag" },
                    { ["itemId"] = 135136, ["name"] = "Mythic Aetherial Ambrosia", ["quality"] = "legendary", ["count"] = 9, ["ownerCharacter"] = nil, ["location"] = "bank" },
                    { ["itemId"] = 194501, ["name"] = "Ozezan the Inferno Ring", ["quality"] = "legendary", ["count"] = 1, ["ownerCharacter"] = nil, ["location"] = "bank", ["setName"] = "Ozezan the Inferno", ["setId"] = 700, ["trait"] = "Bloodthirsty", ["level"] = 160, ["equipSlot"] = "Ring" },
                    { ["itemId"] = 171436, ["name"] = "Deadly Strike Bow", ["quality"] = "epic", ["count"] = 1, ["ownerCharacter"] = nil, ["location"] = "bank", ["setName"] = "Deadly Strike", ["setId"] = 356, ["trait"] = "Sharpened", ["level"] = 160, ["equipSlot"] = "Two Hand" },
                    { ["itemId"] = 153576, ["name"] = "Ring of the Pale Order", ["quality"] = "legendary", ["count"] = 1, ["ownerCharacter"] = nil, ["location"] = "subscriberBank", ["setName"] = "Pale Order", ["setId"] = 574, ["trait"] = "Bloodthirsty", ["level"] = 160, ["equipSlot"] = "Ring" },
                    { ["itemId"] = 187015, ["name"] = "Spaulder of Ruin", ["quality"] = "legendary", ["count"] = 1, ["ownerCharacter"] = nil, ["location"] = "subscriberBank", ["setName"] = "Spaulder of Ruin", ["setId"] = 583, ["trait"] = "Infused", ["level"] = 160, ["equipSlot"] = "Shoulders" },
                    { ["itemId"] = 121522, ["name"] = "Crown Repair Kit", ["quality"] = "fine", ["count"] = 30, ["ownerCharacter"] = "Draugr-Bane", ["location"] = "backpack" },
                    { ["itemId"] = 30357, ["name"] = "Event Cake Slice", ["quality"] = "normal", ["count"] = 3, ["ownerCharacter"] = "Draugr-Bane", ["location"] = "backpack", ["obtainable"] = false },
                    { ["itemId"] = 64489, ["name"] = "Alliance War Repair Kit", ["quality"] = "normal", ["count"] = 12, ["ownerCharacter"] = "Draugr-Bane", ["location"] = "backpack" },
                    { ["itemId"] = 54181, ["name"] = "Lockpick", ["quality"] = "normal", ["count"] = 199, ["ownerCharacter"] = "Sings-With-Shadows", ["location"] = "backpack" },
                    { ["itemId"] = 88035, ["name"] = "Grand Repair Kit", ["quality"] = "superior", ["count"] = 8, ["ownerCharacter"] = "Sings-With-Shadows", ["location"] = "backpack" },
                    { ["itemId"] = 194513, ["name"] = "Coral Riptide Sash", ["quality"] = "epic", ["count"] = 1, ["ownerCharacter"] = nil, ["location"] = "bank", ["setName"] = "Coral Riptide", ["setId"] = 693, ["trait"] = "Divines", ["level"] = 160, ["equipSlot"] = "Waist" },
                    { ["itemId"] = 166149, ["name"] = "Stolen Silverware", ["quality"] = "fine", ["count"] = 4, ["ownerCharacter"] = "Sings-With-Shadows", ["location"] = "backpack", ["stolen"] = true },
                },
                ["stickerbook"] =
                {
                    {
                        ["setId"] = 693,
                        ["name"] = "Coral Riptide",
                        ["category"] = "Trials",
                        ["subcategory"] = "Dreadsail Reef",
                        ["categoryOrder"] = 4, ["subOrder"] = 10,
                        ["pieces"] =
                        {
                            { ["slot"] = "Head",      ["type"] = "Heavy Head",      ["name"] = "Coral Riptide Helm",     ["collected"] = true },
                            { ["slot"] = "Chest",     ["type"] = "Medium Chest",    ["name"] = "Coral Riptide Jack",     ["collected"] = true },
                            { ["slot"] = "Shoulders", ["type"] = "Light Shoulders", ["name"] = "Coral Riptide Epaulets", ["collected"] = true },
                            { ["slot"] = "Hands",     ["type"] = "Medium Hands",    ["name"] = "Coral Riptide Bracers",  ["collected"] = true },
                            { ["slot"] = "Waist",     ["type"] = "Heavy Waist",     ["name"] = "Coral Riptide Girdle",   ["collected"] = false },
                            { ["slot"] = "Legs",      ["type"] = "Medium Legs",     ["name"] = "Coral Riptide Guards",   ["collected"] = true },
                            { ["slot"] = "Feet",      ["type"] = "Light Feet",      ["name"] = "Coral Riptide Shoes",    ["collected"] = true },
                            { ["slot"] = "Necklace",  ["type"] = "Necklace",        ["name"] = "Coral Riptide Necklace", ["collected"] = false },
                            { ["slot"] = "Ring",      ["type"] = "Ring",            ["name"] = "Coral Riptide Ring",     ["collected"] = true },
                            { ["slot"] = "Weapon",    ["type"] = "Restoration Staff", ["name"] = "Coral Riptide Restoration Staff", ["collected"] = true },
                        },
                    },
                    {
                        ["setId"] = 800,
                        ["name"] = "Turning Tide",
                        ["category"] = "Trials",
                        ["subcategory"] = "Lucent Citadel",
                        ["categoryOrder"] = 4, ["subOrder"] = 12,
                        ["pieces"] =
                        {
                            { ["slot"] = "Head",   ["type"] = "Heavy Head",   ["name"] = "Turning Tide Helm",   ["collected"] = false },
                            { ["slot"] = "Chest",  ["type"] = "Heavy Chest",  ["name"] = "Turning Tide Cuirass", ["collected"] = true },
                            { ["slot"] = "Legs",   ["type"] = "Medium Legs",  ["name"] = "Turning Tide Guards", ["collected"] = false },
                            { ["slot"] = "Weapon", ["type"] = "Battle Axe",   ["name"] = "Turning Tide Battle Axe", ["collected"] = false },
                        },
                    },
                    {
                        ["setId"] = 801,
                        ["name"] = "Lucent Echoes",
                        ["category"] = "Trials",
                        ["subcategory"] = "Lucent Citadel",
                        ["categoryOrder"] = 4, ["subOrder"] = 12,
                        ["pieces"] =
                        {
                            { ["slot"] = "Chest",  ["type"] = "Light Chest", ["name"] = "Lucent Echoes Robe",  ["collected"] = false },
                            { ["slot"] = "Weapon", ["type"] = "Inferno Staff", ["name"] = "Lucent Echoes Inferno Staff", ["collected"] = true },
                        },
                    },
                    {
                        ["setId"] = 700,
                        ["name"] = "Ozezan the Inferno",
                        ["category"] = "Monster Sets",
                        ["categoryOrder"] = 6, ["subOrder"] = 0,
                        ["pieces"] =
                        {
                            { ["slot"] = "Head",      ["type"] = "Heavy Head",      ["name"] = "Ozezan the Inferno Helm",     ["collected"] = true },
                            { ["slot"] = "Shoulders", ["type"] = "Heavy Shoulders", ["name"] = "Ozezan the Inferno Pauldron", ["collected"] = false },
                        },
                    },
                    {
                        ["setId"] = 154,
                        ["name"] = "Slimecraw",
                        ["category"] = "Monster Sets",
                        ["categoryOrder"] = 6, ["subOrder"] = 0,
                        ["pieces"] =
                        {
                            { ["slot"] = "Head",      ["type"] = "Medium Head",      ["name"] = "Slimecraw Helmet",  ["collected"] = true },
                            { ["slot"] = "Shoulders", ["type"] = "Medium Shoulders", ["name"] = "Slimecraw Arm Cops", ["collected"] = true },
                        },
                    },
                    {
                        ["setId"] = 574,
                        ["name"] = "Pale Order",
                        ["category"] = "Mythic Items",
                        ["categoryOrder"] = 8, ["subOrder"] = 0,
                        ["pieces"] =
                        {
                            { ["slot"] = "Ring", ["type"] = "Ring", ["name"] = "Ring of the Pale Order", ["collected"] = true },
                        },
                    },
                    {
                        ["setId"] = 583,
                        ["name"] = "Spaulder of Ruin",
                        ["category"] = "Mythic Items",
                        ["categoryOrder"] = 8, ["subOrder"] = 0,
                        ["pieces"] =
                        {
                            { ["slot"] = "Shoulders", ["type"] = "Light Shoulders", ["name"] = "Spaulder of Ruin", ["collected"] = true },
                        },
                    },
                    {
                        ["setId"] = 356,
                        ["name"] = "Deadly Strike",
                        ["category"] = "Cyrodiil",
                        ["categoryOrder"] = 9, ["subOrder"] = 0,
                        ["pieces"] =
                        {
                            { ["slot"] = "Shoulders", ["type"] = "Medium Shoulders", ["name"] = "Deadly Arm Cops", ["collected"] = true },
                            { ["slot"] = "Hands",     ["type"] = "Medium Hands",     ["name"] = "Deadly Bracers",  ["collected"] = true },
                            { ["slot"] = "Necklace",  ["type"] = "Necklace",         ["name"] = "Deadly Necklace", ["collected"] = true },
                            { ["slot"] = "Weapon",    ["type"] = "Dagger",           ["name"] = "Deadly Dagger",   ["collected"] = true },
                            { ["slot"] = "Head",      ["type"] = "Medium Head",      ["name"] = "Deadly Helmet",   ["collected"] = false },
                        },
                    },
                },
                ["achievements"] =
                {
                    "Aetherian Archive Conqueror", "Aetherian Archive Vanquisher",
                    "Cloudrest Conqueror", "Cloudrest Hard Mode",
                    "Rockgrove Conqueror",
                    "Maelstrom Arena Conqueror", "Flawless Conqueror",
                    "Moongrave Fane Vanquisher", "Moongrave Fane Conqueror",
                },
                -- Structured records exactly as the addon exports them: name,
                -- description, points, completion, category and content all come
                -- straight from the game. The board is built from THIS, so
                -- completion is never inferred from a guessed name.
                ["achievementRecords"] =
                {
                    { ["id"] = 1001, ["name"] = "Aetherian Archive Conqueror", ["description"] = "Defeat the final boss of the Aetherian Archive.", ["points"] = 50, ["completed"] = true, ["category"] = "Trials", ["content"] = "Aetherian Archive" },
                    { ["id"] = 1002, ["name"] = "Aetherian Archive Vanquisher", ["description"] = "Defeat the final boss of Veteran Aetherian Archive with hard mode active.", ["points"] = 50, ["completed"] = true, ["category"] = "Trials", ["content"] = "Aetherian Archive" },
                    { ["id"] = 1003, ["name"] = "The Unchained", ["description"] = "Complete Veteran Aetherian Archive with hard mode active, without suffering a group member death, in under 30 minutes.", ["points"] = 50, ["completed"] = false, ["category"] = "Trials", ["content"] = "Aetherian Archive", ["title"] = "the Unchained" },

                    { ["id"] = 1010, ["name"] = "Cloudrest Conqueror", ["description"] = "Defeat Z'Maja in Cloudrest.", ["points"] = 50, ["completed"] = true, ["category"] = "Trials", ["content"] = "Cloudrest" },
                    { ["id"] = 1011, ["name"] = "Cloudrest Hard Mode", ["description"] = "Defeat Z'Maja in Veteran Cloudrest with all three Welkynars alive (hard mode).", ["points"] = 50, ["completed"] = true, ["category"] = "Trials", ["content"] = "Cloudrest" },
                    { ["id"] = 1012, ["name"] = "Immortal Redeemer", ["description"] = "Complete Veteran Cloudrest with hard mode active, without suffering a group member death, in under 30 minutes.", ["points"] = 50, ["completed"] = false, ["category"] = "Trials", ["content"] = "Cloudrest", ["title"] = "Immortal Redeemer" },

                    { ["id"] = 1020, ["name"] = "Rockgrove Conqueror", ["description"] = "Defeat Xalvakka in Rockgrove.", ["points"] = 50, ["completed"] = true, ["category"] = "Trials", ["content"] = "Rockgrove" },
                    { ["id"] = 1021, ["name"] = "Rockgrove Hard Mode", ["description"] = "Defeat Xalvakka in Veteran Rockgrove with hard mode active.", ["points"] = 50, ["completed"] = false, ["category"] = "Trials", ["content"] = "Rockgrove" },
                    { ["id"] = 1022, ["name"] = "Rockgrove Trifecta", ["description"] = "Complete Veteran Rockgrove with hard mode active, without suffering a group member death, in under 33 minutes.", ["points"] = 50, ["completed"] = false, ["category"] = "Trials", ["content"] = "Rockgrove", ["title"] = "Oxblood Reaper" },

                    { ["id"] = 2001, ["name"] = "Maelstrom Arena Conqueror", ["description"] = "Complete all nine arenas of Maelstrom Arena.", ["points"] = 50, ["completed"] = true, ["category"] = "Solo Arenas", ["content"] = "Maelstrom Arena" },
                    { ["id"] = 2002, ["name"] = "Flawless Conqueror", ["description"] = "Complete all nine arenas of Veteran Maelstrom Arena.", ["points"] = 50, ["completed"] = true, ["category"] = "Solo Arenas", ["content"] = "Maelstrom Arena", ["title"] = "the Flawless" },
                    { ["id"] = 2003, ["name"] = "Spirit Slayer", ["description"] = "Complete Veteran Maelstrom Arena with hard mode active on every arena, without dying, in under 42 minutes.", ["points"] = 50, ["completed"] = false, ["category"] = "Solo Arenas", ["content"] = "Maelstrom Arena", ["title"] = "Spirit Slayer" },

                    { ["id"] = 3001, ["name"] = "Moongrave Fane Vanquisher", ["description"] = "Defeat the final boss of Veteran Moongrave Fane.", ["points"] = 50, ["completed"] = true, ["category"] = "Dungeons", ["content"] = "Moongrave Fane" },
                    { ["id"] = 3002, ["name"] = "Moongrave Fane Conqueror", ["description"] = "Defeat all bosses in Veteran Moongrave Fane with hard mode active.", ["points"] = 50, ["completed"] = true, ["category"] = "Dungeons", ["content"] = "Moongrave Fane" },
                    { ["id"] = 3003, ["name"] = "Moongrave Fane Survivor", ["description"] = "Complete Veteran Moongrave Fane without suffering a group member death.", ["points"] = 50, ["completed"] = false, ["category"] = "Dungeons", ["content"] = "Moongrave Fane" },
                    { ["id"] = 3004, ["name"] = "Moongrave Fane Speed Run", ["description"] = "Complete Veteran Moongrave Fane in under 20 minutes.", ["points"] = 50, ["completed"] = false, ["category"] = "Dungeons", ["content"] = "Moongrave Fane" },
                    { ["id"] = 3005, ["name"] = "Moongrave Fane Trifecta", ["description"] = "Complete Veteran Moongrave Fane with hard mode active, without a group member death, in under 20 minutes.", ["points"] = 50, ["completed"] = false, ["category"] = "Dungeons", ["content"] = "Moongrave Fane", ["title"] = "Bahsei's Bane" },

                    { ["id"] = 3101, ["name"] = "Fungal Grotto I Vanquisher", ["description"] = "Defeat the final boss of Veteran Fungal Grotto I.", ["points"] = 10, ["completed"] = true, ["category"] = "Dungeons", ["content"] = "Fungal Grotto I" },
                },
            },
        },
    },
}
