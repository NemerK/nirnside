package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const (
	githubZipRelease = "https://github.com/NemerK/nirnside/releases/download/latest/nirnside.zip"
	githubZipMain    = "https://github.com/NemerK/nirnside/archive/refs/heads/main.zip"
)

func (in *installer) runInstall(dest string, shortcut bool) error {
	if err := destAllowed(dest); err != nil {
		return err
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	in.set(func(s *jobState) { s.Dest = dest })

	log, err := openLog(dest)
	if err != nil {
		return err
	}
	defer log.Close()
	_, _ = fmt.Fprintf(log, "\n==== %s install ====\n", time.Now().Format(time.RFC3339))

	in.progress(4, "Creating the Nirnside folder", dest)

	rt := filepath.Join(dest, "runtime")
	if _, err := os.Stat(runtimeNode(dest)); err != nil {
		in.progress(8, "Downloading the app runtime", "A private Node.js copy for Nirnside only — not a system install.")
		ver, verr := lookupNodeLTS(in.client)
		if verr != nil {
			ver = fallbackNodeVersion
		}
		zipPath := filepath.Join(dest, "nirnside-node.zip")
		if err := downloadFile(in.client, nodeZipURL(ver), zipPath, nil); err != nil {
			return fmt.Errorf("could not download the app runtime: %w", err)
		}
		in.progress(32, "Unpacking the app runtime", ver)
		if err := extractZip(zipPath, rt, func(string) bool { return false }); err != nil {
			return fmt.Errorf("could not unpack the app runtime: %w", err)
		}
		_ = os.Remove(zipPath)
	} else {
		in.progress(32, "Using the app runtime already on this PC", "")
	}
	if _, err := os.Stat(runtimeNode(dest)); err != nil {
		return fmt.Errorf("the app runtime is missing after download (expected node in %s)", rt)
	}

	in.progress(40, "Downloading Nirnside", "From GitHub, onto this PC only.")
	appZip := filepath.Join(dest, "nirnside-app.zip")
	if err := downloadFile(in.client, githubZipRelease, appZip, nil); err != nil {
		if err2 := downloadFile(in.client, githubZipMain, appZip, nil); err2 != nil {
			return fmt.Errorf("could not download Nirnside: %v / %v", err, err2)
		}
	}
	in.progress(62, "Unpacking Nirnside", "")
	if err := extractZip(appZip, dest, skipExtract); err != nil {
		return fmt.Errorf("could not unpack Nirnside: %w", err)
	}
	_ = os.Remove(appZip)

	if err := copySelf(dest); err != nil {
		_, _ = fmt.Fprintf(log, "copy exe: %v\n", err)
	}

	in.progress(72, "Preparing the app", "First run takes a minute. Visual Studio is not used.")
	if err := npmInstall(log, dest); err != nil {
		return fmt.Errorf("could not prepare the app: %w", err)
	}

	in.progress(88, "Checking the local database", "")
	check := filepath.Join(dest, "scripts", "check-sqlite.mjs")
	if _, err := os.Stat(check); err == nil {
		if err := runNodeScript(log, dest, filepath.Join("scripts", "check-sqlite.mjs")); err != nil {
			return fmt.Errorf("the local database engine did not load: %w", err)
		}
	}

	in.progress(92, "Looking for Elder Scrolls Online", "Addons are copied if the game is on this PC.")
	installAddonsBestEffort(log, dest)

	if shortcut {
		in.progress(96, "Creating a desktop shortcut", "")
		if err := createShortcuts(dest); err != nil {
			_, _ = fmt.Fprintf(log, "shortcut: %v\n", err)
		}
	}

	return in.launch(dest, log)
}

func (in *installer) launchExisting(root string) error {
	log, err := openLog(root)
	if err != nil {
		return err
	}
	defer log.Close()
	in.set(func(s *jobState) {
		s.Phase = "installing"
		s.Dest = root
		s.Step = "Starting Nirnside"
		s.Percent = 10
	})
	if appAlreadyUp() {
		in.markReady()
		_ = openURL(fmt.Sprintf("http://127.0.0.1:%d/", appPort))
		return nil
	}

	in.progress(20, "Checking for updates", "")
	_ = runNodeScript(log, root, filepath.Join("scripts", "self-update.mjs"))

	if _, err := os.Stat(runtimeNode(root)); err != nil {
		return in.runInstall(root, true)
	}

	in.progress(45, "Updating the app", "")
	if err := npmInstall(log, root); err != nil {
		return err
	}
	check := filepath.Join(root, "scripts", "check-sqlite.mjs")
	if _, err := os.Stat(check); err == nil {
		_ = runNodeScript(log, root, filepath.Join("scripts", "check-sqlite.mjs"))
	}
	installAddonsBestEffort(log, root)
	return in.launch(root, log)
}

func (in *installer) launch(root string, log *os.File) error {
	in.progress(98, "Starting Nirnside", "A browser tab will open.")
	if _, err := startApp(log, root); err != nil {
		return fmt.Errorf("could not start Nirnside: %w", err)
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/", appPort)
	if err := waitHTTP(url, 90*time.Second); err != nil {
		return err
	}
	in.markReady()
	_ = openURL(url)
	fmt.Println()
	fmt.Println("Nirnside is running.")
	fmt.Println("Leave this window open. Close it to stop Nirnside.")
	fmt.Println("Browser:", url)
	return nil
}

func (in *installer) markReady() {
	in.set(func(s *jobState) {
		s.Phase = "ready"
		s.Ready = true
		s.Percent = 100
		s.Step = "Nirnside is ready"
		s.Detail = ""
		s.AppURL = fmt.Sprintf("http://127.0.0.1:%d/", appPort)
		s.Error = ""
	})
}
