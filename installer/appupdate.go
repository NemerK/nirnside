package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

/**
 * Headless mode changed the lifecycle: the server keeps running when the
 * window closes, so "the app is already up" can no longer mean "skip the
 * update" — a stale server would happily serve old code forever. These helpers
 * detect whether the running build is behind main, and stop it so the normal
 * launch flow can update, rebuild, and start it again.
 */

// True when the app code on disk (what the updater last applied) is behind
// main. Never blocks startup for long; any probe failure reads as "no update".
func updatePending(root, apiBase string) bool {
	if _, err := os.Stat(filepath.Join(root, ".git")); err == nil {
		return updatePendingGit(root)
	}
	return updatePendingZip(root, apiBase)
}

func updatePendingGit(root string) bool {
	if exec.Command("git", "-C", root, "fetch", "--quiet", "origin", "main").Run() != nil {
		return false
	}
	head, err1 := exec.Command("git", "-C", root, "rev-parse", "HEAD").Output()
	remote, err2 := exec.Command("git", "-C", root, "rev-parse", "origin/main").Output()
	if err1 != nil || err2 != nil {
		return false
	}
	h, r := strings.TrimSpace(string(head)), strings.TrimSpace(string(remote))
	return h != "" && h != r
}

func updatePendingZip(root, apiBase string) bool {
	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Get(apiBase + "/repos/" + updateRepo(root) + "/commits/" + updateRef(root))
	if err != nil {
		return false
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return false
	}
	var commit struct {
		Sha string `json:"sha"`
	}
	if json.NewDecoder(res.Body).Decode(&commit) != nil || commit.Sha == "" {
		return false
	}
	return commit.Sha != revisionSha(filepath.Join(root, revisionName))
}

/** The update channel ref (nirnside-channel.json), mirroring self-update.mjs. */
func updateRef(root string) string {
	if v := strings.TrimSpace(os.Getenv("NIRNSIDE_UPDATE_REF")); v != "" {
		return v
	}
	data, err := os.ReadFile(filepath.Join(root, "nirnside-channel.json"))
	if err == nil {
		var c struct {
			Ref string `json:"ref"`
		}
		if json.Unmarshal(data, &c) == nil && strings.TrimSpace(c.Ref) != "" {
			return c.Ref
		}
	}
	return "main"
}

/** Stop the running app so an update can take over the port. */
func stopRunningApp() {
	if !portBusy(appPort) {
		return
	}
	for _, pid := range listeningPIDs(appPort) {
		killProcessTree(pid)
	}
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		if !portBusy(appPort) {
			return
		}
		time.Sleep(200 * time.Millisecond)
	}
	fmt.Println("[launcher] the old server did not stop in time; continuing.")
}