"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { Mail } from "lucide-react";
import { LEGAL } from "@/lib/legal";
import { CaliLogo } from "@/components/brand/cali-logo";
import { scrollToSection, useLandingAuth } from "./landing-kit";

export function LandingFooter() {
  const reduce = useReducedMotion();
  const { authed } = useLandingAuth();

  const section = (id: string, label: string) => (
    <a
      href={`#${id}`}
      onClick={(e) => {
        e.preventDefault();
        scrollToSection(id, reduce);
      }}
      className="transition hover:text-accent"
    >
      {label}
    </a>
  );

  const columns: { title: string; links: React.ReactNode[] }[] = [
    {
      title: "Product",
      links: [
        section("home", "Home"),
        section("features", "Features"),
        section("how-it-works", "How It Works"),
        section("about", "About"),
      ],
    },
    {
      title: "Account",
      links: authed
        ? [<Link key="d" href="/dashboard" className="transition hover:text-accent">Dashboard</Link>]
        : [
            <Link key="s" href="/signup" className="transition hover:text-accent">Get Started</Link>,
            <Link key="l" href="/login" className="transition hover:text-accent">Log In</Link>,
          ],
    },
    {
      title: "Legal",
      links: [
        <Link key="p" href="/privacy-policy" className="transition hover:text-accent">Privacy Policy</Link>,
        <Link key="t" href="/terms-and-conditions" className="transition hover:text-accent">Terms &amp; Conditions</Link>,
      ],
    },
  ];

  return (
    <footer className="px-4 pb-8 pt-8 sm:px-6">
      <div className="glass mx-auto max-w-6xl rounded-[32px] p-6 sm:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <CaliLogo height={44} tagline />
            <p className="mt-5 max-w-sm text-sm text-fg-2">
              Cali is a productivity and sprint management platform that helps you organize tasks, monitor progress,
              track blockers and measure productivity.
            </p>
            <a
              href={`mailto:${LEGAL.contactEmail}`}
              className="glass-soft mt-5 inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-medium text-fg-2 transition hover:text-accent"
            >
              <Mail className="size-4" aria-hidden /> {LEGAL.contactEmail}
            </a>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((c) => (
              <div key={c.title}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fg-3">{c.title}</p>
                <ul className="mt-4 space-y-3 text-sm text-fg-2">
                  {c.links.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-line pt-6 text-xs text-fg-3 sm:flex-row">
          <p>© 2026 Cali. All rights reserved.</p>
          <p>Plan. Track. Complete.</p>
        </div>
      </div>
    </footer>
  );
}
