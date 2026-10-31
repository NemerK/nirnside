package main

import "fmt"

/**
 * Nirnside Launcher — the update layers, HoYoverse-style:
 *
 *   1. Launcher layer  (this exe)  — checks itself against the GitHub release
 *      and swaps/restarts independently of the app. It must never depend on
 *      app-repo code for its own update (that circularity once left machines
 *      stranded on a stale launcher).
 *   2. App layer      (repo main)  — updated by scripts/self-update.mjs, which
 *      the launcher runs, plus a rebuild whenever the code revision moved.
 *   3. Runtime layer  (node)       — installed on first run, rarely changes.
 *
 * Bump launcherVersion on launcher-side changes (launch flow, updater,
 * wizard). The release build stamps launcherCommit via ldflags.
 */
const launcherVersion = "1.0.0"

var launcherCommit = "dev"

func launcherBanner() string {
	return fmt.Sprintf("Nirnside Launcher %s (%s)", launcherVersion, launcherCommit)
}
