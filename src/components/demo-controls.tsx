"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, RotateCcw } from "lucide-react";

export function LoadDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/demo", { method: "POST" });
        router.refresh();
      }}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-accent-fg disabled:opacity-60"
    >
      <PlayCircle className="h-4 w-4" />
      {busy ? "Loading demo…" : "Explore a demo account"}
    </button>
  );
}

export function LoadLiveAccountButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/demo", { method: "DELETE" });
        router.refresh();
      }}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:brightness-110 disabled:opacity-60"
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {busy ? "Loading…" : "Load my ESO account"}
    </button>
  );
}

export function ExitDemoButton() {
  return <LoadLiveAccountButton />;
}
