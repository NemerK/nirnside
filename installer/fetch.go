package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func newHTTPClient() *http.Client {
	return &http.Client{Timeout: 8 * time.Minute}
}

func downloadFile(client *http.Client, url, dest string, onBytes func(int64)) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "NirnsideInstaller")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("download %s: %s", url, res.Status)
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	buf := make([]byte, 64*1024)
	var n int64
	for {
		c, rerr := res.Body.Read(buf)
		if c > 0 {
			if _, werr := out.Write(buf[:c]); werr != nil {
				return werr
			}
			n += int64(c)
			if onBytes != nil {
				onBytes(n)
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			return rerr
		}
	}
	return nil
}

func defaultInstallDir() string {
	if d := strings.TrimSpace(os.Getenv("NIRNSIDE_DIR")); d != "" {
		return d
	}
	if base := os.Getenv("LOCALAPPDATA"); base != "" {
		return filepath.Join(base, "Nirnside")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Nirnside")
}

func destAllowed(p string) error {
	abs, err := filepath.Abs(p)
	if err != nil {
		return err
	}
	lower := strings.ToLower(abs)
	for _, bad := range []string{`\windows\`, `\system32\`, `/windows/`, `/system32/`} {
		if strings.Contains(lower, bad) {
			return fmt.Errorf("refusing to install into %s", abs)
		}
	}
	return nil
}

func looksInstalled(dir string) bool {
	if dir == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join(dir, "package.json")); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(dir, "runtime", "node.exe")); err == nil {
		return true
	}
	// Dev / zip copy next to this exe: package.json is enough; runtime may still be fetched.
	if _, err := os.Stat(filepath.Join(dir, "start-nirnside.cmd")); err == nil {
		return true
	}
	return false
}

func detectExistingRoot(exeDir string) string {
	if looksInstalled(exeDir) {
		return exeDir
	}
	def := defaultInstallDir()
	if looksInstalled(def) {
		return def
	}
	return ""
}

func copySelf(dest string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	target := filepath.Join(dest, "Nirnside.exe")
	absExe, _ := filepath.Abs(exe)
	absTarget, _ := filepath.Abs(target)
	if strings.EqualFold(absExe, absTarget) {
		return nil
	}
	in, err := os.Open(exe)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, in)
	closeErr := out.Close()
	if copyErr != nil {
		return copyErr
	}
	return closeErr
}
