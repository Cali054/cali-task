"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Ban, CheckCircle2, Sparkles, TrendingUp } from "lucide-react";
import { useUI } from "@/lib/ui-store";
import { StatusBadge, PriorityBadge, Progress } from "@/components/ui/glass";
import { CtaLink, scrollToSection, useLandingAuth } from "./landing-kit";
import { PREVIEW_STATS, PreviewFrame, SprintHeroCard, ActivityList } from "./app-previews";
import { PREVIEW_METRICS } from "./preview-data";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** A small glass widget that drifts gently around the dashboard preview. */
function FloatingWidget({
  children,
  className,
  delay,
  float = 10,
  play,
}: {
  children: React.ReactNode;
  className?: string;
  delay: number;
  float?: number;
  play: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={className}
      initial={{ opacity: 0, scale: 0.9, y: 16 }}
      animate={play ? { opacity: 1, scale: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      <motion.div
        animate={reduce || !play ? undefined : { y: [0, -float, 0] }}
        transition={{ duration: 5 + delay * 2, repeat: Infinity, ease: "easeInOut", delay: delay + 0.7 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function HeroSection() {
  const reduce = useReducedMotion();
  const intro = useUI((s) => s.intro);
  const play = intro === "done";
  const { primaryHref, primaryLabel } = useLandingAuth();

  const line = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 28, filter: "blur(12px)" },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined,
    transition: { duration: 0.85, delay: 0.1 + i * 0.12, ease: EASE },
  });

  return (
    <section id="home" className="relative scroll-mt-24 overflow-x-clip px-4 pb-16 pt-32 sm:px-6 sm:pt-40 lg:pb-24">
      {/* Ambient light behind the hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="landing-orb left-[8%] top-[18%] size-[340px] bg-[var(--orb-a)]" />
        <div className="landing-orb right-[6%] top-[8%] size-[420px] bg-[var(--orb-b)] [animation-delay:-6s]" />
        <div className="landing-orb bottom-[4%] left-[40%] size-[360px] bg-[var(--orb-c)] [animation-delay:-11s]" />
      </div>

      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <motion.span
            {...line(0)}
            className="glass-soft inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-fg-2"
          >
            <Sparkles className="size-3.5 text-accent" /> Sprint management, beautifully simple
          </motion.span>
          <h1 className="mt-6 text-[40px] font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            <motion.span {...line(1)} className="block">
              Take Control of Your Work.
            </motion.span>
            <motion.span {...line(2)} className="text-gradient block pb-1">
              One Sprint at a Time.
            </motion.span>
          </h1>
          <motion.p {...line(3)} className="mx-auto mt-6 max-w-2xl text-base text-fg-2 text-pretty sm:text-lg">
            Organize your tasks, monitor sprint progress, track blockers, and turn your daily workload into measurable
            achievements.
          </motion.p>
          <motion.div {...line(4)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <CtaLink href={primaryHref} size="lg" className="w-full sm:w-auto">
              {primaryLabel}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </CtaLink>
            <CtaLink
              href="#features"
              variant="glass"
              size="lg"
              className="w-full sm:w-auto"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("features", reduce);
              }}
            >
              Explore Features
            </CtaLink>
          </motion.div>
        </div>

        {/* Floating dashboard preview */}
        <div className="relative mx-auto mt-16 max-w-5xl sm:mt-20">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.94, rotateX: 14 }}
            animate={play ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : undefined}
            transition={{ duration: 1.1, delay: 0.55, ease: EASE }}
            style={{ transformPerspective: 1400 }}
          >
            <div className={reduce ? undefined : "landing-float"}>
              <PreviewFrame label="Cali dashboard overview showing Sprint 2 progress, task statistics and recent activity" title="Overview">
                <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
                  <div className="min-w-0 space-y-3">
                    <SprintHeroCard />
                    <div className="grid grid-cols-3 gap-2.5">
                      {PREVIEW_STATS.slice(0, 3).map((s) => (
                        <div key={s.label} className="glass rounded-[18px] p-3">
                          <s.icon className="size-4" style={{ color: s.color }} />
                          <p className="mt-2 text-xl font-semibold tracking-tight">{s.value}</p>
                          <p className="truncate text-[11px] text-fg-2">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass hidden rounded-[24px] p-3 sm:block">
                    <p className="mb-3 text-xs font-semibold">Recent activity</p>
                    <ActivityList items={5} />
                  </div>
                </div>
              </PreviewFrame>
            </div>
          </motion.div>

          {/* Floating widgets */}
          <FloatingWidget play={play} delay={1.0} className="absolute -left-4 -top-16 hidden w-56 lg:block xl:-left-20">
            <div className="glass-strong rounded-[20px] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-fg-3">#42025</span>
                <StatusBadge status="in_progress" className="px-2 py-0.5 text-[10px]" />
              </div>
              <p className="mt-1.5 text-sm font-semibold">Accounting and budget sync</p>
              <div className="mt-2.5 flex items-center justify-between">
                <PriorityBadge priority="high" />
                <span className="text-[10px] text-fg-3">0.5 / 1d</span>
              </div>
              <Progress value={0.5} color="var(--st-progress)" className="mt-2 h-1.5" />
            </div>
          </FloatingWidget>

          <FloatingWidget play={play} delay={1.2} float={8} className="absolute -right-4 top-[6%] hidden md:block xl:-right-14">
            <div className="glass-strong flex items-center gap-3 rounded-[20px] p-3 pr-4">
              <span className="grid size-10 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--st-done)_16%,transparent)] text-st-done">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{PREVIEW_METRICS.completed} tasks completed</p>
                <p className="flex items-center gap-1 text-[11px] text-st-done">
                  <TrendingUp className="size-3" /> On track this sprint
                </p>
              </div>
            </div>
          </FloatingWidget>

          <FloatingWidget play={play} delay={1.4} float={12} className="absolute -bottom-6 right-[8%] hidden sm:block">
            <div className="glass-strong flex items-center gap-3 rounded-[20px] p-3 pr-4">
              <span className="grid size-10 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--st-blocked)_14%,transparent)] text-st-blocked">
                <Ban className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">1 blocker needs attention</p>
                <p className="text-[11px] text-fg-3">Waiting on finance team · 2d</p>
              </div>
            </div>
          </FloatingWidget>
        </div>
      </div>
    </section>
  );
}
