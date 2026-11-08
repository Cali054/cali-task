"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Where the landing page's calls to action lead. Uses the real auth store:
 * signed-in visitors go to their dashboard, everyone else to sign up / log in.
 */
export function useLandingAuth() {
  const status = useAuth((s) => s.status);
  useEffect(() => {
    useAuth.getState().init();
  }, []);
  const authed = status === "authed";
  return {
    status,
    authed,
    primaryHref: authed ? "/dashboard" : "/signup",
    primaryLabel: authed ? "Open Dashboard" : "Get Started",
  };
}

/** Scrolls to a section, honouring reduced motion. */
export function scrollToSection(id: string, reduce: boolean | null) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", id === "home" ? window.location.pathname : `#${id}`);
}

/** Fades content up when it scrolls into view (once). */
export function Reveal({
  children,
  delay = 0,
  className,
  y = 24,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  text?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <Reveal className={cn("mb-10 max-w-2xl sm:mb-14", align === "center" && "mx-auto text-center")}>
      <span className="glass-soft inline-block rounded-full px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-[42px] sm:leading-[1.1]">{title}</h2>
      {text && <p className="mt-4 text-base text-fg-2 text-pretty sm:text-lg">{text}</p>}
    </Reveal>
  );
}

/** Primary / glass call-to-action link with a gentle press animation. */
export function CtaLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "glass";
  size?: "md" | "lg";
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.97]",
        size === "md" ? "h-10 rounded-2xl px-4 text-sm" : "h-12 rounded-[18px] px-6 text-[15px]",
        variant === "primary"
          ? "accent-gradient text-white shadow-[0_12px_30px_-10px_color-mix(in_srgb,var(--accent)_75%,transparent)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-12px_color-mix(in_srgb,var(--accent)_85%,transparent)] hover:brightness-110"
          : "glass text-fg hover:-translate-y-0.5 hover:bg-[var(--glass-hover)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
