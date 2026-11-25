import type { Accent, Theme } from "./types";

const KEY = "nexus:theme";

export function applyTheme(theme: Theme, accent: Accent) {
  const resolved =
    theme === "system" ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  try {
    localStorage.setItem(KEY, JSON.stringify({ theme, accent }));
  } catch {
    /* storage unavailable */
  }
}

/** Inline script run before paint so the stored theme never flashes. */
export const themeBootScript = `(function(){try{var s=JSON.parse(localStorage.getItem("${KEY}")||"{}");var t=s.theme||"dark";if(t==="system"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t;document.documentElement.dataset.accent=s.accent||"violet"}catch(e){}})();`;
