import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { getAutoSetup, getDataSource } from "../db/queries";
import { getUserConfig } from "./config";
import { getUpdateInfo, type UpdateInfo } from "./update-info";
import { defaultBrowsePath } from "./browse";
import {
  CATALOG_FILENAME,
  SNAPSHOT_FILENAME,
  candidatePaths,
  envFolders,
  esoRoots,
  incomingCatalogPath,
  incomingPath,
  locateSnapshot,
  seesWindowsDocuments,
} from "../snapshot/locate";

export interface DetectedInstall {
  root: string;
  envs: { name: string; snapshot: boolean; catalog: boolean; addOns: string }[];
}

export interface SetupStatus {
  config: ReturnType<typeof getUserConfig>;
  dataSource: ReturnType<typeof getDataSource>;
  autoSetup: ReturnType<typeof getAutoSetup>;
  detected: DetectedInstall[];
  snapshotFound: boolean;
  catalogFound: boolean;
  catalogPath: string | null;
  incomingSnapshot: boolean;
  incomingCatalog: boolean;
  lookingIn: string[];
  update: UpdateInfo;
  /** Node's home on the machine running Nirnside — not the browser's OS. */
  serverHome: string;
  serverPlatform: NodeJS.Platform;
  /** True when this process can see Windows (or macOS) Documents, including WSL mounts. */
  onGamingPc: boolean;
  browseStart: string;
}

export function getSetupStatus(): SetupStatus {
  const snap = locateSnapshot(false);
  const catalogNextToSnap = snap ? join(dirname(snap.path), CATALOG_FILENAME) : null;
  const catalogPath = [
    process.env.NIRNSIDE_CATALOG_FILE,
    incomingCatalogPath(),
    catalogNextToSnap,
  ].find((p): p is string => !!p && existsSync(p));

  const detected: DetectedInstall[] = esoRoots().map((root) => ({
    root,
    envs: envFolders(root).map((env) => {
      const envPath = join(root, env);
      const addOns = join(envPath, "AddOns");
      return {
        name: env || basename(root),
        snapshot: existsSync(join(envPath, "SavedVariables", SNAPSHOT_FILENAME)),
        catalog: existsSync(join(envPath, "SavedVariables", CATALOG_FILENAME)),
        addOns,
      };
    }),
  }));

  return {
    config: getUserConfig(),
    dataSource: getDataSource(),
    autoSetup: getAutoSetup(),
    detected,
    snapshotFound: !!snap,
    catalogFound: !!catalogPath,
    catalogPath: catalogPath ?? null,
    incomingSnapshot: existsSync(incomingPath()),
    incomingCatalog: existsSync(incomingCatalogPath()),
    lookingIn: candidatePaths(),
    update: getUpdateInfo(),
    serverHome: homedir(),
    serverPlatform: process.platform,
    onGamingPc: process.platform === "win32" || process.platform === "darwin" || seesWindowsDocuments(),
    browseStart: defaultBrowsePath(),
  };
}
