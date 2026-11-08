"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading } from "./landing-kit";

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Cali?",
    a: "Cali is a productivity and sprint management platform. It brings your tasks, sprint progress, blockers and productivity reports together in one workspace, so you always know where your work stands.",
  },
  {
    q: "Who can use Cali?",
    a: "Anyone who plans work in sprints or short cycles: developers, QA testers, freelancers, students and anyone who wants a clear view of their own workload. Create a free account and you're ready in under a minute.",
  },
  {
    q: "Can I manage multiple sprints?",
    a: "Yes. Create as many sprints as you need, each with its own goal, dates and target duration, and switch between them from the sprint selector at the top of every page.",
  },
  {
    q: "Can I track blocked tasks?",
    a: "Yes. Mark a task as blocked with the reason, who you're waiting on and the action required. Blocked tasks get their own page, you can add follow-up notes, and the dashboard shows how long each one has been waiting.",
  },
  {
    q: "Can I monitor estimated and actual work duration?",
    a: "Yes. Every task has an estimate in days, and you log the time you actually spend. Cali compares the two on the timeline and in the Estimated vs Actual report, and shows the remaining effort for the sprint.",
  },
  {
    q: "Is my task information private?",
    a: "Your workspace belongs to your account only and isn't shared with other users. Today it's stored in your own browser on your device, which means it stays on that device; use Settings → Export to keep a backup. See the Privacy Policy for the details.",
  },
  {
    q: "Is Cali available on mobile devices?",
    a: "Yes. Cali is fully responsive and works in any modern browser on phones, tablets and desktops, with a mobile-friendly navigation and touch-friendly board.",
  },
];

function Item({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const id = useId();
  const reduce = useReducedMotion();
  return (
    <div className={cn("glass overflow-hidden rounded-[22px] transition-colors", open && "bg-[var(--glass-hover)]")}>
      <h3>
        <button
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold tracking-tight sm:px-6 sm:py-5"
        >
          {q}
          <span
            className={cn(
              "glass-soft grid size-8 shrink-0 place-items-center rounded-xl text-fg-2 transition-transform duration-300",
              open && "rotate-180 text-accent",
            )}
          >
            <ChevronDown className="size-4" aria-hidden />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-a`}
            role="region"
            aria-labelledby={`${id}-q`}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <p className="px-5 pb-5 text-sm leading-relaxed text-fg-2 sm:px-6">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section aria-labelledby="faq-title" className="relative px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="FAQ" title={<span id="faq-title">Questions, answered.</span>} />
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.04} y={14}>
              <Item q={f.q} a={f.a} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
