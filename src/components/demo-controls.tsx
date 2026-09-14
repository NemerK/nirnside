"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle, LogOut } from "lucide-react";

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

export function ExitDemoButton() {
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
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted transition-colors hover:text-fg disabled:opacity-60"
    >
      <LogOut className="h-3.5 w-3.5" />
      {busy ? "Exiting…" : "Exit demo"}
    </button>
  );
}
