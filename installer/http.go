package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

type jobState struct {
	Phase   string `json:"phase"`
	Step    string `json:"step"`
	Detail  string `json:"detail"`
	Percent int    `json:"percent"`
	Error   string `json:"error,omitempty"`
	AppURL  string `json:"appUrl,omitempty"`
	Dest    string `json:"dest"`
	Ready   bool   `json:"ready"`
}

type installer struct {
	mu     sync.Mutex
	state  jobState
	busy   bool
	client *http.Client
}

func newInstaller() *installer {
	return &installer{
		client: newHTTPClient(),
		state: jobState{
			Phase: "welcome",
			Step:  "Ready to install",
			Dest:  defaultInstallDir(),
		},
	}
}

func (in *installer) snapshot() jobState {
	in.mu.Lock()
	defer in.mu.Unlock()
	return in.state
}

func (in *installer) set(fn func(*jobState)) {
	in.mu.Lock()
	fn(&in.state)
	in.mu.Unlock()
}

func (in *installer) progress(pct int, step, detail string) {
	in.set(func(s *jobState) {
		s.Phase = "installing"
		s.Percent = pct
		s.Step = step
		s.Detail = detail
		s.Error = ""
	})
	fmt.Printf("[nirnside] %d%% %s %s\n", pct, step, detail)
}

type installReq struct {
	Dest     string `json:"dest"`
	Shortcut *bool  `json:"shortcut"`
}

func (in *installer) handleState(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(in.snapshot())
}

func (in *installer) handleDefaults(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"dest":     defaultInstallDir(),
		"shortcut": true,
		"note":     "Nirnside stays on this PC. It never asks for an ESO password and never uploads your account.",
	})
}

func (in *installer) handleInstall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	var req installReq
	_ = json.NewDecoder(r.Body).Decode(&req)
	dest := defaultInstallDir()
	if req.Dest != "" {
		dest = req.Dest
	}
	shortcut := true
	if req.Shortcut != nil {
		shortcut = *req.Shortcut
	}
	in.mu.Lock()
	if in.busy {
		in.mu.Unlock()
		http.Error(w, "install already running", http.StatusConflict)
		return
	}
	in.busy = true
	in.mu.Unlock()
	go func() {
		err := in.runInstall(dest, shortcut)
		in.mu.Lock()
		in.busy = false
		in.mu.Unlock()
		if err != nil {
			in.set(func(s *jobState) {
				s.Phase = "error"
				s.Error = err.Error()
				s.Step = "Install did not finish"
			})
			fmt.Fprintf(os.Stderr, "[nirnside] install failed: %v\n", err)
		}
	}()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"ok": "1"})
}

func openLog(root string) (*os.File, error) {
	p := filepath.Join(root, "nirnside-installer.log")
	return os.OpenFile(p, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
}
