//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
}

func detachProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    false,
		CreationFlags: 0x00000200, // CREATE_NEW_PROCESS_GROUP
	}
}

func openURL(u string) error {
	return exec.Command("cmd.exe", "/c", "start", "", u).Start()
}

func createShortcuts(dest string) error {
	exe := filepath.Join(dest, "Nirnside.exe")
	if _, err := os.Stat(exe); err != nil {
		exe = filepath.Join(dest, "start-nirnside.cmd")
	}
	desktop := filepath.Join(os.Getenv("USERPROFILE"), "Desktop", "Nirnside.lnk")
	startMenu := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Nirnside.lnk")
	ps := fmt.Sprintf(`
$ws = New-Object -ComObject WScript.Shell
foreach ($p in @('%s','%s')) {
  $s = $ws.CreateShortcut($p)
  $s.TargetPath = '%s'
  $s.WorkingDirectory = '%s'
  $s.WindowStyle = 1
  $s.Description = 'Nirnside — your ESO account, on this PC'
  $s.Save()
}
`, psQuote(desktop), psQuote(startMenu), psQuote(exe), psQuote(dest))
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps)
	hideWindow(cmd)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("shortcut: %v (%s)", err, string(out))
	}
	return nil
}

func psQuote(s string) string {
	r := make([]rune, 0, len(s))
	for _, c := range s {
		if c == '\'' {
			r = append(r, '\'', '\'')
		} else {
			r = append(r, c)
		}
	}
	return string(r)
}

func messageBox(title, text string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	user32 := syscall.NewLazyDLL("user32.dll")
	proc := user32.NewProc("MessageBoxW")
	_, _, _ = proc.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}
