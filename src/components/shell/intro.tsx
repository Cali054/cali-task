"use client";

import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";

const DURATION_MS = 2300;

/** Full-screen intro: glass orb, title blur-to-focus, tagline, then hands off. */
export function Intro({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(onDone, reduce ? 900 : DURATION_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone, reduce]);

  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: (i * 37 + 11) % 100,
        top: (i * 53 + 7) % 100,
        size: 10 + ((i * 29) % 44),
        delay: (i % 6) * 0.12,
        drift: ((i % 2 ? 1 : -1) * (12 + (i % 4) * 6)),
      })),
    [],
  );

  return (
    <motion.div
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
      style={{
        background:
          "radial-gradient(900px 600px at 30% 20%, var(--bg-1), transparent 60%), radial-gradient(800px 600px at 80% 80%, var(--bg-2), transparent 60%), linear-gradient(160deg, var(--bg-1), var(--bg-2))",
      }}
      initial={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      role="dialog"
      aria-label="Cali's Task intro"
    >
      {!reduce &&
        particles.map((p) => (
          <motion.span
            key={p.id}
            className="glass-soft absolute rounded-full"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 0.8, 0.6], y: [20, p.drift * -1, p.drift * -2] }}
            transition={{ duration: 2.4, delay: p.delay, ease: "easeOut" }}
          />
        ))}

      <div className="relative flex flex-col items-center px-6 text-center">
        <motion.div
          className="relative mb-8 size-28 sm:size-32"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(12px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="absolute inset-[-30%] rounded-full bg-[radial-gradient(circle,var(--orb-b),transparent_65%)] blur-2xl" />
          <motion.div
            className="glass absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), rgba(255,255,255,0.15) 35%, transparent 60%), linear-gradient(140deg, var(--accent-3), var(--accent) 50%, var(--accent-2))",
            }}
            animate={reduce ? undefined : { rotate: [0, 12, 0] }}
            transition={{ duration: 2.4, ease: "easeInOut" }}
          />
          <div className="absolute inset-[18%] rounded-full border border-white/50" />
        </motion.div>

        <motion.h1
          className="text-4xl font-semibold tracking-[0.18em] sm:text-6xl"
          initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(14px)", y: 10, letterSpacing: "0.4em" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", y: 0, letterSpacing: "0.18em" }}
          transition={{ duration: 0.9, delay: reduce ? 0 : 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
          CALI&apos;S <span className="text-gradient">TASK</span>
        </motion.h1>
        <motion.p
          className="mt-4 text-xs font-medium uppercase tracking-[0.45em] text-fg-2 sm:text-sm"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: reduce ? 0 : 0.9 }}
        >
          Plan. Track. Complete.
        </motion.p>
      </div>

      <button
        onClick={onDone}
        className="glass-soft absolute bottom-6 right-6 rounded-full px-4 py-2 text-xs font-medium text-fg-2 transition hover:text-fg"
      >
        Skip intro
      </button>
    </motion.div>
  );
}
