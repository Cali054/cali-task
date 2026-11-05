"use client";

import { create } from "zustand";

export type ThemePref = "light" | "dark" | "system";
import { THEME_KEY } from "./theme-boot";
export { THEME_KEY };

function resolve(pref: ThemePref) {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePref) {
  const mode = resolve(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.theme = mode;
}

interface ThemeState {
  pref: ThemePref;
  init: () => void;
  setPref: (p: ThemePref) => void;
}

export const useTheme = create<ThemeState>()((set) => ({
  pref: "system",
  init: () => {
    let pref: ThemePref = "system";
    try {
      pref = (localStorage.getItem(THEME_KEY) as ThemePref) || "system";
    } catch {}
    set({ pref });
    applyTheme(pref);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (useTheme.getState().pref === "system") applyTheme("system");
    });
  },
  setPref: (pref) => {
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch {}
    set({ pref });
    applyTheme(pref);
  },
}));
