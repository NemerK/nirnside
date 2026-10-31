package main

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestSkipExtract(t *testing.T) {
	if !skipExtract("runtime/node.exe") {
		t.Fatal("runtime must be skipped")
	}
	if !skipExtract("Nirnside.exe") {
		t.Fatal("exe must be skipped")
	}
	if !skipExtract("data/nirnside.db") {
		t.Fatal("account db must be skipped")
	}
	if !skipExtract("data/incoming/NirnsideSnapshot.lua") {
		t.Fatal("incoming lua must be skipped")
	}
	if skipExtract("src/lib/db/index.ts") {
		t.Fatal("app source must be extracted")
	}
	if skipExtract(".npmrc") {
		t.Fatal(".npmrc must be extracted")
	}
}

func TestExtractZipFlattensSingleRootAndProtectsData(t *testing.T) {
	dir := t.TempDir()
	zipPath := filepath.Join(dir, "app.zip")
	z, err := os.Create(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(z)
	add := func(name, body string) {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	add("nirnside-main/src/app.txt", "new")
	add("nirnside-main/data/nirnside.db", "SHOULD-NOT-LAND")
	add("nirnside-main/.npmrc", "ignore-scripts=true\n")
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	_ = z.Close()

	dest := filepath.Join(dir, "dest")
	if err := os.MkdirAll(filepath.Join(dest, "data"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dest, "data", "nirnside.db"), []byte("MINE"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := extractZip(zipPath, dest, skipExtract); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(dest, "src", "app.txt"))
	if err != nil || string(got) != "new" {
		t.Fatalf("app file: %s %v", got, err)
	}
	db, err := os.ReadFile(filepath.Join(dest, "data", "nirnside.db"))
	if err != nil || string(db) != "MINE" {
		t.Fatalf("account db overwritten: %s %v", db, err)
	}
	npmrc, err := os.ReadFile(filepath.Join(dest, ".npmrc"))
	if err != nil || string(npmrc) != "ignore-scripts=true\n" {
		t.Fatalf(".npmrc: %s %v", npmrc, err)
	}
}

func TestSafeJoinRejectsZipSlip(t *testing.T) {
	dest := t.TempDir()
	if _, err := safeJoin(dest, "../outside.txt"); err == nil {
		t.Fatal("expected zip-slip reject")
	}
}

func TestDestAllowedRejectsWindows(t *testing.T) {
	if err := destAllowed(`C:\Windows\System32\nirnside`); err == nil {
		t.Fatal("expected reject")
	}
}

func TestPickNodeLTS(t *testing.T) {
	got := pickNodeLTS([]nodeRelease{
		{Version: "v24.1.0", LTS: false, Files: []string{"win-x64-zip"}},
		{Version: "v22.19.0", LTS: "Jod", Files: []string{"win-x64-zip"}},
		{Version: "v20.18.0", LTS: "Iron", Files: []string{"win-x64-zip"}},
	})
	if got != "v22.19.0" {
		t.Fatalf("got %s", got)
	}
	if pickNodeLTS(nil) != fallbackNodeVersion {
		t.Fatal("empty index should use fallback")
	}
}

func TestSetPathEnv(t *testing.T) {
	env := []string{"FOO=1", "Path=old"}
	got := setPathEnv(env, "runtime;old")
	if got[1] != "Path=runtime;old" {
		t.Fatalf("%v", got)
	}
}

func TestTailFile(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "log.txt")
	if tailFile(p, 100) != "" {
		t.Fatal("missing file")
	}
	if err := os.WriteFile(p, []byte("hello-nirnside"), 0o644); err != nil {
		t.Fatal(err)
	}
	if tailFile(p, 100) != "hello-nirnside" {
		t.Fatalf("%q", tailFile(p, 100))
	}
}

func TestPortBusy(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	port := ln.Addr().(*net.TCPAddr).Port
	if !portBusy(port) {
		t.Fatal("expected busy")
	}
}

func TestParseListeningPIDs(t *testing.T) {
	out := `
  TCP    127.0.0.1:43219        0.0.0.0:0              LISTENING       18724
  TCP    [::1]:43219            [::]:0                 LISTENING       18724
  TCP    127.0.0.1:43219        127.0.0.1:51234        ESTABLISHED     99
  TCP    127.0.0.1:443219       0.0.0.0:0              LISTENING       7
`
	got := parseListeningPIDs(out, 43219)
	if len(got) != 1 || got[0] != 18724 {
		t.Fatalf("%v", got)
	}
}

func TestReclaimAppPortWhenFree(t *testing.T) {
	if portBusy(appPort) {
		t.Skip("43219 is already in use on this host")
	}
	if err := reclaimAppPort(); err != nil {
		t.Fatal(err)
	}
}

func TestLooksLikeNirnsideWhenNothingListens(t *testing.T) {
	if looksLikeNirnside() {
		t.Fatal("nothing should be serving Nirnside on this test host")
	}
}

func TestNeedBuild(t *testing.T) {
	dir := t.TempDir()
	if !needBuild(dir) {
		t.Fatal("missing .next should need a build")
	}
	if err := os.MkdirAll(filepath.Join(dir, ".next"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".next", "BUILD_ID"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if needBuild(dir) {
		t.Fatal("existing BUILD_ID should skip build")
	}
	if err := os.WriteFile(filepath.Join(dir, needBuildName), []byte("1\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !needBuild(dir) {
		t.Fatal("need-build flag should force a rebuild")
	}
}

func TestNeedBuildRevisionStamp(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, ".next"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".next", "BUILD_ID"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Never-updated installs have no revision file: old behavior.
	if needBuild(dir) {
		t.Fatal("no revision file should keep the old behavior")
	}

	// An applied update that was never stamped into the build is stale.
	if err := os.WriteFile(filepath.Join(dir, revisionName), []byte(`{"sha":"abc123"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if !needBuild(dir) {
		t.Fatal("an unstamped code revision must force a rebuild")
	}

	// Matching stamp: fresh.
	if err := os.WriteFile(filepath.Join(dir, ".next", builtRevisionName), []byte("abc123"), 0o644); err != nil {
		t.Fatal(err)
	}
	if needBuild(dir) {
		t.Fatal("a matching revision stamp should skip the build")
	}

	// The revision moved on: stale again, and stamping brings it back.
	if err := os.WriteFile(filepath.Join(dir, revisionName), []byte(`{"sha":"def456"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if !needBuild(dir) {
		t.Fatal("a moved revision must force a rebuild")
	}
	stampBuiltRevision(dir)
	stamped, err := os.ReadFile(filepath.Join(dir, ".next", builtRevisionName))
	if err != nil || strings.TrimSpace(string(stamped)) != "def456" {
		t.Fatalf("buildApp should stamp the revision it compiled, got %q", string(stamped))
	}
	if needBuild(dir) {
		t.Fatal("a stamped revision should skip the build")
	}
}

func TestProbeAppHealth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"ok":true,"app":"nirnside"}`))
			return
		}
		http.Error(w, "slow", http.StatusGatewayTimeout)
	}))
	defer srv.Close()
	if !probeApp(srv.URL) {
		t.Fatal("health probe should treat /api/health as ready")
	}
}

func TestWaitReadyFailsWhenProcessExits(t *testing.T) {
	cmd := exec.Command("false")
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	err := waitReady("http://127.0.0.1:1/", cmd, 5*time.Second, nil)
	if err == nil || !strings.Contains(err.Error(), "exited") {
		t.Fatalf("expected process-exit error, got %v", err)
	}
}

func TestLooksInstalled(t *testing.T) {
	dir := t.TempDir()
	if looksInstalled(dir) {
		t.Fatal("empty dir")
	}
	if err := os.WriteFile(filepath.Join(dir, "package.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "start-nirnside.cmd"), []byte("rem"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !looksInstalled(dir) {
		t.Fatal("zip/dev copy should count as installed")
	}
}

func TestLauncherSelfUpdateSwapsOnDigestChange(t *testing.T) {
	dir := t.TempDir()
	exePath := filepath.Join(dir, "Nirnside.exe")
	if err := os.WriteFile(exePath, []byte("old-launcher"), 0o755); err != nil {
		t.Fatal(err)
	}
	newBytes := []byte("new-launcher")
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/releases/latest") {
			sum := sha256.Sum256(newBytes)
			digest := "sha256:" + hex.EncodeToString(sum[:])
			_ = json.NewEncoder(w).Encode(map[string]any{
				"assets": []map[string]string{{
					"name":                 "Nirnside.exe",
					"digest":               digest,
					"browser_download_url": srvBase(srv) + "/download/Nirnside.exe",
				}},
			})
			return
		}
		if strings.HasSuffix(r.URL.Path, "Nirnside.exe") {
			_, _ = w.Write(newBytes)
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	status, restart := checkLauncherUpdateAt(exePath, dir, srvBase(srv))
	if !restart {
		t.Fatalf("digest change must restart, status: %q", status)
	}
	got, err := os.ReadFile(exePath)
	if err != nil || string(got) != "new-launcher" {
		t.Fatalf("expected the swapped launcher on disk, got %q", string(got))
	}
	if _, err := os.Stat(exePath + ".new"); err == nil {
		t.Fatal("temp download must be cleaned up")
	}
	if _, err := os.Stat(exePath + ".old"); err == nil {
		t.Fatal("old launcher must be cleaned up")
	}

	// Second check on the fresh bytes: up to date, no restart.
	status, restart = checkLauncherUpdateAt(exePath, dir, srvBase(srv))
	if restart {
		t.Fatal("a matching digest must not restart")
	}
	if !strings.Contains(status, "up to date") {
		t.Fatalf("unexpected status: %q", status)
	}
}

func TestLauncherSelfUpdateKeepsCurrentOnChecksumFailure(t *testing.T) {
	dir := t.TempDir()
	exePath := filepath.Join(dir, "Nirnside.exe")
	if err := os.WriteFile(exePath, []byte("old-launcher"), 0o755); err != nil {
		t.Fatal(err)
	}
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/releases/latest") {
			// The published digest does not match what we actually serve.
			_ = json.NewEncoder(w).Encode(map[string]any{
				"assets": []map[string]string{{
					"name":                 "Nirnside.exe",
					"digest":               "sha256:" + strings.Repeat("00", 32),
					"browser_download_url": srvBase(srv) + "/download/Nirnside.exe",
				}},
			})
			return
		}
		if strings.HasSuffix(r.URL.Path, "Nirnside.exe") {
			_, _ = w.Write([]byte("tampered"))
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	status, restart := checkLauncherUpdateAt(exePath, dir, srvBase(srv))
	if restart {
		t.Fatal("an unverified download must never restart")
	}
	if !strings.Contains(status, "checksum") {
		t.Fatalf("unexpected status: %q", status)
	}
	got, _ := os.ReadFile(exePath)
	if string(got) != "old-launcher" {
		t.Fatal("the current launcher must be kept on checksum failure")
	}
}

func TestSyncLauncherIntoInstall(t *testing.T) {
	dir := t.TempDir()
	freshExe := filepath.Join(dir, "Downloaded", "Nirnside.exe")
	if err := os.MkdirAll(filepath.Dir(freshExe), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(freshExe, []byte("fresh-launcher"), 0o755); err != nil {
		t.Fatal(err)
	}

	// No install exe yet: nothing to do (fresh install flow owns that).
	if syncLauncherIntoInstallAt(freshExe, dir) {
		t.Fatal("no install exe yet means nothing to sync")
	}

	// An install with an older launcher: the fresh one is copied in.
	if err := os.WriteFile(filepath.Join(dir, "Nirnside.exe"), []byte("old-launcher"), 0o755); err != nil {
		t.Fatal(err)
	}
	if !syncLauncherIntoInstallAt(freshExe, dir) {
		t.Fatal("a differing install launcher must be replaced")
	}
	got, _ := os.ReadFile(filepath.Join(dir, "Nirnside.exe"))
	if string(got) != "fresh-launcher" {
		t.Fatalf("install should now hold the fresh launcher, got %q", string(got))
	}

	// Same bytes already in place: no copy, no error.
	if syncLauncherIntoInstallAt(freshExe, dir) {
		t.Fatal("an identical install launcher must not be re-copied")
	}
}

func srvBase(srv *httptest.Server) string {
	return "http://" + srv.Listener.Addr().String()
}
