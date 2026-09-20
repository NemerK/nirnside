//go:build !windows

package main

import (
	"os/exec"
	"runtime"
)

func hideWindow(cmd *exec.Cmd) {}

func detachProcess(cmd *exec.Cmd) {}

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
