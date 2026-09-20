package main

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
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
