package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

/**
 * Ready-built app ("bundle"). GitHub builds Nirnside once per release on
 * Windows and publishes it as nirnside-win-x64.zip plus a small manifest. The
 * launcher downloads it, checks its SHA-256, swaps it into <install>/app and
 * runs it with the private Node runtime. Nothing is compiled or installed with
 * npm on the player's PC, and player data lives in <install>/data, which an
 * update never touches.
 *
 *   <install>/
 *     Nirnside.exe   the launcher
 *     runtime/       private Node.js
 *     app/           the ready-built app, replaced whole on update
 *     data/          nirnside.db, pictures, dropped files, icon cache
 */

const (
	bundleZipName      = "nirnside-win-x64.zip"
	bundleManifestName = "nirnside-win-x64.json"
	bundleInfoName     = "nirnside-build.json"
)

type bundleManifest struct {
	Sha    string `json:"sha"`
	Node   string `json:"node"`
	Sha256 string `json:"sha256"`
	Size   int64  `json:"size"`
}

func appDir(root string) string { return filepath.Join(root, "app") }

func appServer(root string) string { return filepath.Join(appDir(root), "server.js") }

/** True when <install>/app holds a ready-built app the launcher can run. */
func hasBundle(root string) bool {
	_, err := os.Stat(appServer(root))
	return err == nil
}

/** The commit the installed ready-built app was made from, or "". */
func installedBundleSha(root string) string {
	data, err := os.ReadFile(filepath.Join(appDir(root), bundleInfoName))
	if err != nil {
		return ""
	}
	var info struct {
		Sha string `json:"sha"`
	}
	if json.Unmarshal(data, &info) != nil {
		return ""
	}
	return strings.TrimSpace(info.Sha)
}

/** Release download base for this install's update channel. Overridable for tests. */
var bundleBaseURL = func(root string) string {
	if v := strings.TrimRight(strings.TrimSpace(os.Getenv("NIRNSIDE_BUNDLE_URL")), "/"); v != "" {
		return v
	}
	return "https://github.com/" + updateRepo(root) + "/releases/download/latest"
}

func fetchBundleManifest(client *http.Client, root string) (bundleManifest, error) {
	var man bundleManifest
	req, err := http.NewRequest(http.MethodGet, bundleBaseURL(root)+"/"+bundleManifestName, nil)
	if err != nil {
		return man, err
	}
	req.Header.Set("User-Agent", "NirnsideInstaller")
	req.Header.Set("Cache-Control", "no-cache")
	res, err := client.Do(req)
	if err != nil {
		return man, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return man, fmt.Errorf("release manifest: %s", res.Status)
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<16)).Decode(&man); err != nil {
		return man, fmt.Errorf("release manifest: %w", err)
	}
	if man.Sha == "" || len(man.Sha256) != 64 || !strings.HasPrefix(man.Node, "v") {
		return man, fmt.Errorf("release manifest is incomplete")
	}
	return man, nil
}

