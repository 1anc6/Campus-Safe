import { useSyncExternalStore } from "react";

/**
 * App-wide light/dark theme. Light is the default; the choice is stored in
 * localStorage and applied as <html data-theme="…">, which every colour token
 * in styles.css keys off. One source of truth for all shells and pages.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "campussafe.theme";
const CHANGE_EVENT = "campussafe:theme";
const META_COLOR: Record<Theme, string> = { light: "#f3f5f8", dark: "#1f1e1d" };

/**
 * Inlined in <head> so the saved theme is applied before first paint (no flash
 * of the wrong theme). Keep it tiny and dependency-free.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=document.documentElement;d.dataset.theme=t==="dark"?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"${META_COLOR.dark}":"${META_COLOR.light}")}catch(e){document.documentElement.dataset.theme="light"}})();`;

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  // Brief cross-fade for the switch only (not for first paint).
  root.classList.add("theme-transition");
  root.dataset.theme = theme;
  window.setTimeout(() => root.classList.remove("theme-transition"), 250);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META_COLOR[theme]);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage blocked — the theme still applies for this page view */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    // Keep other open tabs in sync.
    if (e.key === STORAGE_KEY) {
      document.documentElement.dataset.theme = e.newValue === "dark" ? "dark" : "light";
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current theme for components that must pass colours to JS (charts, toasts). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}
