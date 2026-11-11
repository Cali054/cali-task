"use client";

import { useRef, useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { CheckCircle2, ExternalLink, FileText, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { LEGAL, type LegalDoc } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Renders a legal document's sections. Shared by the full page and the modal. */
export function LegalBody({ doc, compact }: { doc: LegalDoc; compact?: boolean }) {
  return (
    <div className={cn("space-y-7", compact && "space-y-6")}>
      {doc.sections.map((s, i) => (
        <section key={s.id} id={s.id} className="scroll-mt-24">
          <h2 className={cn("mb-2 flex items-baseline gap-3 font-semibold tracking-tight", compact ? "text-base" : "text-lg")}>
            <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
            {s.title}
          </h2>
          <div className="space-y-2.5 text-sm leading-relaxed text-fg-2">
            {s.body.map((b, j) =>
              Array.isArray(b) ? (
                <ul key={j} className="space-y-1.5 pl-1">
                  {b.map((li) => (
                    <li key={li} className="flex gap-2.5">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent/70" />
                      <span>{li}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p key={j}>{b}</p>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export function DocIcon({ doc, className }: { doc: LegalDoc; className?: string }) {
  return doc.slug === "privacy-policy" ? <ShieldCheck className={className} /> : <FileText className={className} />;
}

/**
 * Glass modal for reading a document during signup. Tracks whether the
 * reader reached the end, and offers "I've read this" once they have.
 */
export function LegalModal({
  doc,
  open,
  onOpenChange,
  onRead,
}: {
  doc: LegalDoc;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRead: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atEnd = progress >= 0.98;

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max <= 0 ? 1 : el.scrollTop / max);
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[rgba(8,7,5,0.5)] backdrop-blur-sm dark:bg-black/50" />
        <D.Content
          className="dialog-content glass-strong fixed left-1/2 top-1/2 z-50 flex h-[min(86dvh,760px)] w-[calc(100vw-24px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            scrollRef.current?.focus();
          }}
        >
          <div className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-6">
            <span className="glass-soft grid size-10 shrink-0 place-items-center rounded-2xl text-accent">
              <DocIcon doc={doc} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <D.Title className="text-lg font-semibold tracking-tight">{doc.title}</D.Title>
              <D.Description className="text-xs text-fg-3">
                Effective {LEGAL.effectiveDate} · Version {LEGAL.version}
              </D.Description>
            </div>
            <D.Close
              className="-mr-2 -mt-1 grid size-9 place-items-center rounded-xl text-fg-2 transition hover:bg-[var(--glass-soft)] hover:text-fg"
              aria-label="Close"
            >
              <X className="size-4" />
            </D.Close>
          </div>
          {/* reading progress */}
          <div className="h-0.5 bg-[var(--glass-line)]">
            <motion.div className="h-full accent-gradient" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.15 }} />
          </div>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            tabIndex={0}
            className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-6 outline-none"
            aria-label={`${doc.title} text`}
          >
            <LegalBody doc={doc} compact />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
            <Link
              href={`/${doc.slug}`}
              target="_blank"
              className="mr-auto inline-flex items-center gap-1.5 text-xs font-medium text-fg-3 hover:text-accent"
            >
              Open full page <ExternalLink className="size-3" />
            </Link>
            {!atEnd && <span className="text-xs text-fg-3">Scroll to the end to continue</span>}
            <button
              type="button"
              disabled={!atEnd}
              onClick={() => {
                onRead();
                onOpenChange(false);
              }}
              className="accent-gradient inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="size-4" /> I&apos;ve read this
            </button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
