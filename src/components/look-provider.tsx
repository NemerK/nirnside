"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { LOOK_COOKIE, LOOK_STORAGE_KEY, lookCookieAssignment, normalizeLook, type Look } from "@/lib/look";

interface LookContextValue {
  look: Look;
  setLook: (look: Look) => void;
  /** The server already chose the look, so the shell does not wait on an effect. */
  ready: boolean;
}

const LookContext = createContext<LookContextValue>({
  look: "classic",
  setLook: () => {},
  ready: false,
});

const listeners = new Set<() => void>();

function emitLook() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LOOK_STORAGE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function storedLook(): Look {
  return normalizeLook(localStorage.getItem(LOOK_STORAGE_KEY));
}

function applyLook(look: Look) {
  const root = document.documentElement;
  root.classList.remove("look-classic", "look-atlas");
  root.classList.add(`look-${look}`);
  root.dataset.look = look;
}

export function LookProvider({ initialLook, children }: { initialLook: Look; children: React.ReactNode }) {
  const look = useSyncExternalStore(subscribe, storedLook, () => initialLook);

  useEffect(() => {
    const raw = localStorage.getItem(LOOK_STORAGE_KEY);
    const stored = raw == null ? look : normalizeLook(raw);
    if (raw == null) localStorage.setItem(LOOK_STORAGE_KEY, stored);
    document.cookie = lookCookieAssignment(stored);
    applyLook(stored);
  }, [look]);

  const setLook = useCallback((next: Look) => {
    localStorage.setItem(LOOK_STORAGE_KEY, next);
    document.cookie = lookCookieAssignment(next);
    applyLook(next);
    emitLook();
  }, []);

  return <LookContext.Provider value={{ look, setLook, ready: true }}>{children}</LookContext.Provider>;
}

export function useLook() {
  return useContext(LookContext);
}

/** Inline script run before paint so the shell and the cookie agree. */
export const lookScript = `
(function(){
  try {
    var t = localStorage.getItem('${LOOK_STORAGE_KEY}') || 'classic';
    if (t !== 'atlas' && t !== 'classic') t = 'classic';
    document.documentElement.classList.add('look-' + t);
    document.documentElement.dataset.look = t;
    document.cookie = '${LOOK_COOKIE}=' + t + '; Path=/; Max-Age=31536000; SameSite=Lax';
  } catch (e) {
    document.documentElement.classList.add('look-classic');
    document.documentElement.dataset.look = 'classic';
  }
})();
`;
