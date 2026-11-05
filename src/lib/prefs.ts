"use client";

/** Device-level preferences that apply before anyone signs in. */
const SHOW_INTRO_KEY = "cali-task:show-intro";
export const INTRO_SEEN_KEY = "cali-task:intro-seen";

export function getShowIntro() {
  try {
    return localStorage.getItem(SHOW_INTRO_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setShowIntro(v: boolean) {
  try {
    localStorage.setItem(SHOW_INTRO_KEY, v ? "1" : "0");
  } catch {}
}
