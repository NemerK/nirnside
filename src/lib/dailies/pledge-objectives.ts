/**
 * How an Undaunted pledge journal encodes Normal / Veteran / Hard Mode.
 *
 * WPamA does not track this. The in-game journal does, and it does not say
 * "Hard Mode" on most Death Challenges. UESP / live journal shape:
 *
 *   - Required: "Kill <boss>" (sometimes several)
 *   - Hidden:   "Enter <dungeon> in Veteran Mode"
 *   - Optional: the Death Challenge (Scroll of Glorious Battle, altar, …)
 *     which only appears after you enter Veteran
 *
 * Incomplete optionals are not unfinished combat. A missing optional step
 * after the required kills are done is a Normal clear, not "unknown forever".
 *
 * Mirrored in addon/NirnsideSnapshot/NirnsideSnapshot.lua journalPledgeObjectives.
 */

export interface PledgeObjective {
  text: string;
  done: boolean;
  /** Hidden journal step — usually the Veteran-enter objective. */
  hidden?: boolean;
  /** Optional / Death Challenge step — hard mode when complete. */
  optional?: boolean;
}

export interface InferredPledgeMode {
  difficulty: "normal" | "veteran" | null;
  hardMode: boolean | null;
  ready: boolean;
}

function lower(text: string): string {
  return text.toLowerCase();
}

export function isPledgeTurnInText(text: string): boolean {
  const t = lower(text);
  return t.includes("return") || t.includes("talk to");
}

export function isVeteranEnterObjective(obj: PledgeObjective): boolean {
  const t = lower(obj.text);
  if (isPledgeTurnInText(t)) return false;
  return t.includes("veteran");
}

export function isHardModeObjective(obj: PledgeObjective): boolean {
  const t = lower(obj.text);
  if (isPledgeTurnInText(t) || isVeteranEnterObjective(obj)) return false;
  if (t.includes("hard mode") || t.includes("hardmode") || t.includes("glorious battle")) {
    return true;
  }
  return obj.optional === true;
}

export function inferPledgeMode(objectives: PledgeObjective[]): InferredPledgeMode {
  let requiredDone = false;
  let requiredOpen = false;
  let sawVeteran = false;
  let veteranDone = false;
  let sawHm = false;
  let hmDone = false;

  for (const obj of objectives) {
    if (!obj.text.trim()) continue;
    if (isPledgeTurnInText(obj.text)) continue;
    if (isVeteranEnterObjective(obj)) {
      sawVeteran = true;
      if (obj.done) veteranDone = true;
      continue;
    }
    if (isHardModeObjective(obj)) {
      sawHm = true;
      if (obj.done) hmDone = true;
      continue;
    }
    if (obj.hidden) {
      // Other hidden rows are not required combat.
      continue;
    }
    if (obj.done) requiredDone = true;
    else requiredOpen = true;
  }

  const ready = (requiredDone && !requiredOpen) || objectives.some((o) => o.done && isPledgeTurnInText(o.text));

  if (hmDone) {
    return { difficulty: "veteran", hardMode: true, ready };
  }
  if (veteranDone || sawHm) {
    // Optional Death Challenge only appears after entering Veteran.
    return { difficulty: "veteran", hardMode: false, ready };
  }
  if (ready && !veteranDone && !sawHm) {
    // Required kills done, no Veteran-enter and no Death Challenge → Normal.
    // If we never saw a Veteran row, "ready" still means the pledge can be
    // turned in; a Normal clear never grows those extra steps.
    if (sawVeteran || requiredDone) {
      return { difficulty: "normal", hardMode: false, ready };
    }
  }
  return { difficulty: null, hardMode: null, ready };
}
