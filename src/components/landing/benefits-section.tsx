"use client";

import { CalendarClock, Eye, LayoutGrid, Scale, TrendingUp, Zap, type LucideIcon } from "lucide-react";
import { Reveal, SectionHeading } from "./landing-kit";
import { PreviewFrame, SprintHeroCard, TimelinePreview } from "./app-previews";

const BENEFITS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Eye, title: "Clear task visibility", text: "Every task, status and owner note in one view." },
  { icon: LayoutGrid, title: "Better sprint organization", text: "Goals, dates and estimates live with the sprint." },
  { icon: Scale, title: "Workload management", text: "Compare committed targets with estimated effort." },
  { icon: Zap, title: "Improved productivity", text: "Spend less time updating, more time shipping." },
  { icon: CalendarClock, title: "Deadline awareness", text: "Overdue and at-risk tasks surface on their own." },
  { icon: TrendingUp, title: "Progress tracking", text: "Burndown and completion trends, updated live." },
];

/** "About" section: what Cali gives you, next to a live-looking preview. */
export function BenefitsSection() {
  return (
    <section id="about" className="relative scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeading
            align="start"
            eyebrow="Why Cali"
            title="Everything You Need to Stay on Track."
            text="Cali is a personal productivity and sprint management platform. It keeps your plan, your progress and your problems side by side, so you always know what to do next."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {BENEFITS.map((b, i) => (
              <li key={b.title}>
                <Reveal delay={i * 0.05} className="h-full">
                  <div className="glass-soft flex h-full gap-3 rounded-[20px] p-4 transition duration-300 hover:bg-[var(--glass-hover)]">
                    <span className="accent-gradient grid size-9 shrink-0 place-items-center rounded-xl text-white">
                      <b.icon className="size-4" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{b.title}</p>
                      <p className="mt-0.5 text-xs text-fg-2">{b.text}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <Reveal y={40} className="relative min-w-0">
          <div aria-hidden className="pointer-events-none absolute -inset-8 -z-10 rounded-[60px] bg-[radial-gradient(60%_60%_at_60%_50%,var(--orb-b),transparent_70%)] opacity-70 blur-2xl" />
          <PreviewFrame label="Cali timeline showing each Sprint 2 task as a bar across the sprint's working days" active={3} title="Timeline">
            <div className="space-y-3">
              <SprintHeroCard compact />
              <TimelinePreview />
            </div>
          </PreviewFrame>
        </Reveal>
      </div>
    </section>
  );
}
