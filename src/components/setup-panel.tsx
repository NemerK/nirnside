"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  FolderOpen,
  FolderSearch,
  Loader2,
  PackageCheck,
  RotateCcw,
  ScanLine,
  Upload,
} from "lucide-react";
import { Card } from "./ui";

type SetupStatus = {
  config: { esoDir?: string; snapshotFile?: string };
  dataSource: {
    kind: string;
    path: string;
    label: string;
    at: number;
    ok: boolean;
    error?: string;
  } | null;
  autoSetup: {
    addOnsDirs: string[];
    installed: string[];
    updated: string[];
    errors: string[];
  } | null;
  detected: {
    root: string;
    envs: { name: string; snapshot: boolean; catalog: boolean; addOns: string }[];
  }[];
  snapshotFound: boolean;
  catalogFound: boolean;
  catalogPath: string | null;
  lookingIn: string[];
};

type BrowseResult = {
  path: string;
  parent: string | null;
  entries: { name: string; path: string; kind: "dir" | "lua" }[];
  error?: string;
};

async function fetchStatus(): Promise<SetupStatus> {
  const res = await fetch("/api/setup", { cache: "no-store" });
  return res.json();
}

export function SetupPanel({ initial }: { initial: SetupStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [path, setPath] = useState(initial.config.esoDir ?? initial.config.snapshotFile ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      fetchStatus().then(setStatus).catch(() => {});
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  async function submitPath(nextPath: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: nextPath }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not use that path.");
      } else {
        setStatus(json.status);
        setPath(nextPath);
        setBrowseOpen(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function action(name: "rescan" | "reset") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: name }),
      });
      const json = await res.json();
      if (json.status) setStatus(json.status);
      if (name === "reset") setPath("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function openBrowse(at?: string) {
    setBrowseOpen(true);
    const q = at ? `?path=${encodeURIComponent(at)}` : "";
    const res = await fetch(`/api/setup/browse${q}`, { cache: "no-store" });
    setBrowse(await res.json());
  }

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch("/api/setup", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) setError(json.error ?? "Upload failed.");
      else {
        setStatus(json.status);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const addonsOk = (status.autoSetup?.addOnsDirs.length ?? 0) > 0;
  const snapshotOk = !!(status.snapshotFound && status.dataSource?.ok && status.dataSource.kind !== "sample");

  return (
    <div className="space-y-6">
      <ol className="space-y-6">
        <Step n={1} title="Point Nirnside at your ESO data folder" done={addonsOk || snapshotOk}>
          <p className="mb-3 text-sm text-fg-muted">
            This is <span className="font-medium text-fg">not</span> the game install in Steam or Program Files. ESO
            writes your account files under Documents:
          </p>
          <code className="mb-4 block overflow-x-auto rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-fg">
            Documents\Elder Scrolls Online\liveeu
          </code>
          <p className="mb-4 text-xs text-fg-subtle">
            EU players usually have <code className="rounded bg-surface-2 px-1">liveeu</code>. NA is{" "}
            <code className="rounded bg-surface-2 px-1">live</code>. Either the parent{" "}
            <code className="rounded bg-surface-2 px-1">Elder Scrolls Online</code> folder or the live folder itself is
            fine.
          </p>

          {status.detected.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Found on this PC</div>
              {status.detected.map((d) => (
                <button
                  key={d.root}
                  type="button"
                  onClick={() => submitPath(d.root)}
                  disabled={busy}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:border-accent/50 disabled:opacity-60"
                >
                  <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>
                    <span className="block font-mono text-xs text-fg">{d.root}</span>
                    <span className="text-xs text-fg-muted">
                      {d.envs.map((e) => e.name).join(", ") || "ESO data folder"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (path.trim()) submitPath(path.trim());
            }}
          >
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="Paste a folder path, or browse…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openBrowse(path || undefined)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:text-fg"
              >
                <FolderSearch className="h-4 w-4" />
                Browse
              </button>
              <button
                type="submit"
                disabled={busy || !path.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Use this folder
              </button>
            </div>
          </form>

          {browseOpen && (
            <div className="mt-3 rounded-lg border border-border bg-bg-elev p-3">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <button
                  type="button"
                  disabled={!browse?.parent}
                  onClick={() => browse?.parent && openBrowse(browse.parent)}
                  className="rounded border border-border p-1 text-fg-muted disabled:opacity-30"
                  aria-label="Parent folder"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="truncate font-mono text-fg">{browse?.path}</span>
              </div>
              {browse?.error && <p className="mb-2 text-xs text-danger">{browse.error}</p>}
              <ul className="max-h-56 overflow-auto text-sm">
                {browse?.entries.map((e) => (
                  <li key={e.path} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-surface-2">
                    <button
                      type="button"
                      onClick={() => (e.kind === "dir" ? openBrowse(e.path) : submitPath(e.path))}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {e.kind === "dir" ? (
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent" />
                      ) : (
                        <Upload className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                      )}
                      <span className="truncate">{e.name}</span>
                    </button>
                    {e.kind === "dir" && (
                      <button
                        type="button"
                        className="shrink-0 text-xs text-accent hover:underline"
                        onClick={() => submitPath(e.path)}
                      >
                        Use
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-danger">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => action("rescan")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Scan again
            </button>
            {(status.config.esoDir || status.config.snapshotFile) && (
              <button
                type="button"
                onClick={() => action("reset")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-60"
              >
                Clear chosen path
              </button>
            )}
          </div>
        </Step>

        <Step n={2} title="Install the addons (automatic)" done={addonsOk}>
          {addonsOk ? (
            <p className="text-sm text-fg-muted">
              Nirnside copied <span className="font-medium text-fg">Nirnside Snapshot</span> and{" "}
              <span className="font-medium text-fg">Nirnside Catalog</span> into{" "}
              <span className="font-medium text-fg">{status.autoSetup!.addOnsDirs.length}</span> AddOns folder(s). It
              only writes its own folders — nothing else in your addons is touched.
            </p>
          ) : (
            <p className="text-sm text-fg-muted">
              Once a valid ESO data folder is selected, the addons are copied there automatically. You never copy files
              by hand.
            </p>
          )}
          {status.autoSetup?.errors?.length ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-danger">
              {status.autoSetup.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </Step>

        <Step n={3} title="Enable in game, then log out once" done={snapshotOk}>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-fg">
            <li>
              Launch ESO. At the character select screen open <span className="font-medium">AddOns</span> and enable{" "}
              <span className="font-medium">Nirnside Snapshot</span> (and Catalog, if you want the live encyclopedia).
            </li>
            <li>
              Log into a character, then log out — or type{" "}
              <code className="rounded bg-surface-2 px-1">/reloadui</code>. The addon runs only on logout, ReloadUI, or
              a manual <code className="rounded bg-surface-2 px-1">/nirnside</code> / keybind — never on zone or
              instance changes, never during combat. Bind{" "}
              <span className="font-medium">Save Nirnside snapshot</span> under Controls → Keybindings.
            </li>
            <li>This page picks up the file on its own. Repeat logout on each character you want in Nirnside.</li>
          </ol>
          {snapshotOk && status.dataSource ? (
            <p className="mt-3 font-mono text-xs text-ok">Reading {status.dataSource.path}</p>
          ) : (
            <p className="mt-3 text-xs text-fg-subtle">Waiting for NirnsideSnapshot.lua — this refreshes by itself.</p>
          )}
        </Step>

        <Step n={4} title="Optional: scan the live catalog" done={status.catalogFound}>
          <p className="mb-2 text-sm text-fg-muted">
            The encyclopedia already ships with mechanic-accurate reference data. To upgrade it to{" "}
            <span className="font-medium text-fg">in-game verified</span> values:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-fg">
            <li>
              Enable <span className="font-medium">Nirnside Catalog</span> in the AddOns menu.
            </li>
            <li>
              While AFK (not in combat), type <code className="rounded bg-surface-2 px-1">/nirncatalog</code>, then{" "}
              <code className="rounded bg-surface-2 px-1">/reloadui</code>.
            </li>
          </ol>
          {status.catalogFound && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ok">
              <ScanLine className="h-3.5 w-3.5" />
              In-game catalog loaded{status.catalogPath ? ` from ${status.catalogPath}` : ""}.
            </p>
          )}
        </Step>
      </ol>

      <Card className="p-4">
        <div className="mb-2 text-sm font-medium text-fg">No ESO on this machine?</div>
        <p className="mb-3 text-sm text-fg-muted">
          Copy <code className="rounded bg-surface-2 px-1">NirnsideSnapshot.lua</code> from the PC you play on (under
          SavedVariables) and drop it here. Nirnside still never uploads it.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-fg-muted hover:text-fg">
          <Upload className="h-4 w-4" />
          Upload a .lua file
          <input
            type="file"
            accept=".lua"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </label>
      </Card>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
            done ? "border-ok/40 bg-ok/10 text-ok" : "border-border text-fg-muted"
          }`}
        >
          {done ? <CheckCircle2 className="h-4 w-4" /> : n}
        </span>
        <h2 className="text-base font-medium text-fg">{title}</h2>
      </div>
      {children}
    </Card>
  );
}
