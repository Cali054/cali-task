"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LEGAL, PRIVACY_POLICY, TERMS, type LegalDoc } from "@/lib/legal";
import { useUI } from "@/lib/ui-store";
import { DocIcon, LegalBody } from "./legal-doc";

/** Full-page layout for /privacy-policy and /terms-and-conditions. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const router = useRouter();
  const intro = useUI((s) => s.intro);
  const reduce = useReducedMotion();
  const other = doc.slug === "privacy-policy" ? TERMS : PRIVACY_POLICY;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {intro === "done" && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="glass-soft mb-6 inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-medium text-fg-2 transition hover:text-fg"
          >
            <ArrowLeft className="size-4" /> Back
          </button>

          <header className="glass-strong mb-6 flex flex-col gap-4 rounded-[28px] p-6 sm:flex-row sm:items-center sm:p-8">
            <span className="accent-gradient grid size-14 shrink-0 place-items-center rounded-[18px] text-on-accent shadow-[0_10px_28px_-12px_color-mix(in_srgb,var(--grad-b)_70%,transparent)]">
              <DocIcon doc={doc} className="size-7" />
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
              <p className="mt-1 text-sm text-fg-2">{doc.summary}</p>
              <p className="mt-2 text-xs text-fg-3">
                Effective {LEGAL.effectiveDate} · Version {LEGAL.version}
              </p>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <nav className="glass hidden h-fit rounded-[24px] p-3 lg:sticky lg:top-6 lg:block" aria-label="Sections">
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">On this page</p>
              <ol className="space-y-0.5">
                {doc.sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="flex gap-2 rounded-xl px-2 py-1.5 text-xs text-fg-2 transition hover:bg-[var(--glass-soft)] hover:text-fg">
                      <span className="font-mono text-accent">{i + 1}.</span> {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <article className="glass rounded-[24px] p-6 sm:p-8">
              <LegalBody doc={doc} />
              <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
                <p className="text-xs text-fg-3">© {new Date().getFullYear()} {LEGAL.appName}</p>
                <Link href={`/${other.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                  Read the {other.title} <ArrowRight className="size-4" />
                </Link>
              </div>
            </article>
          </div>
        </motion.div>
      )}
    </div>
  );
}
