"use client";

import { BarChart3, Ban, GanttChartSquare, Gauge, KanbanSquare, ListTodo, type LucideIcon } from "lucide-react";
import { Reveal, SectionHeading } from "./landing-kit";

const FEATURES: { icon: LucideIcon; title: string; text: string; color: string }[] = [
  {
    icon: ListTodo,
    title: "Smart Task Management",
    text: "Organize, create, update, and monitor tasks in one workspace.",
    color: "var(--accent)",
  },
  {
    icon: Gauge,
    title: "Sprint Monitoring",
    text: "Monitor sprint progress and understand your workload at a glance.",
    color: "var(--st-testing)",
  },
  {
    icon: KanbanSquare,
    title: "Kanban Board",
    text: "Visualize tasks through To Do, In Progress, For Retest, Testing, Blocked, and Completed.",
    color: "var(--st-retest)",
  },
  {
    icon: GanttChartSquare,
    title: "Timeline Tracking",
    text: "Monitor deadlines, estimated durations, and actual completion times.",
    color: "var(--st-progress)",
  },
  {
    icon: Ban,
    title: "Blocker Management",
    text: "Identify delayed tasks and track issues that require clarification.",
    color: "var(--st-blocked)",
  },
  {
    icon: BarChart3,
    title: "Productivity Analytics",
    text: "Understand your performance through progress charts and sprint reports.",
    color: "var(--st-done)",
  },
];

export function FeatureSection() {
  return (
    <section id="features" className="relative scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Features"
          title="Everything a sprint needs. Nothing it doesn't."
          text="Six focused tools that work together, so planning, tracking and reporting all happen in one place."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map((f, i) => (
            <li key={f.title}>
              <Reveal delay={(i % 3) * 0.08} className="h-full">
                <article className="glass group relative h-full overflow-hidden rounded-[26px] p-6 transition duration-300 hover:-translate-y-1 hover:bg-[var(--glass-hover)] hover:shadow-[0_24px_50px_-24px_color-mix(in_srgb,var(--accent)_55%,transparent)]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: `color-mix(in srgb, ${f.color} 30%, transparent)` }}
                  />
                  <span
                    className="relative grid size-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                    style={{ color: f.color, background: `color-mix(in srgb, ${f.color} 14%, transparent)` }}
                  >
                    <f.icon className="size-6" />
                  </span>
                  <h3 className="relative mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-fg-2">{f.text}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
