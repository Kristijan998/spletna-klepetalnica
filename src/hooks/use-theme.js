import { useCallback, useEffect, useState } from "react";

const THEME_STORAGE_KEY = "theme";

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  if (!window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  return null;
}

export function applyTheme(theme) {
  const next = normalizeTheme(theme);
  document.documentElement.classList.toggle("dark", next === "dark");
}

export function applyInitialTheme() {
  const stored = getStoredTheme();
  const theme = stored || getSystemTheme();
  applyTheme(theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => getStoredTheme() || getSystemTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
    } catch {
      // ignore
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(normalizeTheme(next));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (normalizeTheme(t) === "dark" ? "light" : "dark"));
  }, []);

  return {
    theme: normalizeTheme(theme),
    isDark: normalizeTheme(theme) === "dark",
    setTheme,
    toggleTheme,
  };
}
