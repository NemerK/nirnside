package main

import (
	"archive/zip"
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
