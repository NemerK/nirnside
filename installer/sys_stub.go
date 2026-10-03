//go:build !windows

package main

import (
	"os"
	"os/exec"
	"runtime"
)

func hideWindow(cmd *exec.Cmd) {}

func detachProcess(cmd *exec.Cmd) {}

func holdJobForChildren() {}

func assignToJob(cmd *exec.Cmd) {}

func killProcessTree(pid int) {
	if pid <= 0 || pid == os.Getpid() {
		return
	}
	if proc, err := os.FindProcess(pid); err == nil {
		_ = proc.Kill()
	}
}

func openURL(u string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", u).Start()
	default:
		return exec.Command("xdg-open", u).Start()
	}
}

func createShortcuts(dest string) error { return nil }

func messageBox(title, text string) {
	_ = title
	_ = text
}
