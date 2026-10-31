package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

//go:embed launcher.html
var wizardFS embed.FS

func main() {
	if runtime.GOOS != "windows" {
		fmt.Fprintln(os.Stderr, "This installer is the Windows app.")
		fmt.Fprintln(os.Stderr, "On macOS or Linux, run ./start-nirnside.sh instead.")
		os.Exit(1)
	}

	fmt.Println(launcherBanner())

	exe, _ := os.Executable()
	exeDir := filepath.Dir(exe)
	cleanupSwapArtifacts(exeDir)
	existing := detectExistingRoot(exeDir)
	if existing != "" && existing != exeDir {
		cleanupSwapArtifacts(existing)
	}

	// ---- Launcher layer: keep the launcher itself current, independently of
	// the app. Runs before everything else and can never block startup.
	launcherStatus := "Checking…"
	if os.Getenv("NIRNSIDE_SKIP_UPDATE") != "1" && os.Getenv("NIRNSIDE_LAUNCHER_CHECKED") != "1" {
		launcherRoot := existing
		if launcherRoot == "" {
			launcherRoot = exeDir
		}
		status, restart := checkLauncherUpdate(launcherRoot, "https://api.github.com")
		launcherStatus = status
		if restart {
			restartLauncher(exe, os.Args[1:]...)
		}
	}

	if existing != "" {
		syncLauncherIntoInstall(existing)
	}

	holdJobForChildren()

	// Already-running app: nothing to install or update (launchExisting skips
	// all of that too). The keeper instance owns the server; this one just
	// opens the app window and steps away.
	if existing != "" && appAlreadyUp() {
		fmt.Println("Nirnside")
		fmt.Println("Already running — opening the app window.")
		_ = openLauncherWindow(appURL())
		return
	}

	in := newInstaller()
	in.set(func(s *jobState) {
		s.Launcher.Status = launcherStatus
	})
	if existing != "" {
		in.set(func(s *jobState) {
			s.Dest = existing
			s.Phase = "installing"
			s.Step = "Starting Nirnside"
			s.Percent = 5
		})
	}

	ln, port, err := listenLocal(43218)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		messageBox("Nirnside", err.Error())
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		data, _ := fs.ReadFile(wizardFS, "launcher.html")
		page := strings.ReplaceAll(string(data), "{{LAUNCHER_VERSION}}", launcherVersion)
		page = strings.ReplaceAll(page, "{{LAUNCHER_COMMIT}}", launcherCommit)
		_, _ = w.Write([]byte(page))
	})
	mux.HandleFunc("/api/defaults", in.handleDefaults)
	mux.HandleFunc("/api/state", in.handleState)
	mux.HandleFunc("/api/launcher-log", in.handleLauncherLog)
	mux.HandleFunc("/api/install", in.handleInstall)
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 8 * time.Second}
	go func() { _ = srv.Serve(ln) }()

	launcherURL := fmt.Sprintf("http://127.0.0.1:%d/", port)
	fmt.Println("Nirnside Launcher", launcherVersion, "("+launcherCommit+")")
	fmt.Println("Opening the launcher window:", launcherURL)
	_ = openLauncherWindow(launcherURL)

	if existing != "" {
		go func() {
			if err := in.launchExisting(existing); err != nil {
				in.set(func(s *jobState) {
					s.Phase = "error"
					s.Error = err.Error()
					s.Step = "Could not start Nirnside"
				})
				fmt.Fprintf(os.Stderr, "[nirnside] %v\n", err)
			}
		}()
	}

	if existing == "" {
		fmt.Println("Waiting for you to click Install in the launcher window…")
	}

	for {
		st := in.snapshot()
		if st.Ready {
			select {}
		}
		if st.Phase == "error" && existing != "" {
			select {}
		}
		time.Sleep(500 * time.Millisecond)
	}
}
