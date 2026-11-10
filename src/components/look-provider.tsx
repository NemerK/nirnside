"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LOOK_STORAGE_KEY, normalizeLook, type Look } from "@/lib/look";

interface LookContextValue {
  look: Look;
  setLook: (look: Look) => void;
  /** False until localStorage has been read — avoid flashing the wrong shell. */
  ready: boolean;
}

const LookContext = createContext<LookContextValue>({
  look: "classic",
  setLook: () => {},
  ready: false,
});

function applyLook(look: Look) {
  const root = document.documentElement;
  root.classList.remove("look-classic", "look-atlas");
  root.classList.add(`look-${look}`);
  root.dataset.look = look;
}

export function LookProvider({ children }: { children: React.ReactNode }) {
  const [look, setLookState] = useState<Look>("classic");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = normalizeLook(localStorage.getItem(LOOK_STORAGE_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLookState(stored);
    applyLook(stored);
    setReady(true);
  }, []);

  const setLook = useCallback((next: Look) => {
    setLookState(next);
    localStorage.setItem(LOOK_STORAGE_KEY, next);
    applyLook(next);
  }, []);

  return <LookContext.Provider value={{ look, setLook, ready }}>{children}</LookContext.Provider>;
}

export function useLook() {
  return useContext(LookContext);
}

/** Inline script run before paint so Atlas tokens apply without a flash. */
export const lookScript = `
(function(){
  try {
    var t = localStorage.getItem('${LOOK_STORAGE_KEY}') || 'classic';
    if (t !== 'atlas' && t !== 'classic') t = 'classic';
    document.documentElement.classList.add('look-' + t);
    document.documentElement.dataset.look = t;
  } catch (e) {
    document.documentElement.classList.add('look-classic');
    document.documentElement.dataset.look = 'classic';
  }
})();
`;
