"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { TOURS, type TourStep } from "@/lib/tours";
import { cn } from "@/lib/utils";

const PAD = 8; // spotlight padding around the target
const GAP = 14; // space between spotlight and card
const EDGE = 12; // min distance from viewport edges

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** First matching element that is actually visible on screen. */
function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  const ids = Array.isArray(step.target) ? step.target : [step.target];
  for (const id of ids) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
}

export function TourOverlay() {
  const tour = useUI((s) => s.tour);
  const setTourStep = useUI((s) => s.setTourStep);
  const endTour = useUI((s) => s.endTour);
  const markTourSeen = useStore((s) => s.markTourSeen);
  const markAllToursSeen = useStore((s) => s.markAllToursSeen);
  const reduce = useReducedMotion();

  const def = tour ? TOURS[tour.id] : null;
  const step = def && tour ? def.steps[tour.step] : null;
  const isFirst = tour?.step === 0;
  const isLast = !!def && !!tour && tour.step === def.steps.length - 1;

  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const finish = useCallback(() => {
    if (tour) markTourSeen(tour.id);
    endTour();
  }, [tour, markTourSeen, endTour]);

  const next = useCallback(() => {
    if (!def || !tour) return;
    if (tour.step >= def.steps.length - 1) finish();
    else setTourStep(tour.step + 1);
  }, [def, tour, finish, setTourStep]);

  const back = useCallback(() => {
    if (tour && tour.step > 0) setTourStep(tour.step - 1);
  }, [tour, setTourStep]);

  // Locate the target for this step, bring it into view, then track it.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step);
    targetRef.current = el;
    if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        setRect(targetRef.current && targetRef.current.isConnected ? measure(targetRef.current) : null);
      });
    };
    update();
    // Smooth scrolling moves the target for a moment; keep following it.
    const settle = window.setInterval(update, 120);
    const stopSettle = window.setTimeout(() => window.clearInterval(settle), 900);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(settle);
      window.clearTimeout(stopSettle);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step, reduce]);

  const shown = vw > 0;

  // Measure the card so it can be placed above or below the target.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const ro = new ResizeObserver(([e]) => setCardH(e.contentRect.height + 2));
    ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [tour?.id, tour?.step, shown]);

  // Keyboard: ← → to move, Esc to skip.
  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, finish, next, back]);

  // Move focus to the card for screen readers and keyboard users.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [tour?.id, tour?.step, shown]);

  if (typeof document === "undefined") return null;

  // Card placement.
  const cardW = Math.min(360, vw - EDGE * 2);
  let cardStyle: { left: number; top: number };
  let placement: "below" | "above" | "center" | "dock";
  if (!rect) {
    placement = "center";
    cardStyle = { left: (vw - cardW) / 2, top: Math.max(EDGE, (vh - cardH) / 2) };
  } else {
    const below = rect.top + rect.height + GAP;
    const above = rect.top - GAP - cardH;
    const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - cardW / 2), vw - cardW - EDGE);
    if (below + cardH <= vh - EDGE) {
      placement = "below";
      cardStyle = { left, top: below };
    } else if (above >= EDGE) {
      placement = "above";
      cardStyle = { left, top: above };
    } else if (vw - (rect.left + rect.width) >= cardW + GAP + EDGE) {
      // Tall target with room beside it (e.g. the sidebar): sit to its right.
      placement = "dock";
      cardStyle = { left: rect.left + rect.width + GAP, top: Math.max(EDGE, (vh - cardH) / 2) };
    } else if (rect.left >= cardW + GAP + EDGE) {
      placement = "dock";
      cardStyle = { left: rect.left - GAP - cardW, top: Math.max(EDGE, (vh - cardH) / 2) };
    } else {
      // Target fills the screen: dock the card to the bottom.
      placement = "dock";
      cardStyle = { left: (vw - cardW) / 2, top: vh - cardH - EDGE };
    }
  }

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 380, damping: 36 };

  return createPortal(
    <AnimatePresence>
      {tour && def && step && shown && (
        <motion.div
          key="tour"
          className="fixed inset-0 z-[90]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Click shield: the page stays visible but can't be used mid-tour. */}
          <div className="absolute inset-0" aria-hidden />

          {rect ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute rounded-[22px] ring-2 ring-white/70 dark:ring-white/40"
              style={{ boxShadow: "0 0 0 9999px rgba(10, 12, 32, 0.58), 0 0 32px 4px color-mix(in srgb, var(--accent) 45%, transparent)" }}
              initial={false}
              animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
              transition={spring}
            />
          ) : (
            <div aria-hidden className="absolute inset-0 bg-[rgba(10,12,32,0.58)] backdrop-blur-[2px]" />
          )}

          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-body"
            tabIndex={-1}
            className={cn(
              "glass-strong absolute rounded-[24px] p-5 outline-none",
              placement === "center" && "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)]",
            )}
            style={{ width: cardW }}
            initial={{ opacity: 0, y: 8, ...cardStyle }}
            animate={{ opacity: 1, y: 0, ...cardStyle }}
            transition={spring}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full bg-accent/12 px-2.5 py-1 text-[11px] font-semibold text-accent">
                {def.name} · {tour.step + 1} of {def.steps.length}
              </span>
              <button
                onClick={finish}
                className="grid size-8 place-items-center rounded-xl text-fg-3 transition hover:bg-[var(--glass-soft)] hover:text-fg"
                aria-label="Close tour"
              >
                <X className="size-4" />
              </button>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tour.step}
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? undefined : { opacity: 0, x: -8 }}
                transition={{ duration: 0.16 }}
                aria-live="polite"
              >
                <h2 id="tour-title" className="text-base font-semibold tracking-tight">
                  {step.title}
                </h2>
                <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-fg-2">
                  {step.body}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex items-center gap-1.5" aria-hidden>
              {def.steps.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === tour.step ? "w-5 accent-gradient" : "w-1.5 bg-[var(--glass-line)]",
                    i < tour.step && "bg-accent/50",
                  )}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              {isFirst && tour.id === "overview" ? (
                <button
                  onClick={() => {
                    markAllToursSeen();
                    endTour();
                  }}
                  className="mr-auto text-xs font-medium text-fg-3 hover:text-fg hover:underline"
                >
                  Skip all tours
                </button>
              ) : (
                <button onClick={finish} className="mr-auto text-xs font-medium text-fg-3 hover:text-fg hover:underline">
                  Skip tour
                </button>
              )}
              {!isFirst && (
                <button
                  onClick={back}
                  className="glass-soft inline-flex h-10 items-center gap-1.5 rounded-2xl px-3.5 text-sm font-medium transition hover:bg-[var(--glass-hover)]"
                >
                  <ArrowLeft className="size-4" /> Back
                </button>
              )}
              <button
                onClick={next}
                className="accent-gradient inline-flex h-10 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_var(--accent)] transition hover:brightness-110"
              >
                {isLast ? (
                  <>
                    <Check className="size-4" /> Got it
                  </>
                ) : (
                  <>
                    {isFirst && tour.id === "overview" ? "Start tour" : "Next"} <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