func fileSha256Hex(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

/** Version of the private runtime ("v24.11.1"), or "" when missing or broken. */
func runtimeVersion(root string) string {
	node := runtimeNode(root)
	if _, err := os.Stat(node); err != nil {
		return ""
	}
	cmd := exec.Command(node, "-v")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

/**
 * Make sure the private runtime can run the app. An existing Node 22 or newer
 * is kept (the app only needs Node-API, which is stable across versions);
 * otherwise the exact version the release was built and tested with is
 * downloaded and swapped in.
 */
func (in *installer) ensureRuntime(root, want string, log io.Writer) error {
	if have := runtimeVersion(root); have != "" && majorVersion(have) >= 22 {
		return nil
	}
	in.progress(15, "Downloading the app runtime", "A private Node.js copy for Nirnside only — not a system install.")
	zipPath := filepath.Join(root, "nirnside-node.zip")
	if err := downloadFile(in.client, nodeZipURL(want), zipPath, nil); err != nil {
		_ = os.Remove(zipPath)
		return fmt.Errorf("could not download the app runtime: %w", err)
	}
	defer os.Remove(zipPath)
	staging := filepath.Join(root, "runtime.new")
	_ = os.RemoveAll(staging)
	if err := extractZip(zipPath, staging, nil); err != nil {
		_ = os.RemoveAll(staging)
		return fmt.Errorf("could not unpack the app runtime: %w", err)
	}
	if err := swapDir(filepath.Join(root, "runtime"), staging); err != nil {
		return fmt.Errorf("could not install the app runtime: %w", err)
	}
	_, _ = fmt.Fprintf(log, "[launcher] runtime %s installed\n", want)
	return nil
}

/** Replace dir with staging. The old copy is removed, or left as dir.old for the next start to clear. */
func swapDir(dir, staging string) error {
	old := dir + ".old"
	_ = os.RemoveAll(old)
	if _, err := os.Stat(dir); err == nil {
		var renameErr error
		for i := 0; i < 20; i++ { // Windows keeps a just-stopped process's files locked for a moment.
			if renameErr = os.Rename(dir, old); renameErr == nil {
				break
			}
			time.Sleep(250 * time.Millisecond)
		}
		if renameErr != nil {
			_ = os.RemoveAll(staging)
			return renameErr
		}
	}
	if err := os.Rename(staging, dir); err != nil {
		_ = os.Rename(old, dir) // put the working copy back
		return err
	}
	_ = os.RemoveAll(old)
	return nil
}

/**
 * Download, verify and swap in the release's ready-built app. The running app
 * must already be stopped: Windows locks the database engine's .node file.
 */
func (in *installer) installBundle(root string, man bundleManifest, log io.Writer) error {
	if err := in.ensureRuntime(root, man.Node, log); err != nil {
		return err
	}
	in.progress(35, "Downloading Nirnside", fmt.Sprintf("Version %s, ready to run.", shortSha(man.Sha)))
	zipPath := filepath.Join(root, "nirnside-app.zip")
	total := man.Size
	err := downloadFile(in.client, bundleBaseURL(root)+"/"+bundleZipName, zipPath, func(n int64) {
		if total > 0 {
			in.progress(35+int(45*n/total), "Downloading Nirnside", fmt.Sprintf("%d of %d MB", n>>20, total>>20))
		}
	})
	if err != nil {
		_ = os.Remove(zipPath)
		return fmt.Errorf("could not download Nirnside: %w", err)
	}
	defer os.Remove(zipPath)
	got, err := fileSha256Hex(zipPath)
	if err != nil || !strings.EqualFold(got, man.Sha256) {
		return fmt.Errorf("the Nirnside download was damaged (checksum mismatch). Try again")
	}
	in.progress(82, "Unpacking Nirnside", "")
	staging := appDir(root) + ".new"
	_ = os.RemoveAll(staging)
	if err := extractZip(zipPath, staging, nil); err != nil {
		_ = os.RemoveAll(staging)
		return fmt.Errorf("could not unpack Nirnside: %w", err)
	}
	if _, err := os.Stat(filepath.Join(staging, "server.js")); err != nil {
		_ = os.RemoveAll(staging)
		return fmt.Errorf("the Nirnside download is incomplete")
	}
	stopRunningApp()
	if err := swapDir(appDir(root), staging); err != nil {
		return fmt.Errorf("could not replace the old version (is another Nirnside still open?): %w", err)
	}
	_ = os.MkdirAll(filepath.Join(root, "data"), 0o755)
	_, _ = fmt.Fprintf(log, "[launcher] installed ready-built Nirnside %s\n", man.Sha)
	return nil
}

func shortSha(s string) string {
	if len(s) > 7 {
		return s[:7]
	}
	return s
}

/**
 * Bring <install>/app to the latest release. Offline or a missing manifest
 * keeps whatever is installed. Returns false when there is no ready-built app
 * to run (the caller then uses the older source install path).
 */
func (in *installer) updateBundle(root string, log io.Writer) (bool, error) {
	in.progress(10, "Checking for updates", "")
	man, err := fetchBundleManifest(in.client, root)
	if err != nil {
		_, _ = fmt.Fprintf(log, "[launcher] no ready-built release: %v\n", err)
		return hasBundle(root), nil
	}
	if hasBundle(root) && sameCommit(installedBundleSha(root), man.Sha) {
		return true, nil
	}
	if err := in.installBundle(root, man, log); err != nil {
		if hasBundle(root) {
			// Keep playing on the installed version; the next start retries.
			_, _ = fmt.Fprintf(log, "[launcher] update failed, starting the installed version: %v\n", err)
			return true, nil
		}
		return false, err
	}
	return true, nil
}

/** True when a ready-built release newer than the installed one is published. */
func bundleUpdatePending(root string) bool {
	if !hasBundle(root) {
		return false
	}
	man, err := fetchBundleManifest(newHTTPClient(), root)
	if err != nil {
		return false
	}
	return !sameCommit(installedBundleSha(root), man.Sha)
}

/** Start the ready-built server: <runtime>/node app/server.js, data in <install>/data. */
func startBundle(log *os.File, root string) (*exec.Cmd, error) {
	env := runtimeEnv(root)
	env = append(env,
		"PORT="+fmt.Sprint(appPort),
		"NODE_ENV=production",
		"NIRNSIDE_DB="+filepath.Join(root, "data", "nirnside.db"),
		"NIRNSIDE_INSTALL_ROOT="+root,
	)
	if launcherBase != "" {
		env = append(env, "NIRNSIDE_LAUNCHER_URL="+launcherBase)
	}
	cmd := exec.Command(runtimeNode(root), appServer(root))
	cmd.Dir = appDir(root)
	cmd.Env = env
	if log != nil {
		cmd.Stdout = log
		cmd.Stderr = log
	}
	hideWindow(cmd)
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	assignToJob(cmd)
	return cmd, nil
}

// Files and folders a source install kept at the top of the install folder.
// Once the ready-built app runs, they are dead weight (several hundred MB).
var legacyInstallEntries = []string{
	".next", "node_modules", "src", "scripts", "public", "addon", "installer",
	".cursor", ".github", "docs",
	"package.json", "package-lock.json", "tsconfig.json", "tsconfig.tsbuildinfo",
	"next.config.ts", "next-env.d.ts", "postcss.config.mjs", "eslint.config.mjs",
	".npmrc", "AGENTS.md", "CLAUDE.md", "README.md", "START-HERE.txt",
	"start-nirnside.cmd", "start-nirnside.sh",
	".nirnside-need-build", ".nirnside-revision", ".nirnside-restart",
}

/**
 * Remove a source install's leftovers after the ready-built app is running.
 * Never touches data/, runtime/, app/, the launcher or its log, and never runs
 * in a git checkout (a developer's working copy).
 */
func cleanupLegacyInstall(root string) {
	if !hasBundle(root) {
		return
	}
	if _, err := os.Stat(filepath.Join(root, ".git")); err == nil {
		return
	}
	for _, name := range legacyInstallEntries {
		_ = os.RemoveAll(filepath.Join(root, name))
	}
	for _, name := range []string{"app.old", "app.new", "runtime.old", "runtime.new"} {
		_ = os.RemoveAll(filepath.Join(root, name))
	}
}
