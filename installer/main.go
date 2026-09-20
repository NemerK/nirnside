package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

//go:embed wizard.html
var wizardFS embed.FS

func main() {
	if runtime.GOOS != "windows" {
		fmt.Fprintln(os.Stderr, "This installer is the Windows app.")
		fmt.Fprintln(os.Stderr, "On macOS or Linux, run ./start-nirnside.sh instead.")
		os.Exit(1)
	}

	exe, _ := os.Executable()
	exeDir := filepath.Dir(exe)
	existing := detectExistingRoot(exeDir)

	in := newInstaller()
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
		data, _ := fs.ReadFile(wizardFS, "wizard.html")
		_, _ = w.Write(data)
	})
	mux.HandleFunc("/api/defaults", in.handleDefaults)
	mux.HandleFunc("/api/state", in.handleState)
	mux.HandleFunc("/api/install", in.handleInstall)
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 8 * time.Second}
	go func() { _ = srv.Serve(ln) }()

	wizardURL := fmt.Sprintf("http://127.0.0.1:%d/", port)
	fmt.Println("Nirnside")
	fmt.Println("Opening", wizardURL)
	_ = openURL(wizardURL)

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
		fmt.Println("Waiting for you to click Install in the browser…")
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
