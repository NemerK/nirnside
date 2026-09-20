package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const fallbackNodeVersion = "v22.14.0"

type nodeRelease struct {
	Version string   `json:"version"`
	LTS     any      `json:"lts"`
	Files   []string `json:"files"`
}

func isLTS(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t != "" && t != "false"
	default:
		return false
	}
}

func hasWinZip(files []string) bool {
	for _, f := range files {
		if f == "win-x64-zip" {
			return true
		}
	}
	return false
}

func majorVersion(ver string) int {
	s := strings.TrimPrefix(ver, "v")
	if i := strings.IndexByte(s, '.'); i >= 0 {
		s = s[:i]
	}
	n, _ := strconv.Atoi(s)
	return n
}

func pickNodeLTS(releases []nodeRelease) string {
	for _, n := range releases {
		if !isLTS(n.LTS) || !hasWinZip(n.Files) {
			continue
		}
		if majorVersion(n.Version) < 22 {
			continue
		}
		return n.Version
	}
	return fallbackNodeVersion
}

func nodeZipURL(version string) string {
	return fmt.Sprintf("https://nodejs.org/dist/%s/node-%s-win-x64.zip", version, version)
}

func lookupNodeLTS(client *http.Client) (string, error) {
	if client == nil {
		client = &http.Client{Timeout: 45 * time.Second}
	}
	req, err := http.NewRequest(http.MethodGet, "https://nodejs.org/dist/index.json", nil)
	if err != nil {
		return fallbackNodeVersion, err
	}
	req.Header.Set("User-Agent", "NirnsideInstaller")
	res, err := client.Do(req)
	if err != nil {
		return fallbackNodeVersion, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fallbackNodeVersion, fmt.Errorf("nodejs.org index: %s", res.Status)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return fallbackNodeVersion, err
	}
	var releases []nodeRelease
	if err := json.Unmarshal(body, &releases); err != nil {
		return fallbackNodeVersion, err
	}
	return pickNodeLTS(releases), nil
}
