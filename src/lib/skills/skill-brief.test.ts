import assert from "node:assert/strict";
import test from "node:test";
import { briefsFromLore, collectSkillBriefs, lookupSkillBrief, skillTip } from "./skill-brief";

const catalog = [
  { name: "Grim Focus", description: "Channel a shadow.", source: "reference" as const },
  { name: "Merciless Resolve", description: "Fire a spectral bow.", source: "reference" as const },
  { name: "Swallow Soul", description: "", source: "reference" as const },
];

test("snapshot description replaces catalog text and empty snapshot text does not", () => {
  const briefs = collectSkillBriefs(catalog, [
    { name: "grim focus", description: "  In-game focus.  " },
    { name: "Swallow Soul", description: "   " },
  ]);
  const focus = lookupSkillBrief(briefs, "GRIM FOCUS");
  assert.equal(focus?.description, "In-game focus.");
  assert.equal(focus?.source, "ingame");
  assert.equal(focus?.name, "grim focus");
  assert.equal(lookupSkillBrief(briefs, "Merciless Resolve")?.description, "Fire a spectral bow.");
  assert.equal(lookupSkillBrief(briefs, "Swallow Soul"), null);
});

test("lookup is the exact skill name", () => {
  const briefs = collectSkillBriefs(catalog, []);
  assert.equal(lookupSkillBrief(briefs, "Resolve"), null);
  assert.equal(lookupSkillBrief(briefs, "Merciless"), null);
  assert.equal(lookupSkillBrief(briefs, "  merciless resolve "), briefs[1]);
});

test("a description on the skill itself wins over the catalog", () => {
  const briefs = collectSkillBriefs(catalog, []);
  const shown = skillTip(briefs, {
    name: "Grim Focus",
    description: "|cffffffDeals damage.|r",
    source: "ingame",
  });
  assert.equal(shown?.description, "|cffffffDeals damage.|r");
  assert.equal(shown?.source, "ingame");
  assert.equal(skillTip(briefs, { name: "Merciless Resolve" })?.source, "reference");
  assert.equal(skillTip(briefs, { name: "Unknown Skill" })?.description, "");
  assert.equal(skillTip(briefs, { name: "  " }), null);
});

test("lore briefs keep the display name and let a snapshot overwrite", () => {
  const lore = new Map([["grim focus", { description: "Catalog focus.", source: "community" as const }]]);
  const briefs = briefsFromLore(["Grim Focus", "Grim Focus", ""], lore, [
    { name: "Grim Focus", description: "Snapshot focus." },
  ]);
  assert.equal(briefs.length, 1);
  assert.equal(briefs[0]?.name, "Grim Focus");
  assert.equal(briefs[0]?.description, "Snapshot focus.");
  assert.equal(briefs[0]?.source, "ingame");
});
