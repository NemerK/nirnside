"use client";

import { useEffect, useState } from "react";

const RETRY_KEY = "nirnside:loading-retry";

/**
 * Next.js swaps the page for `loading.tsx` the instant a client navigation
 * starts. After the window has been idle (or the RSC request dies), that
 * swap can last forever — title bars, empty card, nothing else. If this
 * skeleton is still mounted after a short wait, do a real document load
 * of the URL the user already asked for. One retry per URL so a genuinely
 * slow page cannot loop.
 */
export function LoadingRecovery() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const slowTimer = window.setTimeout(() => setSlow(true), 900);
    const recoverTimer = window.setTimeout(() => {
      const url = window.location.href;
      const last = sessionStorage.getItem(RETRY_KEY);
      if (last === url) return;
      sessionStorage.setItem(RETRY_KEY, url);
      window.location.replace(url);
    }, 2200);
    return () => {
      window.clearTimeout(slowTimer);
      window.clearTimeout(recoverTimer);
    };
  }, []);

  if (!slow) return null;
  return (
    <p className="mt-4 text-sm text-fg-muted">
      Still opening this page…
      <button
        type="button"
        className="ml-2 text-accent hover:underline"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </p>
  );
}

/** Call from a real page mount so the next navigation can retry again. */
export function clearLoadingRetry() {
  try {
    sessionStorage.removeItem(RETRY_KEY);
  } catch {
    // private mode / no storage
  }
}
