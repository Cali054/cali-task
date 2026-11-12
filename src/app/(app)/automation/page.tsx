"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  CheckCircle2,
  CloudOff,
  Copy,
  History,
  LayoutTemplate,
  Pencil,
  Play,
  Plus,
  Power,
  Trash2,
  Workflow as WorkflowIcon,
  XCircle,
  Zap,
} from "lucide-react";
import { useAutomation } from "@/lib/automation/store";
import { NODE_BY_TYPE } from "@/lib/automation/nodes";
import { TEMPLATES } from "@/lib/automation/templates";
import {
  deleteWorkflow,
  duplicateWorkflow,
  newWorkflow,
  retryCloud,
  runNow,
  saveWorkflow,
  setWorkflowStatus,
} from "@/lib/automation/runtime";
import type { Execution, Workflow } from "@/lib/automation/types";
import { cn, fmtDateTime, relativeTime, uid } from "@/lib/utils";
import { Button, EmptyState, GlassCard, PageHeader } from "@/components/ui/glass";
import { GlassDialog } from "@/components/ui/dialog";
import {
  CATEGORY_COLOR,
  ExecBadge,
  execDuration,
  NodeIcon,
  SOURCE_LABEL,
  Switch,
  WorkflowStatusPill,
} from "@/components/automation/shared";

const TABS = [
  { id: "all", label: "All Workflows" },
  { id: "active", label: "Active" },
  { id: "drafts", label: "Drafts" },
  { id: "history", label: "Execution History" },
  { id: "templates", label: "Templates" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AutomationPage() {
  return (
    <Suspense fallback={null}>
      <AutomationCenter />
    </Suspense>
  );
}

function AutomationCenter() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "all") as Tab;
  const workflowFilter = params.get("workflow");
  const workflows = useAutomation((s) => s.workflows);
  const executions = useAutomation((s) => s.executions);
  const [creating, setCreating] = useState(false);

  const setTab = (t: Tab) => router.replace(t === "all" ? "/automation" : `/automation?tab=${t}`, { scroll: false });

  const real = executions.filter((e) => e.source !== "test");
  const metrics = [
    { label: "Total Workflows", value: workflows.length, icon: WorkflowIcon, color: "var(--accent)" },
    { label: "Active Workflows", value: workflows.filter((w) => w.status === "active").length, icon: Zap, color: "var(--st-progress)" },
    { label: "Total Executions", value: real.length, icon: Activity, color: "var(--st-testing)" },
    { label: "Successful", value: real.filter((e) => e.status === "success").length, icon: CheckCircle2, color: "var(--st-done)" },
    { label: "Failed", value: real.filter((e) => e.status === "failed").length, icon: XCircle, color: "var(--st-blocked)" },
  ];

  return (
    <div>
      <PageHeader
        title="Automation Center"
        subtitle="Design workflows that react to your tasks and sprints — no code needed."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create Workflow
          </Button>
        }
      />

      <CloudNotice />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m, i) => (
          <motion.div key={m.label} className={cn(i === 4 && "col-span-2 sm:col-span-1")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-fg-2">{m.label}</p>
                <span className="grid size-8 place-items-center rounded-xl" style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}>
                  <m.icon className="size-4" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{m.value}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <div role="tablist" aria-label="Automation sections" className="scroll-thin glass-soft mb-5 flex gap-1 overflow-x-auto rounded-2xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "relative h-9 shrink-0 rounded-xl px-3.5 text-sm font-medium transition-colors",
              tab === t.id ? "text-fg" : "text-fg-2 hover:text-fg",
            )}
          >
            {tab === t.id && <motion.span layoutId="auto-tab" className="glass glow-active absolute inset-0 rounded-xl" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <ExecutionHistory executions={executions} workflows={workflows} initialWorkflow={workflowFilter} />
      ) : tab === "templates" ? (
        <TemplateGallery />
      ) : (
        <WorkflowList
          workflows={workflows.filter((w) => (tab === "active" ? w.status === "active" : tab === "drafts" ? w.status === "draft" : true))}
          executions={executions}
          tab={tab}
          onCreate={() => setCreating(true)}
        />
      )}

      <CreateDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function CloudNotice() {
  const cloud = useAutomation((s) => s.cloud);
  if (cloud === "ok" || cloud === "loading") return null;
  const text =
    cloud === "off"
      ? "Your automations are saved in this browser. Sign in with Google to keep them in the cloud across devices."
      : cloud === "missing"
        ? "The automation tables aren't in Supabase yet, so workflows are saved in this browser only. Run supabase/migrations/20261112000000_automation.sql in the Supabase SQL editor."
        : "Couldn't reach the cloud. Workflows are saved in this browser until the connection is back.";
  return (
    <div className="glass-soft mb-5 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm">
      <CloudOff className="size-4 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-fg-2">{text}</p>
      {cloud !== "off" && (
        <Button size="sm" onClick={retryCloud}>
          Retry
        </Button>
      )}
    </div>
  );
}

