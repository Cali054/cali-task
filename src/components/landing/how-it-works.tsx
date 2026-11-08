"use client";

import { motion, useReducedMotion } from "motion/react";
import { LineChart, ListChecks, Rocket, type LucideIcon } from "lucide-react";
import { Reveal, SectionHeading } from "./landing-kit";

const STEPS: { n: string; icon: LucideIcon; title: string; text: string }[] = [
  { n: "01", icon: Rocket, title: "Create Your Sprint", text: "Set your sprint goals, deadlines, and estimated duration." },
  { n: "02", icon: ListChecks, title: "Manage Your Tasks", text: "Organize tasks, update statuses, and track blockers." },
  { n: "03", icon: LineChart, title: "Monitor Your Progress", text: "Review your productivity, completion rate, and sprint performance." },
];

/** Line that draws itself between the step cards (horizontal on desktop, vertical on phones). */
function Connector({ vertical }: { vertical?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div
      aria-hidden
      className={
        vertical
          ? "absolute bottom-10 left-[39px] top-10 w-[2px] overflow-hidden rounded-full bg-[var(--glass-line)] md:hidden"
          : "absolute left-[16.6%] right-[16.6%] top-[46px] hidden h-[2px] overflow-hidden rounded-full bg-[var(--glass-line)] md:block"
      }
    >
      <motion.div
        className="accent-gradient h-full w-full"
        style={{ transformOrigin: vertical ? "top" : "left" }}
        initial={reduce ? { opacity: 0 } : vertical ? { scaleY: 0 } : { scaleX: 0 }}
        whileInView={reduce ? { opacity: 1 } : vertical ? { scaleY: 1 } : { scaleX: 1 }}
        viewport={{ once: true, margin: "0px 0px -20% 0px" }}
        transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
      />
      {!reduce && <span className={vertical ? "landing-pulse-y" : "landing-pulse-x"} />}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="How it works"
          title="From plan to progress in three steps."
          text="Cali follows the rhythm you already work in: plan the sprint, do the work, see how it went."
        />
        <ol className="relative grid gap-5 md:grid-cols-3 md:gap-8">
          <Connector />
          <Connector vertical />
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative">
              <Reveal delay={i * 0.15} className="h-full">
                <div className="flex h-full gap-4 md:flex-col md:items-center md:text-center">
                  <span className="glass-strong relative z-10 grid size-20 shrink-0 place-items-center rounded-[26px] md:size-[92px]">
                    <span className="text-gradient text-2xl font-semibold tracking-tight md:text-3xl">{s.n}</span>
                  </span>
                  <div className="glass flex-1 rounded-[24px] p-5 transition duration-300 hover:-translate-y-1 hover:bg-[var(--glass-hover)] md:mt-6 md:w-full">
                    <s.icon className="size-5 text-accent md:mx-auto" aria-hidden />
                    <h3 className="mt-3 text-lg font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-1.5 text-sm text-fg-2">{s.text}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
