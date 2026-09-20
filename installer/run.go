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

func startApp(log *os.File, root string) (*exec.Cmd, error) {
	env := runtimeEnv(root)
	next := filepath.Join(root, "node_modules", "next", "dist", "bin", "next")
	cmd := exec.Command(runtimeNode(root), next, "dev", "-p", fmt.Sprintf("%d", appPort))
	cmd.Dir = root
	cmd.Env = env
	if log != nil {
		cmd.Stdout = log
		cmd.Stderr = log
	}
	detachProcess(cmd)
	if err := cmd.Start(); err != nil {
		return nil, err
	}
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
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 2 * time.Second}
	for time.Now().Before(deadline) {
		res, err := client.Get(url)
		if err == nil {
			res.Body.Close()
			if res.StatusCode < 500 {
				return nil
			}
		}
		time.Sleep(400 * time.Millisecond)
	}
	return fmt.Errorf("Nirnside did not start at %s", url)
}

func appAlreadyUp() bool {
	c := &http.Client{Timeout: 800 * time.Millisecond}
	res, err := c.Get(fmt.Sprintf("http://127.0.0.1:%d/", appPort))
	if err != nil {
		return false
	}
	res.Body.Close()
	return res.StatusCode < 500
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
