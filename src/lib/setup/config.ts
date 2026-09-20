import { getMeta, setMeta } from "../db";

/**
 * Paths the user chose in Setup. Survives restarts (stored in the local DB).
 * Environment variables still win when set — they're the power-user override.
 */
export interface UserSetupConfig {
  /** Absolute path to the "Elder Scrolls Online" folder, or an env folder (live / liveeu). */
  esoDir?: string;
  /** Absolute path to a specific NirnsideSnapshot.lua the user pointed at. */
  snapshotFile?: string;
}

const KEY = "userSetup";

export function getUserConfig(): UserSetupConfig {
  try {
    return getMeta<UserSetupConfig>(KEY) ?? {};
  } catch {
    return {};
  }
}

export function setUserConfig(next: UserSetupConfig): UserSetupConfig {
  const cleaned: UserSetupConfig = {};
  if (next.esoDir) cleaned.esoDir = next.esoDir;
  if (next.snapshotFile) cleaned.snapshotFile = next.snapshotFile;
  setMeta(KEY, cleaned);
  return cleaned;
}

export function clearUserConfig(): void {
  setMeta(KEY, {});
}
