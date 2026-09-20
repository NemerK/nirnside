package main

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// skipExtract reports paths that must never be overwritten when unpacking
// Nirnside onto an existing install (account DB, bundled runtime, the exe).
func skipExtract(rel string) bool {
	n := strings.ReplaceAll(rel, "\\", "/")
	n = strings.TrimPrefix(n, "./")
	if n == "" || n == "." {
		return true
	}
	if strings.HasPrefix(n, "runtime/") || n == "runtime" {
		return true
	}
	if strings.EqualFold(filepath.Base(n), "Nirnside.exe") {
		return true
	}
	if n == "nirnside-installer.log" {
		return true
	}
	if n == "node_modules" || strings.HasPrefix(n, "node_modules/") {
		return true
	}
	if n == ".next" || strings.HasPrefix(n, ".next/") {
		return true
	}
	if n == ".git" || strings.HasPrefix(n, ".git/") {
		return true
	}
	if strings.HasSuffix(strings.ToLower(n), ".db") || strings.HasSuffix(strings.ToLower(n), ".db-wal") || strings.HasSuffix(strings.ToLower(n), ".db-shm") {
		return true
	}
	if strings.HasPrefix(n, "data/incoming/") && strings.HasSuffix(strings.ToLower(n), ".lua") {
		return true
	}
	return false
}

func zipRootPrefix(r *zip.ReadCloser) string {
	var top string
	for _, f := range r.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		name = strings.TrimPrefix(name, "./")
		if name == "" {
			continue
		}
		first := name
		if i := strings.IndexByte(name, '/'); i >= 0 {
			first = name[:i]
		}
		if top == "" {
			top = first
			continue
		}
		if first != top {
			return ""
		}
	}
	if top == "" {
		return ""
	}
	return top + "/"
}

func safeJoin(dest, rel string) (string, error) {
	clean := filepath.Clean(strings.ReplaceAll(rel, "\\", "/"))
	if clean == "." || clean == "" {
		return dest, nil
	}
	if strings.HasPrefix(clean, "..") {
		return "", fmt.Errorf("refusing path %q", rel)
	}
	p := filepath.Join(dest, clean)
	relOut, err := filepath.Rel(dest, p)
	if err != nil || strings.HasPrefix(relOut, "..") {
		return "", fmt.Errorf("refusing path %q", rel)
	}
	return p, nil
}

func extractZip(zipPath, dest string, skip func(string) bool) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	prefix := zipRootPrefix(r)
	for _, f := range r.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		name = strings.TrimPrefix(name, "./")
		if prefix != "" {
			name = strings.TrimPrefix(name, prefix)
		}
		if name == "" {
			continue
		}
		if skip != nil && skip(name) {
			continue
		}
		target, err := safeJoin(dest, name)
		if err != nil {
			return err
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(out, rc)
		closeErr := out.Close()
		rc.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
	}
	return nil
}
