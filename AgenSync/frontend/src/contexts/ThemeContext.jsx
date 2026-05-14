import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEME_STORAGE_KEY = "agensync_theme";
const themes = new Set(["light", "dark"]);

const ThemeContext = createContext(null);

function normalizeTheme(value) {
  return themes.has(value) ? value : "light";
}

function readStoredTheme() {
  if (typeof window === "undefined") return "light";
  return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const nextTheme = normalizeTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", nextTheme === "dark");
  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((value) => {
    setThemeState(normalizeTheme(value));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme
    }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider.");
  }
  return context;
}
