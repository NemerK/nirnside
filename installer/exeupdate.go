package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

/**
 * The launcher layer: Nirnside.exe keeps itself current straight from the
 * GitHub release, with zero involvement from app-repo code. The published exe
 * is verified against the release API's sha256 digest before it is trusted,
 * then swapped in with a rename (a running exe can be renamed but not
 * overwritten on Windows) and the launcher restarts itself — the running
 * image is unaffected, the fresh one takes over immediately.
 */

const defaultUpdateRepo = "NemerK/nirnside"

type releaseAsset struct {
	Name               string `json:"name"`
	Digest             string `json:"digest"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type releaseInfo struct {
	Assets []releaseAsset `json:"assets"`
}

func updateRepo(root string) string {
	if v := strings.TrimSpace(os.Getenv("NIRNSIDE_UPDATE_REPO")); v != "" {
		return v
	}
	data, err := os.ReadFile(filepath.Join(root, "nirnside-channel.json"))
	if err == nil {
		var c struct {
			Repo string `json:"repo"`
		}
		if json.Unmarshal(data, &c) == nil && strings.TrimSpace(c.Repo) != "" {
			return c.Repo
		}
	}
	return defaultUpdateRepo
}

func fileSHA256(path string) (string, error) {
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

// A short human status, printed by the caller. Empty string means "nothing to
// report" (skipped or offline) — a launcher check must never block startup.
func checkLauncherUpdate(root, apiBase string) (status string, restart bool) {
	exePath, err := os.Executable()
	if err != nil {
		return "", false
	}
	return checkLauncherUpdateAt(exePath, root, apiBase)
}

func checkLauncherUpdateAt(exePath, root, apiBase string) (status string, restart bool) {
	client := newHTTPClient()
	res, err := client.Get(apiBase + "/repos/" + updateRepo(root) + "/releases/latest")
	if err != nil {
		return "check skipped (offline?) — keeping this launcher.", false
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Sprintf("check skipped (GitHub %d) — keeping this launcher.", res.StatusCode), false
	}
	var rel releaseInfo
	if err := json.NewDecoder(res.Body).Decode(&rel); err != nil {
		return "check skipped (bad release data) — keeping this launcher.", false
	}
	var asset *releaseAsset
	for i := range rel.Assets {
		if rel.Assets[i].Name == "Nirnside.exe" {
			asset = &rel.Assets[i]
			break
		}
	}
	expected := strings.ToLower(strings.TrimPrefix(asset.Digest, "sha256:"))
	if asset == nil || expected == "" || asset.BrowserDownloadURL == "" {
		return "up to date (release publishes no launcher).", false
	}
	local, _ := fileSHA256(exePath)
	if local == expected {
		return "up to date.", false
	}

	tmpPath := exePath + ".new"
	if err := downloadFile(client, asset.BrowserDownloadURL, tmpPath, nil); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Sprintf("update download failed — keeping this launcher. (%v)", err), false
	}
	got, err := fileSHA256(tmpPath)
	if err != nil || got != expected {
		_ = os.Remove(tmpPath)
		return "downloaded launcher failed its checksum — keeping the current one.", false
	}
	oldPath := exePath + ".old"
	_ = os.Remove(oldPath)
	if err := os.Rename(exePath, oldPath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Sprintf("could not swap the launcher in place. (%v)", err), false
	}
	if err := os.Rename(tmpPath, exePath); err != nil {
		_ = os.Rename(oldPath, exePath) // put the working launcher back
		return fmt.Sprintf("could not swap the launcher in place. (%v)", err), false
	}
	_ = os.Remove(oldPath)
	return "updated — restarting into the new launcher…", true
}

/**
 * When the launcher is run from outside an install (a fresh download), copy
 * itself over the install's Nirnside.exe so the desktop shortcut starts the
 * new launcher from now on. Safe to call every launch: it compares bytes and
 * does nothing when the install already has this exact launcher.
 */
func syncLauncherIntoInstall(root string) (copied bool) {
	exePath, err := os.Executable()
	if err != nil {
		return false
	}
	return syncLauncherIntoInstallAt(exePath, root)
}

func syncLauncherIntoInstallAt(exePath, root string) (copied bool) {
	target := filepath.Join(root, "Nirnside.exe")
	absExe, _ := filepath.Abs(exePath)
	absTarget, _ := filepath.Abs(target)
	if strings.EqualFold(absExe, absTarget) {
		return false
	}
	if _, err := os.Stat(target); err != nil {
		return false // fresh install: runInstall's copySelf handles it
	}
	a, errA := fileSHA256(exePath)
	b, errB := fileSHA256(target)
	if errA != nil || errB != nil || a == b {
		return false
	}
	if err := copySelfFrom(exePath, root); err != nil {
		fmt.Printf("[launcher] could not copy the new launcher into %s: %v\n", root, err)
		return false
	}
	fmt.Printf("[launcher] copied into %s — your shortcut starts the new launcher now.\n", root)
	return true
}

/**
 * Sweep leftover self-update artifacts. The swap that updates a running exe
 * renames it to Nirnside.exe.old; Windows refuses to delete the image of a
 * running process, so the file could only linger until now. Also removes
 * aborted .new downloads. Best effort — locked files are simply retried next
 * start.
 */
func cleanupSwapArtifacts(dir string) {
	_ = os.Remove(filepath.Join(dir, "Nirnside.exe.old"))
	_ = os.Remove(filepath.Join(dir, "Nirnside.exe.new"))
}

/**
 * After an in-place swap, hand over to the fresh launcher immediately. Safe at
 * this point in startup: nothing is assigned to the job object yet, so exiting
 * the old process cannot kill the new one, and the console window carries over.
 */
func restartLauncher(exePath string, args ...string) {
	cmd := exec.Command(exePath, args...)
	cmd.Env = append(os.Environ(), "NIRNSIDE_LAUNCHER_CHECKED=1")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Start(); err != nil {
		fmt.Println("[launcher] could not restart automatically — start Nirnside again for the new launcher.", err)
		return
	}
	os.Exit(0)
}
