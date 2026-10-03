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
	hideWindow(cmd)
}

var jobHandle syscall.Handle

const (
	jobObjectExtendedLimitInformation = 9
	jobObjectLimitKillOnJobClose      = 0x2000
)

type jobObjectBasicLimitInformation struct {
	PerProcessUserTimeLimit int64
	PerJobUserTimeLimit     int64
	LimitFlags              uint32
	MinimumWorkingSetSize   uintptr
	MaximumWorkingSetSize   uintptr
	ActiveProcessLimit      uint32
	Affinity                uintptr
	PriorityClass           uint32
	SchedulingClass         uint32
}

type jobObjectExtendedLimitInformation struct {
	BasicLimitInformation jobObjectBasicLimitInformation
	IoInfo                [48]byte
	ProcessMemoryLimit    uintptr
	JobMemoryLimit        uintptr
	PeakProcessMemoryUsed uintptr
	PeakJobMemoryUsed     uintptr
}

func holdJobForChildren() {
	k32 := syscall.NewLazyDLL("kernel32.dll")
	create := k32.NewProc("CreateJobObjectW")
	setInfo := k32.NewProc("SetInformationJobObject")
	h, _, err := create.Call(0, 0)
	if h == 0 {
		fmt.Fprintf(os.Stderr, "[nirnside] job object: %v\n", err)
		return
	}
	jobHandle = syscall.Handle(h)
	var info jobObjectExtendedLimitInformation
	info.BasicLimitInformation.LimitFlags = jobObjectLimitKillOnJobClose
	r, _, err := setInfo.Call(uintptr(jobHandle), jobObjectExtendedLimitInformation, uintptr(unsafe.Pointer(&info)), unsafe.Sizeof(info))
	if r == 0 {
		fmt.Fprintf(os.Stderr, "[nirnside] job limit: %v\n", err)
	}
}

func assignToJob(cmd *exec.Cmd) {
	if jobHandle == 0 || cmd == nil || cmd.Process == nil {
		return
	}
	k32 := syscall.NewLazyDLL("kernel32.dll")
	assign := k32.NewProc("AssignProcessToJobObject")
	const processTerminate = 0x0001
	const processSetQuota = 0x0100
	p, err := syscall.OpenProcess(processTerminate|processSetQuota, false, uint32(cmd.Process.Pid))
	if err != nil {
		return
	}
	defer syscall.CloseHandle(p)
	_, _, _ = assign.Call(uintptr(jobHandle), uintptr(p))
}

func killProcessTree(pid int) {
	if pid <= 0 || pid == os.Getpid() {
		return
	}
	cmd := exec.Command("taskkill.exe", "/PID", fmt.Sprintf("%d", pid), "/T", "/F")
	hideWindow(cmd)
	_ = cmd.Run()
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
