"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { useTheme } from "@/lib/theme";
import { useUI } from "@/lib/ui-store";
import { getShowIntro, INTRO_SEEN_KEY } from "@/lib/prefs";
import { Intro } from "./intro";

function Background() {
  return (
    <div className="app-bg" aria-hidden>
      <span className="orb" style={{ width: 520, height: 520, left: "-8%", top: "-10%", background: "var(--orb-a)" }} />
      <span className="orb" style={{ width: 600, height: 600, right: "-12%", top: "20%", background: "var(--orb-b)", animationDelay: "-7s" }} />
      <span className="orb" style={{ width: 420, height: 420, left: "30%", bottom: "-15%", background: "var(--orb-c)", animationDelay: "-13s" }} />
    </div>
  );
}

/**
 * Wraps every route: ambient background, theme, and the intro animation,
 * which plays once per session before whichever page loads first (login or
 * dashboard) and then hands off to that page's own entrance animation.
 */
export function RootChrome({ children }: { children: ReactNode }) {
  const intro = useUI((s) => s.intro);
  const setIntro = useUI((s) => s.setIntro);

  useEffect(() => {
    useTheme.getState().init();
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
    } catch {}
    setIntro(getShowIntro() && !seen ? "show" : "done");
  }, [setIntro]);

  const finishIntro = useCallback(() => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {}
    setIntro("done");
  }, [setIntro]);

  return (
    <>
      <Background />
      <AnimatePresence>{intro === "show" && <Intro key="intro" onDone={finishIntro} />}</AnimatePresence>
      {children}
    </>
  );
}
