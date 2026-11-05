"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Ban, CheckCircle2, MessageSquarePlus, Pencil, UserRound, Wrench, History } from "lucide-react";
import { useSprintTasks, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { STATUS_META } from "@/lib/meta";
import { STATUSES, type Status, type Task } from "@/lib/types";
import { daysDiff, fmtDate, fmtDateTime, today } from "@/lib/utils";
import { Button, EmptyState, GlassCard, PageHeader } from "@/components/ui/glass";

function BlockedCard({ task }: { task: Task }) {
  const addBlockerUpdate = useStore((s) => s.addBlockerUpdate);
  const { openBlocker, openDetail } = useUI();
  const [text, setText] = useState("");
  const [resolveTo, setResolveTo] = useState<Status | "">("");
  const b = task.blocker!;
  const days = daysDiff(b.blockedOn, today());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !resolveTo) return;
    addBlockerUpdate(task.id, text.trim() || "Clarification received.", resolveTo || undefined);
    setText("");
    setResolveTo("");
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 border-b border-line bg-st-blocked/5 p-5">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-st-blocked text-white shadow-[0_10px_24px_-10px_var(--st-blocked)]">
            <div className="text-center leading-none">
              <p className="text-xl font-bold">{days}</p>
              <p className="text-[9px] font-semibold uppercase">{days === 1 ? "day" : "days"}</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <button onClick={() => openDetail(task.id)} className="text-left">
              <p className="font-mono text-xs text-fg-3">#{task.code}</p>
              <h3 className="text-lg font-semibold tracking-tight hover:underline">{task.title}</h3>
            </button>
            <p className="text-xs text-fg-3">Blocked since {fmtDate(b.blockedOn, { weekday: "short", month: "short", day: "numeric" })}</p>
          </div>
          <Button size="sm" onClick={() => openBlocker(task.id)}><Pencil className="size-3.5" /> Edit</Button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div className="md:col-span-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3"><Ban className="size-3" /> Reason for blocking</p>
            <p className="text-sm">{b.reason}</p>
          </div>
          <div className="glass-soft rounded-2xl p-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] text-fg-3"><UserRound className="size-3" /> Waiting for clarification from</p>
            <p className="text-sm font-medium">{b.waitingOn || "—"}</p>
          </div>
          <div className="glass-soft rounded-2xl p-3 md:col-span-2">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] text-fg-3"><Wrench className="size-3" /> Required action</p>
            <p className="text-sm font-medium">{b.requiredAction || "—"}</p>
          </div>

          {b.updates.length > 0 && (
            <div className="md:col-span-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-3"><History className="size-3" /> Updates</p>
              <ol className="relative space-y-3 border-l border-line pl-4">
                {b.updates.map((u) => (
                  <li key={u.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-[var(--glass-strong)] bg-accent" />
                    <p>{u.text}</p>
                    <p className="text-[11px] text-fg-3">{fmtDateTime(u.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-2 md:col-span-3 sm:flex-row">
            <input
              className="field flex-1"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add an update, e.g. “Clarification received from BA — amount confirmed”"
              aria-label={`Update for ${task.code}`}
            />
            <select className="field sm:w-48" value={resolveTo} onChange={(e) => setResolveTo(e.target.value as Status | "")} aria-label="Unblock to">
              <option value="">Still blocked</option>
              {STATUSES.filter((s) => s !== "blocked").map((s) => (
                <option key={s} value={s}>Unblock → {STATUS_META[s].label}</option>
              ))}
            </select>
            <Button type="submit" variant={resolveTo ? "primary" : "glass"} disabled={!text.trim() && !resolveTo}>
              {resolveTo ? <><CheckCircle2 className="size-4" /> Resolve</> : <><MessageSquarePlus className="size-4" /> Add update</>}
            </Button>
          </form>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export default function BlockedPage() {
  const tasks = useSprintTasks();
  const openBlocker = useUI((s) => s.openBlocker);
  const openDetail = useUI((s) => s.openDetail);
  const blocked = tasks.filter((t) => t.status === "blocked" && t.blocker);
  const resolved = tasks
    .filter((t) => t.blocker?.resolvedOn)
    .sort((a, b) => b.blocker!.resolvedOn!.localeCompare(a.blocker!.resolvedOn!));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blocked Tasks"
        subtitle={blocked.length ? `${blocked.length} task${blocked.length > 1 ? "s" : ""} waiting on clarification` : "Nothing is blocked"}
        actions={<Button variant="danger" onClick={() => openBlocker("")}><Ban className="size-4" /> Add blocker</Button>}
      />

      {blocked.length === 0 ? (
        <GlassCard>
          <EmptyState icon={CheckCircle2} title="No blocked tasks" text="When something can't move forward, flag it here to track who you're waiting on." />
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>{blocked.map((t) => <BlockedCard key={t.id} task={t} />)}</AnimatePresence>
        </div>
      )}

      {resolved.length > 0 && (
        <GlassCard className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Recently resolved</h3>
          <ul className="space-y-1">
            {resolved.map((t) => (
              <li key={t.id}>
                <button onClick={() => openDetail(t.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 text-left text-sm hover:bg-[var(--glass-hover)]">
                  <CheckCircle2 className="size-4 text-st-done" />
                  <span className="font-mono text-xs text-fg-3">#{t.code}</span>
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-fg-3">
                    Blocked {daysDiff(t.blocker!.blockedOn, t.blocker!.resolvedOn!)}d · resolved {fmtDate(t.blocker!.resolvedOn)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
