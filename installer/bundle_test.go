package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func writeFile(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func TestCleanupLegacyInstallKeepsPlayerData(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "app", "server.js"), "")
	writeFile(t, filepath.Join(root, "data", "nirnside.db"), "db")
	writeFile(t, filepath.Join(root, "data", "incoming", "NirnsideSnapshot.lua"), "lua")
	writeFile(t, filepath.Join(root, "runtime", "node.exe"), "")
	writeFile(t, filepath.Join(root, "Nirnside.exe"), "")
	writeFile(t, filepath.Join(root, "nirnside-installer.log"), "")
	writeFile(t, filepath.Join(root, "src", "app", "inventory", "page.tsx"), "old")
	writeFile(t, filepath.Join(root, "node_modules", "next", "index.js"), "")
	writeFile(t, filepath.Join(root, ".next", "BUILD_ID"), "")
	writeFile(t, filepath.Join(root, "package.json"), "{}")

	cleanupLegacyInstall(root)

	for _, gone := range []string{"src", "node_modules", ".next", "package.json"} {
		if exists(filepath.Join(root, gone)) {
			t.Errorf("%s should be removed", gone)
		}
	}
	for _, kept := range []string{"app/server.js", "data/nirnside.db", "data/incoming/NirnsideSnapshot.lua", "runtime/node.exe", "Nirnside.exe", "nirnside-installer.log"} {
		if !exists(filepath.Join(root, kept)) {
			t.Errorf("%s must be kept", kept)
		}
	}
}

func TestCleanupLegacyInstallNeverTouchesAGitCheckout(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "app", "server.js"), "")
	writeFile(t, filepath.Join(root, ".git", "HEAD"), "ref: refs/heads/main")
	writeFile(t, filepath.Join(root, "src", "app", "page.tsx"), "mine")
	cleanupLegacyInstall(root)
	if !exists(filepath.Join(root, "src", "app", "page.tsx")) {
		t.Fatal("a developer's source files were removed")
	}
}

func TestCleanupLegacyInstallNeedsABundle(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "src", "app", "page.tsx"), "x")
	cleanupLegacyInstall(root)
	if !exists(filepath.Join(root, "src", "app", "page.tsx")) {
		t.Fatal("removed source files with no ready-built app to replace them")
	}
}

func TestSwapDirReplacesAndRemovesOld(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "app", "old.txt"), "old")
	writeFile(t, filepath.Join(root, "app.new", "server.js"), "new")
	if err := swapDir(filepath.Join(root, "app"), filepath.Join(root, "app.new")); err != nil {
		t.Fatal(err)
	}
	if !exists(filepath.Join(root, "app", "server.js")) || exists(filepath.Join(root, "app", "old.txt")) {
		t.Fatal("app was not replaced")
	}
	if exists(filepath.Join(root, "app.old")) || exists(filepath.Join(root, "app.new")) {
		t.Fatal("staging folders left behind")
	}
}

func TestInstalledBundleSha(t *testing.T) {
	root := t.TempDir()
	if installedBundleSha(root) != "" || hasBundle(root) {
		t.Fatal("empty install reports a bundle")
	}
	writeFile(t, filepath.Join(root, "app", "server.js"), "")
	writeFile(t, filepath.Join(root, "app", bundleInfoName), `{"sha":"abc1234def","node":"v24.1.0"}`)
	if !hasBundle(root) || installedBundleSha(root) != "abc1234def" {
		t.Fatal("bundle not detected")
	}
	if !looksInstalled(root) {
		t.Fatal("a ready-built install must count as installed")
	}
}

func TestFetchBundleManifestValidates(t *testing.T) {
	body := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/"+bundleManifestName {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()
	t.Setenv("NIRNSIDE_BUNDLE_URL", srv.URL)

	body = `{"sha":"abc1234","node":"v24.1.0","sha256":"` + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" + `","size":10}`
	man, err := fetchBundleManifest(srv.Client(), t.TempDir())
	if err != nil || man.Sha != "abc1234" || man.Node != "v24.1.0" {
		t.Fatalf("good manifest rejected: %v %+v", err, man)
	}
	body = `{"sha":"abc1234","node":"v24.1.0","sha256":"short"}`
	if _, err := fetchBundleManifest(srv.Client(), t.TempDir()); err == nil {
		t.Fatal("incomplete manifest accepted")
	}
}
