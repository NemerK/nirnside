"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "nirnside-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", setTheme: () => {} });

function resolve(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return theme;
}

function apply(theme: Theme) {
  const resolved = resolve(theme);
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(`theme-${resolved}`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // Sync React state from the persisted theme after mount. The pre-paint
    // inline script already applied the correct class, so this only aligns the
    // toggle's active state; SSR can't read localStorage.
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored);
    apply(stored);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    apply(t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Inline script run before paint to avoid a flash of the wrong theme. */
export const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('${STORAGE_KEY}') || 'dark';
    var resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : t;
    document.documentElement.classList.add('theme-' + resolved);
  } catch (e) {
    document.documentElement.classList.add('theme-dark');
  }
})();
`;
