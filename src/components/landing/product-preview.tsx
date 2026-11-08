"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BarChart3, FileText, GanttChartSquare, KanbanSquare, LayoutDashboard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading } from "./landing-kit";
import {
  BoardPreview,
  DashboardPreview,
  PreviewFrame,
  ReportsPreview,
  TaskDetailPreview,
  TimelinePreview,
} from "./app-previews";

const TABS: {
  id: string;
  label: string;
  icon: LucideIcon;
  rail: number;
  caption: string;
  alt: string;
  View: () => React.JSX.Element;
}[] = [
  {
    id: "overview",
    label: "Dashboard",
    icon: LayoutDashboard,
    rail: 0,
    caption: "Sprint health, stats and activity the moment you sign in.",
    alt: "Dashboard overview with sprint progress, six stat cards, a completion chart and recent activity",
    View: DashboardPreview,
  },
  {
    id: "board",
    label: "Sprint Board",
    icon: KanbanSquare,
    rail: 2,
    caption: "Drag tasks across six statuses, from To Do to Completed.",
    alt: "Kanban sprint board with columns To Do, In Progress, For Retest, For Testing, Blocked and Completed",
    View: BoardPreview,
  },
  {
    id: "detail",
    label: "Task Details",
    icon: FileText,
    rail: 1,
    caption: "Estimates, logged time and blocker notes for every task.",
    alt: "Task detail for a blocked task with estimate, logged time, due date and blocker information",
    View: TaskDetailPreview,
  },
  {
    id: "timeline",
    label: "Timeline",
    icon: GanttChartSquare,
    rail: 3,
    caption: "See every task laid out across the sprint's working days.",
    alt: "Timeline with a bar per task across the sprint's working days",
    View: TimelinePreview,
  },
  {
    id: "reports",
    label: "Analytics",
    icon: BarChart3,
    rail: 5,
    caption: "Burndown and estimated-vs-actual reports for every sprint.",
    alt: "Analytics reports with a burndown chart and an estimated versus actual effort chart",
    View: ReportsPreview,
  },
];

/** Tabbed tour of the app's main screens (keyboard: arrow keys, Home, End). */
export function ProductPreview() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = TABS[index];

  const select = (i: number) => {
    const next = (i + TABS.length) % TABS.length;
    setIndex(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") select(index + 1);
    else if (e.key === "ArrowLeft") select(index - 1);
    else if (e.key === "Home") select(0);
    else if (e.key === "End") select(TABS.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <section aria-labelledby="preview-title" className="relative px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Product tour"
          title={<span id="preview-title">Take a look inside.</span>}
          text="The same glass interface across every screen, on desktop, tablet and phone."
        />

        <Reveal>
          <div
            role="tablist"
            aria-label="App screens"
            onKeyDown={onKeyDown}
            className="glass mx-auto mb-6 flex w-full max-w-3xl gap-1 overflow-x-auto rounded-[22px] p-1.5 [scrollbar-width:none]"
          >
            {TABS.map((t, i) => {
              const selected = i === index;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "relative flex h-11 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-3.5 text-sm font-medium transition-colors",
                    selected ? "text-fg" : "text-fg-2 hover:text-fg",
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="preview-tab"
                      className="glass-strong absolute inset-0 rounded-2xl"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <t.icon className={cn("relative size-4", selected && "text-accent")} aria-hidden />
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mb-6 text-center text-sm text-fg-2" aria-live="polite">
            {tab.caption}
          </p>

          <div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} className="relative min-h-[320px]">
            <div aria-hidden className="pointer-events-none absolute -inset-x-6 -inset-y-10 -z-10 rounded-[60px] bg-[radial-gradient(60%_60%_at_50%_50%,var(--orb-c),transparent_70%)] opacity-80 blur-2xl" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.985, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.99, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <PreviewFrame label={tab.alt} active={tab.rail} title={tab.label === "Analytics" ? "Reports" : tab.label}>
                  <tab.View />
                </PreviewFrame>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