function triggerSummary(w: Workflow) {
  const t = w.definition.nodes.find((n) => NODE_BY_TYPE.get(n.type)?.category === "trigger");
  const d = t && NODE_BY_TYPE.get(t.type);
  if (!t || !d) return { label: "No trigger yet", icon: "split", detail: "" };
  return { label: d.label, icon: d.icon, detail: d.summary?.(t.config ?? {}) ?? "" };
}

function WorkflowList({
  workflows,
  executions,
  tab,
  onCreate,
}: {
  workflows: Workflow[];
  executions: Execution[];
  tab: Tab;
  onCreate: () => void;
}) {
  const [confirm, setConfirm] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (workflows.length === 0)
    return (
      <GlassCard>
        <EmptyState
          icon={WorkflowIcon}
          title={tab === "active" ? "No active workflows" : tab === "drafts" ? "No drafts" : "No workflows yet"}
          text="Start from a template or build your own on the canvas."
          action={
            <Button variant="primary" onClick={onCreate}>
              <Plus className="size-4" /> Create Workflow
            </Button>
          }
        />
      </GlassCard>
    );

  const toggle = async (w: Workflow, on: boolean) => {
    setBusy(w.id);
    const r = await setWorkflowStatus(w.id, on ? "active" : "inactive");
    setBusy(null);
    if (!r.ok) setError(`${w.name}: ${r.error}`);
  };

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl bg-st-blocked/10 px-4 py-3 text-sm text-st-blocked">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          <p className="flex-1">{error}</p>
          <button className="text-xs font-semibold" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <AnimatePresence initial={false}>
          {workflows.map((w) => {
            const trig = triggerSummary(w);
            const runs = executions.filter((e) => e.workflowId === w.id && e.source !== "test");
            const last = runs[0];
            const manualish = ["trigger.manual", "trigger.schedule"].includes(w.definition.nodes.find((n) => n.type.startsWith("trigger."))?.type ?? "");
            return (
              <motion.div key={w.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
                <GlassCard className="glass-hover flex h-full flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-2xl"
                      style={{ color: CATEGORY_COLOR.trigger, background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
                    >
                      <NodeIcon name={trig.icon} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/automation/${w.id}`} className="block truncate text-[15px] font-semibold tracking-tight hover:text-accent">
                        {w.name}
                      </Link>
                      <p className="truncate text-xs text-fg-3">
                        {trig.label}
                        {trig.detail ? ` · ${trig.detail}` : ""}
                      </p>
                    </div>
                    {w.status !== "draft" || w.definition.edges.length ? (
                      <Switch checked={w.status === "active"} disabled={busy === w.id} onChange={(v) => toggle(w, v)} label={w.status === "active" ? "Deactivate" : "Activate"} />
                    ) : null}
                  </div>
                  {w.description && <p className="mt-3 line-clamp-2 text-sm text-fg-2">{w.description}</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-fg-3">
                    <WorkflowStatusPill status={w.status} />
                    <span>{w.definition.nodes.length} steps</span>
                    <span aria-hidden>·</span>
                    <span>{runs.length} runs</span>
                    {last && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          last {relativeTime(last.startedAt)}
                          <span className="size-1.5 rounded-full" style={{ background: last.status === "failed" ? "var(--st-blocked)" : last.status === "success" ? "var(--st-done)" : "var(--accent)" }} />
                        </span>
                      </>
                    )}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    <Link href={`/automation/${w.id}`} className="glass-soft inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium hover:bg-[var(--glass-hover)]">
                      <Pencil className="size-3.5" /> Edit
                    </Link>
                    {manualish && w.status === "active" && (
                      <Button size="sm" onClick={() => void runNow(w.id)} title="Run now">
                        <Play className="size-3.5" /> Run now
                      </Button>
                    )}
                    <Link
                      href={`/automation?tab=history&workflow=${w.id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-fg-2 hover:bg-[var(--glass-soft)] hover:text-fg"
                    >
                      <History className="size-3.5" /> History
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        const r = await duplicateWorkflow(w.id);
                        if (!r.ok) setError(r.error ?? "Couldn't duplicate.");
                      }}
                      aria-label={`Duplicate ${w.name}`}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto hover:text-st-blocked" onClick={() => setConfirm(w)} aria-label={`Delete ${w.name}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <GlassDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete workflow?"
        description={confirm ? `"${confirm.name}" and its execution history will be removed. This can't be undone.` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm) return;
                const r = await deleteWorkflow(confirm.id);
                if (!r.ok) setError(r.error ?? "Couldn't delete.");
                setConfirm(null);
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </>
        }
      >
        <span />
      </GlassDialog>
    </>
  );
}

function ExecutionHistory({ executions, workflows, initialWorkflow }: { executions: Execution[]; workflows: Workflow[]; initialWorkflow: string | null }) {
  const [status, setStatus] = useState("all");
  const [wf, setWf] = useState(initialWorkflow ?? "all");
  const [showTests, setShowTests] = useState(false);
  const list = useMemo(
    () =>
      executions.filter(
        (e) => (status === "all" || e.status === status) && (wf === "all" || e.workflowId === wf) && (showTests || e.source !== "test"),
      ),
    [executions, status, wf, showTests],
  );
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <select className="field h-9 w-auto min-w-40 py-0 text-sm" value={wf} onChange={(e) => setWf(e.target.value)} aria-label="Workflow">
          <option value="all">All workflows</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select className="field h-9 w-auto py-0 text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">Any status</option>
          {["success", "failed", "running", "waiting", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <label className="ml-auto inline-flex items-center gap-2 text-xs text-fg-2">
          <input type="checkbox" checked={showTests} onChange={(e) => setShowTests(e.target.checked)} className="accent-[var(--accent)]" />
          Include test runs
        </label>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={History} title="No executions yet" text="Runs appear here as soon as a workflow is triggered." />
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-fg-3">
                <th className="px-4 py-3 font-medium">Workflow</th>
                <th className="px-2 py-3 font-medium">Execution ID</th>
                <th className="px-2 py-3 font-medium">Trigger</th>
                <th className="px-2 py-3 font-medium">Started</th>
                <th className="px-2 py-3 font-medium">Ended</th>
                <th className="px-2 py-3 font-medium">Duration</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="border-t border-line transition-colors hover:bg-[var(--glass-hover)]">
                  <td className="px-4 py-3">
                    <Link href={`/automation/runs/${e.id}`} className="font-medium hover:text-accent">
                      {e.workflowName}
                    </Link>
                    {e.dryRun && <span className="ml-2 rounded-full bg-[var(--glass-line)] px-1.5 py-0.5 text-[10px] text-fg-3">dry run</span>}
                  </td>
                  <td className="px-2 py-3 font-mono text-xs text-fg-3">
                    <Link href={`/automation/runs/${e.id}`} className="hover:text-accent">
                      {e.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-xs text-fg-2">
                    {SOURCE_LABEL[e.source]} · {NODE_BY_TYPE.get(e.triggerType)?.label ?? e.triggerType}
                  </td>
                  <td className="px-2 py-3 text-xs text-fg-2">{fmtDateTime(e.startedAt)}</td>
                  <td className="px-2 py-3 text-xs text-fg-2">{e.completedAt ? fmtDateTime(e.completedAt) : "—"}</td>
                  <td className="px-2 py-3 text-xs tabular-nums text-fg-2">{execDuration(e)}</td>
                  <td className="px-2 py-3">
                    <ExecBadge status={e.status} />
                  </td>
                  <td className="max-w-64 truncate px-4 py-3 text-xs text-st-blocked" title={e.error ?? ""}>
                    {e.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

function TemplateGallery() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {TEMPLATES.map((t, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
          <GlassCard className="flex h-full flex-col p-5">
            <div className="flex items-center gap-3">
              <span className="accent-gradient grid size-11 place-items-center rounded-2xl text-on-accent">
                <NodeIcon name={t.icon} className="size-5" />
              </span>
              <h3 className="text-[15px] font-semibold tracking-tight">{t.name}</h3>
            </div>
            <p className="mt-3 text-sm text-fg-2">{t.description}</p>
            <ol className="mt-4 space-y-1.5">
              {t.steps.map((s, j) => (
                <li key={s} className="flex items-center gap-2 text-xs text-fg-2">
                  <span
                    className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                    style={{
                      color: j === 0 ? CATEGORY_COLOR.trigger : "var(--fg-2)",
                      background: j === 0 ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "var(--glass-line)",
                    }}
                  >
                    {j + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-auto pt-5">
              <Button
                variant="primary"
                size="sm"
                disabled={busy === t.id}
                onClick={async () => {
                  setBusy(t.id);
                  const r = await saveWorkflow(newWorkflow({ name: t.name, description: t.description, definition: t.build(uid), templateId: t.id }), { isNew: true });
                  setBusy(null);
                  if (r.ok && r.workflow) router.push(`/automation/${r.workflow.id}`);
                }}
              >
                <LayoutTemplate className="size-3.5" /> Use template
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

function CreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Give the workflow a name.");
    setBusy(true);
    const r = await saveWorkflow(newWorkflow({ name, description, definition: { nodes: [], edges: [] } }), { isNew: true });
    setBusy(false);
    if (!r.ok || !r.workflow) return setError(r.error ?? "Couldn't create the workflow.");
    onOpenChange(false);
    setName("");
    setDescription("");
    router.push(`/automation/${r.workflow.id}`);
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create workflow"
      description="Name it now; you'll add the trigger and steps on the canvas."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="create-wf" disabled={busy}>
            <Power className="size-4" /> Create and open
          </Button>
        </>
      }
    >
      <form id="create-wf" onSubmit={create} className="space-y-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-2">Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus placeholder="e.g. Remind me before deadlines" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-fg-2">Description</span>
          <textarea className="field min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
        </label>
        {error && <p className="text-sm text-st-blocked">{error}</p>}
      </form>
    </GlassDialog>
  );
}
