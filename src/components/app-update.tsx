"use client";

import { useEffect, useRef, useState } from "react";
import { NirnsideMark } from "./nirnside-mark";

interface UpdateStatus {
  available: boolean;
  label: string;
  launcherUrl: string | null;
  bootedAt: number;
}

interface LauncherState {
  phase?: string;
  step?: string;
  detail?: string;
  percent?: number;
  error?: string;
}

interface Health {
  ok?: boolean;
  bootedAt?: number;
}

const POLL_MS = 60_000;

/**
 * While the window is open, ask the local server if GitHub has a newer
 * revision. Update switches this same window to a loading screen; the
 * launcher (or the detached restarter) replaces the server, and the screen
 * reloads once a new process answers.
 */
export function AppUpdate() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [phase, setPhase] = useState<"idle" | "updating">("idle");
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState("Updating Nirnside");
  const [detail, setDetail] = useState("Downloading the latest version. This window reloads when it is ready.");
  const [percent, setPercent] = useState(8);
  const boot = useRef<number | null>(null);

  useEffect(() => {
    if (phase === "updating") return;
    let timer = 0;
    const load = async () => {
      try {
        const res = await fetch("/api/update", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as UpdateStatus;
        if (boot.current == null && data.bootedAt) boot.current = data.bootedAt;
        setStatus(data);
      } catch {
        /* Offline or restarting. The last answer stays put. */
      }
    };
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase]);

  useEffect(() => {
    if (!watching || error) return;
    let stop = false;
    const started = Date.now();
    const launcherUrl = status?.launcherUrl ?? null;

    const tick = async () => {
      while (!stop) {
        if (launcherUrl) {
          try {
            const res = await fetch(`${launcherUrl}/api/state`, { cache: "no-store" });
            if (res.ok) {
              const launcher = (await res.json()) as LauncherState;
              if (launcher.step) setStep(launcher.step);
              if (launcher.detail) setDetail(launcher.detail);
              if (typeof launcher.percent === "number") setPercent(launcher.percent);
              if (launcher.phase === "error") {
                setError(launcher.error || "The update did not finish.");
                return;
              }
            }
          } catch {
            /* Progress is optional. Reloading depends on the app answering again. */
          }
        }

        let health: Health | null = null;
        try {
          const res = await fetch("/api/health", { cache: "no-store" });
          if (res.ok) health = (await res.json()) as Health;
        } catch {
          health = null;
        }

        if (health?.ok && health.bootedAt && boot.current != null && health.bootedAt !== boot.current) {
          window.location.reload();
          return;
        }
        if (health?.ok && health.bootedAt && boot.current == null) boot.current = health.bootedAt;

        const age = Date.now() - started;
        if (health?.ok && health.bootedAt === boot.current && age > 45_000) {
          setError("The update did not restart Nirnside. Start it from the shortcut to try again.");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    };

    void tick();
    return () => {
      stop = true;
    };
  }, [watching, error, status?.launcherUrl]);

  async function onUpdate() {
    setError(null);
    setPhase("updating");
    setStep("Updating Nirnside");
    setDetail("Downloading the latest version. This window reloads when it is ready.");
    setPercent(8);
    try {
      const res = await fetch("/api/update", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not start the update.");
        return;
      }
    } catch {
      /* The server may already be exiting. Keep the loading screen up. */
    }
    setWatching(true);
  }

  if (phase === "updating") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg px-6" role="status" aria-live="polite">
        <div className="w-full max-w-md text-center">
          <NirnsideMark className="mx-auto h-14 w-14" />
          <h1 className="mt-5 text-xl font-semibold text-fg">{error ? "Update did not finish" : step}</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{error || detail}</p>
          {!error && (
            <div className="mt-6 h-2 overflow-hidden rounded-full border border-border bg-bg-elev" aria-hidden>
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
              />
            </div>
          )}
          {error ? (
            <button
              type="button"
              onClick={() => {
                setWatching(false);
                setPhase("idle");
                setError(null);
              }}
              className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:brightness-110"
            >
              Back to Nirnside
            </button>
          ) : (
            <p className="mt-4 text-xs text-fg-subtle">Your account stays on this PC. Nothing is uploaded.</p>
          )}
        </div>
      </div>
    );
  }

  if (!status?.available) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-accent/40 bg-accent-soft px-4 py-2.5 text-sm">
      <p className="min-w-0 text-fg">
        A Nirnside update is ready
        {status.label ? <span className="text-fg-subtle"> · {status.label}</span> : null}
      </p>
      <button
        type="button"
        onClick={() => void onUpdate()}
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:brightness-110"
      >
        Update
      </button>
    </div>
  );
}
