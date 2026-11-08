"use client";

import { SectionHeading, Reveal } from "./landing-kit";
import { DashboardPreview, PreviewFrame } from "./app-previews";

/** Large, gently floating preview of the real Overview page. */
export function ProductShowcase() {
  return (
    <section aria-labelledby="showcase-title" className="relative px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Your workspace"
          title={<span id="showcase-title">Your whole sprint, on one calm screen.</span>}
          text="Progress, workload, blockers and recent activity, all live in a single glass dashboard you'll actually enjoy opening."
        />
        <Reveal y={40}>
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 rounded-[60px] bg-[radial-gradient(60%_60%_at_50%_40%,var(--orb-a),transparent_70%)] opacity-70 blur-2xl" />
            <div className="landing-float-slow">
              <PreviewFrame
                label="Cali Overview page: Sprint 2 at 29% complete with 8 tasks, 3 completed, 3 in progress or review, 1 blocked, 5 days of estimated work remaining, a task completion chart and recent activity"
                title="Overview"
              >
                <DashboardPreview />
              </PreviewFrame>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
