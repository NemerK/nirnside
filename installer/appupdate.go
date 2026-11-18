package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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

// True when this install is behind main. The public commit feed is asked
// first: the REST API allows 60 requests an hour, and a refusal used to make
// a reopen look like "already up to date" while the old server kept running.
func updatePending(root, apiBase string) bool {
	if sha, ok := remoteZipSha(apiBase, updateRepo(root), updateRef(root)); ok {
		return installBehind(root, sha)
	}
	if _, err := os.Stat(filepath.Join(root, ".git")); err == nil {
		return updatePendingGit(root)
	}
	return false
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
	sha, ok := remoteZipSha(apiBase, updateRepo(root), updateRef(root))
	if !ok {
		return false
	}
	return installBehind(root, sha)
}

/** A running install is behind when its recorded commit, or the build it compiled, is not main. */
func installBehind(root, remote string) bool {
	if _, err := os.Stat(filepath.Join(root, ".git")); err == nil {
		if out, err := exec.Command("git", "-C", root, "rev-parse", "HEAD").Output(); err == nil {
			head := strings.TrimSpace(string(out))
			if head != "" {
				if !sameCommit(head, remote) {
					return true
				}
				built := builtRevision(root)
				return built != "" && !sameCommit(built, remote)
			}
		}
	}
	if !sameCommit(revisionSha(filepath.Join(root, revisionName)), remote) {
		return true
	}
	built := builtRevision(root)
	return built != "" && !sameCommit(built, remote)
}

func builtRevision(root string) string {
	data, err := os.ReadFile(filepath.Join(root, ".next", builtRevisionName))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func sameCommit(local, remote string) bool {
	local, remote = strings.TrimSpace(local), strings.TrimSpace(remote)
	if local == "" || remote == "" {
		return false
	}
	if local == remote {
		return true
	}
	shorter, longer := local, remote
	if len(shorter) > len(longer) {
		shorter, longer = longer, shorter
	}
	return len(shorter) >= 7 && strings.HasPrefix(longer, shorter)
}

var commitFeed = func(repo, ref string) (string, error) {
	if !feedNameOK(repo) || !feedNameOK(ref) {
		return "", fmt.Errorf("bad update channel")
	}
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, "https://github.com/"+repo+"/commits/"+ref+".atom", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "NirnsideInstaller")
	req.Header.Set("Accept", "application/atom+xml")
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("commit feed %d", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", err
	}
	return string(body), nil
}

var commitInFeed = regexp.MustCompile(`Grit::Commit/([0-9a-fA-F]{40})`)

func shaFromFeed(body string) string {
	match := commitInFeed.FindStringSubmatch(body)
	if match == nil {
		return ""
	}
	return strings.ToLower(match[1])
}

func feedNameOK(value string) bool {
	if value == "" || strings.Contains(value, "..") {
		return false
	}
	slashes := 0
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '_' || r == '-':
		case r == '/':
			slashes++
			if slashes > 1 {
				return false
			}
		default:
			return false
		}
	}
	return true
}

/** The commit the next launch would apply. The public feed does not share the REST API allowance. */
func remoteZipSha(apiBase, repo, ref string) (string, bool) {
	if body, err := commitFeed(repo, ref); err == nil {
		if sha := shaFromFeed(body); sha != "" {
			return sha, true
		}
	}
	client := &http.Client{Timeout: 10 * time.Second}
	res, err := client.Get(apiBase + "/repos/" + repo + "/commits/" + ref)
	if err != nil {
		return "", false
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusForbidden || res.StatusCode == http.StatusTooManyRequests {
		body, feedErr := commitFeed(repo, ref)
		if feedErr != nil {
			return "", false
		}
		if sha := shaFromFeed(body); sha != "" {
			return sha, true
		}
		return "", false
	}
	if res.StatusCode != http.StatusOK {
		return "", false
	}
	var commit struct {
		Sha string `json:"sha"`
	}
	if json.NewDecoder(res.Body).Decode(&commit) != nil {
		return "", false
	}
	sha := strings.TrimSpace(commit.Sha)
	return sha, sha != ""
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
