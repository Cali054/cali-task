"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CaliLogo } from "@/components/brand/cali-logo";
import { CtaLink, scrollToSection, useLandingAuth } from "./landing-kit";

export const LANDING_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "about", label: "About" },
] as const;

/** Highlights the nav link for the section currently in the middle of the viewport. */
function useActiveSection() {
  const [active, setActive] = useState<string>("home");
  useEffect(() => {
    const els = LANDING_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

function ThemeButton() {
  const setPref = useTheme((s) => s.setPref);
  return (
    <button
      onClick={() => setPref(document.documentElement.classList.contains("dark") ? "light" : "dark")}
      className="grid size-10 place-items-center rounded-2xl text-fg-2 transition hover:bg-[var(--glass-soft)] hover:text-fg"
      aria-label="Toggle dark mode"
    >
      <Sun className="hidden size-[18px] dark:block" />
      <Moon className="size-[18px] dark:hidden" />
    </button>
  );
}

export function LandingNavbar() {
  const reduce = useReducedMotion();
  const active = useActiveSection();
  const { authed, primaryHref, primaryLabel } = useLandingAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    scrollToSection(id, reduce);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <nav
        aria-label="Primary"
        className={cn(
          "mx-auto flex h-16 max-w-6xl items-center gap-3 rounded-[22px] px-3 transition-all duration-500 sm:px-4",
          scrolled ? "glass-strong" : "glass",
        )}
      >
        <a href="#home" onClick={go("home")} className="cali-hover flex shrink-0 items-center rounded-2xl" aria-label="Cali home">
          <CaliLogo height={38} priority />
        </a>

        <ul className="mx-auto hidden items-center gap-1 md:flex">
          {LANDING_SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={go(s.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative block rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                    isActive ? "text-fg" : "text-fg-2 hover:text-fg",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="landing-nav-active"
                      className="glass absolute inset-0 rounded-xl"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{s.label}</span>
                </a>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <ThemeButton />
          {!authed && (
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-2xl px-3.5 text-sm font-semibold text-fg-2 transition hover:bg-[var(--glass-soft)] hover:text-fg sm:inline-flex"
            >
              Log In
            </Link>
          )}
          <CtaLink href={primaryHref} className="hidden sm:inline-flex">
            {primaryLabel}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </CtaLink>
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 place-items-center rounded-2xl text-fg-2 transition hover:bg-[var(--glass-soft)] hover:text-fg md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="landing-mobile-menu"
            className="glass-strong mx-auto mt-2 max-w-6xl rounded-[22px] bg-[color-mix(in_srgb,var(--bg-3)_94%,transparent)] p-3 md:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <ul className="flex flex-col gap-1">
              {LANDING_SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={go(s.id)}
                    className={cn(
                      "flex h-11 items-center rounded-2xl px-3 text-sm font-medium",
                      active === s.id ? "glass text-fg" : "text-fg-2 hover:bg-[var(--glass-soft)]",
                    )}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:hidden">
              {!authed && (
                <Link href="/login" className="glass-soft flex h-11 items-center justify-center rounded-2xl text-sm font-semibold">
                  Log In
                </Link>
              )}
              <CtaLink href={primaryHref} className="h-11">
                {primaryLabel}
              </CtaLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
