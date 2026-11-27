import { getMeta, setMeta } from "./index";
import { normalizeProfile, type PartyProfile } from "../party/profile";

const KEY = "party-profile";

export function getPartyProfile(): PartyProfile {
  try {
    return normalizeProfile(getMeta(KEY));
  } catch {
    return normalizeProfile(null);
  }
}

export function setPartyProfile(input: unknown): PartyProfile {
  const profile = normalizeProfile(input);
  setMeta(KEY, profile);
  return profile;
}
