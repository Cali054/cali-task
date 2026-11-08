"use client";

import { ArrowRight } from "lucide-react";
import { CaliLogoIcon } from "@/components/brand/cali-logo";
import { CtaLink, Reveal, useLandingAuth } from "./landing-kit";

export function FinalCTA() {
  const { authed } = useLandingAuth();
  return (
    <section aria-labelledby="cta-title" className="relative px-4 py-20 sm:px-6 lg:py-24">
      <Reveal y={40} className="mx-auto max-w-6xl">
        <div className="glass-strong relative overflow-hidden rounded-[36px] px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="landing-orb -left-20 -top-24 size-[360px] bg-[var(--orb-a)]" />
            <div className="landing-orb -bottom-28 -right-16 size-[400px] bg-[var(--orb-b)] [animation-delay:-8s]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
          </div>
          <div className="relative">
            <CaliLogoIcon size={64} float glow className="mx-auto" />
            <h2 id="cta-title" className="mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Your Next Sprint Starts Here.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-fg-2 sm:text-lg">
              Bring your tasks, progress, and productivity together with Cali.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <CtaLink href={authed ? "/dashboard" : "/signup"} size="lg" className="w-full sm:w-auto">
                {authed ? "Open your Dashboard" : "Get Started with Cali"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </CtaLink>
              {!authed && (
                <CtaLink href="/login" variant="glass" size="lg" className="w-full sm:w-auto">
                  I already have an account
                </CtaLink>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
