package main

import (
	"bytes"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const appPort = 43219

func runtimeNode(root string) string {
	if runtime.GOOS == "windows" {
		return filepath.Join(root, "runtime", "node.exe")
	}
	return filepath.Join(root, "runtime", "bin", "node")
}

func setPathEnv(env []string, path string) []string {
	for i, e := range env {
		eq := strings.IndexByte(e, '=')
		if eq <= 0 {
			continue
		}
		if strings.EqualFold(e[:eq], "PATH") {
			env[i] = e[:eq+1] + path
			return env
		}
	}
	return append(env, "PATH="+path)
}

func runtimeEnv(root string) []string {
	rt := filepath.Join(root, "runtime")
	if runtime.GOOS != "windows" {
		rt = filepath.Join(root, "runtime", "bin")
	}
	path := rt + string(os.PathListSeparator) + os.Getenv("PATH")
	env := setPathEnv(append([]string{}, os.Environ()...), path)
	return append(env,
		"npm_config_build_from_source=false",
		"NEXT_TELEMETRY_DISABLED=1",
		"HOSTNAME=127.0.0.1",
	)
}

func runLogged(log *os.File, dir string, env []string, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Env = env
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	hideWindow(cmd)
	err := cmd.Run()
	if log != nil && buf.Len() > 0 {
		_, _ = log.Write(buf.Bytes())
		if buf.Bytes()[len(buf.Bytes())-1] != '\n' {
			_, _ = log.Write([]byte("\n"))
		}
	}
	if err != nil {
		out := buf.String()
		if len(out) > 2500 {
			out = out[len(out)-2500:]
		}
		return fmt.Errorf("%v\n%s", err, out)
	}
	return nil
}

func npmInstall(log *os.File, root string) error {
	env := runtimeEnv(root)
	if runtime.GOOS == "windows" {
		npm := filepath.Join(root, "runtime", "npm.cmd")
		return runLogged(log, root, env, "cmd.exe", "/c", npm, "install", "--ignore-scripts", "--no-audit", "--no-fund")
	}
	npm := filepath.Join(root, "runtime", "bin", "npm")
	return runLogged(log, root, env, npm, "install", "--ignore-scripts", "--no-audit", "--no-fund")
}

func runNodeScript(log *os.File, root string, script string, extra ...string) error {
	args := append([]string{filepath.Join(root, script)}, extra...)
	return runLogged(log, root, runtimeEnv(root), runtimeNode(root), args...)
}

const needBuildName = ".nirnside-need-build"

func nextBin(root string) (string, error) {
	p := filepath.Join(root, "node_modules", "next", "dist", "bin", "next")
	if _, err := os.Stat(p); err != nil {
		return "", fmt.Errorf("the app files are missing. Try Install again.")
	}
	return p, nil
}

func needBuild(root string) bool {
	if _, err := os.Stat(filepath.Join(root, ".next", "BUILD_ID")); err != nil {
		return true
	}
	_, err := os.Stat(filepath.Join(root, needBuildName))
	return err == nil
}

func buildApp(log *os.File, root string) error {
	next, err := nextBin(root)
	if err != nil {
		return err
	}
	if err := runLogged(log, root, runtimeEnv(root), runtimeNode(root), next, "build"); err != nil {
		return fmt.Errorf("could not build Nirnside: %w", err)
	}
	_ = os.Remove(filepath.Join(root, needBuildName))
	return nil
}

func startApp(log *os.File, root string) (*exec.Cmd, error) {
	env := runtimeEnv(root)
	next, err := nextBin(root)
	if err != nil {
		return nil, err
	}
	// Production server on IPv4 localhost. `next dev` is for git clones;
	// the exe waits on 127.0.0.1 and IPv6-only / compile-on-request dies there.
	cmd := exec.Command(runtimeNode(root), next, "start", "-H", "127.0.0.1", "-p", fmt.Sprintf("%d", appPort))
	cmd.Dir = root
	cmd.Env = env
	if log != nil {
		cmd.Stdout = log
		cmd.Stderr = log
	}
	hideWindow(cmd)
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	assignToJob(cmd)
	return cmd, nil
}

func installAddonsBestEffort(log *os.File, root string) {
	tsx := filepath.Join(root, "node_modules", "tsx", "dist", "cli.mjs")
	script := filepath.Join("scripts", "install-addons.ts")
	if _, err := os.Stat(tsx); err != nil {
		return
	}
	_ = runLogged(log, root, runtimeEnv(root), runtimeNode(root), tsx, script)
}

func waitHTTP(url string, timeout time.Duration) error {
	return waitReady(url, nil, timeout, nil)
}

func waitReady(url string, cmd *exec.Cmd, timeout time.Duration, onTick func(waited time.Duration)) error {
	deadline := time.Now().Add(timeout)
	started := time.Now()
	exited := make(chan error, 1)
	if cmd != nil && cmd.Process != nil {
		go func() { exited <- cmd.Wait() }()
	}
	for time.Now().Before(deadline) {
		select {
		case err := <-exited:
			if err != nil {
				return fmt.Errorf("Nirnside exited before it was ready: %w", err)
			}
			return fmt.Errorf("Nirnside exited before it was ready")
		default:
		}
		if probeApp(url) {
			return nil
		}
		if onTick != nil {
			onTick(time.Since(started))
		}
		time.Sleep(400 * time.Millisecond)
	}
	return fmt.Errorf("Nirnside did not start at %s", url)
}

func probeURLs(base string) []string {
	base = strings.TrimRight(base, "/")
	return []string{base + "/api/health", base + "/"}
}

func probeApp(base string) bool {
	return probeLocal(base, false)
}

func probeLocal(base string, requireName bool) bool {
	client := &http.Client{Timeout: 8 * time.Second}
	for _, u := range probeURLs(base) {
		res, err := client.Get(u)
		if err != nil {
			continue
		}
		buf := make([]byte, 2048)
		n, _ := res.Body.Read(buf)
		res.Body.Close()
		if res.StatusCode >= 500 {
			continue
		}
		body := strings.ToLower(string(buf[:n]))
		if strings.Contains(u, "/api/health") {
			if strings.Contains(body, "nirnside") || strings.Contains(body, `"ok"`) {
				return true
			}
			continue
		}
		if requireName {
			return strings.Contains(body, "nirnside")
		}
		return true
	}
	return false
}

func appURL() string {
	return fmt.Sprintf("http://127.0.0.1:%d/", appPort)
}

func readLocalApp() (int, string, error) {
	c := &http.Client{Timeout: 800 * time.Millisecond}
	res, err := c.Get(appURL())
	if err != nil {
		return 0, "", err
	}
	defer res.Body.Close()
	buf := make([]byte, 8192)
	n, _ := res.Body.Read(buf)
	return res.StatusCode, string(buf[:n]), nil
}

func looksLikeNirnside() bool {
	return probeLocal(appURL(), true)
}

func appAlreadyUp() bool {
	// Health only, and fast. A leftover hung `next start` still occupies
	// 43219; probing `/` would sit on that dead connection for seconds.
	client := &http.Client{Timeout: 800 * time.Millisecond}
	res, err := client.Get(strings.TrimRight(appURL(), "/") + "/api/health")
	if err != nil {
		return false
	}
	buf := make([]byte, 512)
	n, _ := res.Body.Read(buf)
	res.Body.Close()
	if res.StatusCode >= 500 {
		return false
	}
	body := strings.ToLower(string(buf[:n]))
	return strings.Contains(body, "nirnside") || strings.Contains(body, `"ok"`)
}

func parseListeningPIDs(output string, port int) []int {
	suffix := fmt.Sprintf(":%d", port)
	seen := map[int]bool{}
	var pids []int
	me := os.Getpid()
	for _, line := range strings.Split(output, "\n") {
		if !strings.Contains(strings.ToUpper(line), "LISTEN") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		hit := false
		for _, f := range fields {
			if strings.HasSuffix(f, suffix) || strings.Contains(f, suffix+"]") {
				hit = true
				break
			}
		}
		if !hit {
			continue
		}
		pid, err := strconv.Atoi(fields[len(fields)-1])
		if err != nil || pid <= 0 || pid == me {
			continue
		}
		if seen[pid] {
			continue
		}
		seen[pid] = true
		pids = append(pids, pid)
	}
	return pids
}

func listeningPIDs(port int) []int {
	if runtime.GOOS == "windows" {
		out, err := exec.Command("netstat", "-ano").Output()
		if err != nil {
			return nil
		}
		return parseListeningPIDs(string(out), port)
	}
	out, err := exec.Command("ss", "-lptn", fmt.Sprintf("sport = :%d", port)).Output()
	if err != nil {
		return nil
	}
	return parseListeningPIDs(string(out), port)
}

func reclaimAppPort() error {
	if looksLikeNirnside() {
		return nil
	}
	if !portBusy(appPort) {
		return nil
	}
	for _, pid := range listeningPIDs(appPort) {
		killProcessTree(pid)
	}
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		if !portBusy(appPort) {
			return nil
		}
		if looksLikeNirnside() {
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
	if portBusy(appPort) && !looksLikeNirnside() {
		return fmt.Errorf("port %d is still in use. Close the old Nirnside window (or Task Manager → node.exe) and try again.", appPort)
	}
	return nil
}

func portBusy(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return true
	}
	_ = ln.Close()
	return false
}

func tailFile(path string, max int) string {
	b, err := os.ReadFile(path)
	if err != nil || len(b) == 0 {
		return ""
	}
	if len(b) > max {
		b = b[len(b)-max:]
	}
	return string(b)
}

func listenLocal(preferred int) (net.Listener, int, error) {
	for _, p := range []int{preferred, preferred - 1, preferred + 1, 0} {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			addr := ln.Addr().(*net.TCPAddr)
			return ln, addr.Port, nil
		}
	}
	return nil, 0, fmt.Errorf("could not bind a local port")
}
