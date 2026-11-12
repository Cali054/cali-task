"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronDown, CircleSlash, History, RotateCcw } from "lucide-react";
import { useAutomation } from "@/lib/automation/store";
import { cancelExecution, loadExecutionDetail } from "@/lib/automation/runtime";
import { NODE_BY_TYPE } from "@/lib/automation/nodes";
import type { NodeExecution } from "@/lib/automation/types";
import { cn, fmtDateTime } from "@/lib/utils";
import { Button, EmptyState, GlassCard, PageHeader } from "@/components/ui/glass";
import { CaliLoadingIndicator } from "@/components/brand/cali-logo";
import { CATEGORY_COLOR, ExecBadge, execColor, execDuration, fmtDuration, NodeIcon, SOURCE_LABEL } from "@/components/automation/shared";

export default function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ready = useAutomation((s) => s.boundTo !== null && s.cloud !== "loading");
  const run = useAutomation((s) => s.executions.find((e) => e.id === id));
  const workflowExists = useAutomation((s) => s.workflows.some((w) => w.id === run?.workflowId));
  const [fetched, setFetched] = useState<string | null>(null);
  const needsDetail = ready && !!run && run.nodes.length === 0;
  const loading = needsDetail && fetched !== id;

  useEffect(() => {
    if (!needsDetail) return;
    void loadExecutionDetail(id).finally(() => setFetched(id));
  }, [needsDetail, id]);

  if (!ready) return <CaliLoadingIndicator />;
  if (!run)
    return (
      <GlassCard>
        <EmptyState
          icon={History}
          title="Execution not found"
          text="Older runs are trimmed from history after 200 executions."
          action={
            <Link href="/automation?tab=history" className="text-sm font-medium text-accent">
              Back to Execution History
            </Link>
          }
        />
      </GlassCard>
    );

  const facts = [
    ["Execution ID", <span key="id" className="font-mono text-xs">{run.id}</span>],
    ["Trigger", `${SOURCE_LABEL[run.source]} · ${NODE_BY_TYPE.get(run.triggerType)?.label ?? run.triggerType}`],
    ["Started", fmtDateTime(run.startedAt)],
    ["Ended", run.completedAt ? fmtDateTime(run.completedAt) : "—"],
    ["Duration", execDuration(run)],
    ["Mode", run.dryRun ? "Dry run (no changes)" : run.depth > 0 ? `Live · chained ${run.depth} deep` : "Live"],
  ] as const;

  return (
    <div>
      <Link href="/automation?tab=history" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-fg-2 hover:text-fg">
        <ArrowLeft className="size-3.5" /> Execution History
      </Link>
      <PageHeader
        title={run.workflowName}
        subtitle={run.triggerEventId ? `Event ${run.triggerEventId.split(":")[0].replace(/_/g, " ")}` : undefined}
        actions={
          <>
            <ExecBadge status={run.status} className="h-10 px-4 text-xs" />
            {(run.status === "waiting" || run.status === "running") && (
              <Button onClick={() => cancelExecution(run.id)}>
                <CircleSlash className="size-4" /> Cancel run
              </Button>
            )}
            {workflowExists && (
              <Link href={`/automation/${run.workflowId}`} className="glass-soft inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-medium hover:bg-[var(--glass-hover)]">
                Open workflow
              </Link>
            )}
          </>
        }
      />

      <GlassCard className="mb-5 grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-fg-3">{k}</p>
            <p className="mt-1 truncate text-sm font-medium">{v}</p>
          </div>
        ))}
      </GlassCard>

      {run.error && (
        <div role="alert" className="mb-5 rounded-2xl bg-st-blocked/10 px-4 py-3 text-sm text-st-blocked">
          <p className="font-semibold">Error</p>
          <p className="mt-0.5">{run.error}</p>
        </div>
      )}
      {run.status === "waiting" && run.resume && (
        <div className="glass-soft mb-5 rounded-2xl px-4 py-3 text-sm text-fg-2">
          Waiting until <span className="font-medium text-fg">{fmtDateTime(run.resume.resumeAt)}</span>, then continues with {run.resume.queue.length} step(s). Runs while Cali is open.
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold">Steps</h2>
      {loading ? (
        <CaliLoadingIndicator />
      ) : run.nodes.length === 0 ? (
        <GlassCard>
          <EmptyState icon={RotateCcw} title="No step details" text="Step details for this run are stored on another device." />
        </GlassCard>
      ) : (
        <ol className="relative space-y-3">
          <span aria-hidden className="absolute bottom-4 left-[21px] top-4 w-px bg-[var(--glass-line)]" />
          {run.nodes.map((n, i) => (
            <NodeRun key={n.id} n={n} index={i} />
          ))}
        </ol>
      )}
    </div>
  );
}

function NodeRun({ n, index }: { n: NodeExecution; index: number }) {
  const def = NODE_BY_TYPE.get(n.nodeType);
  const [open, setOpen] = useState(n.status === "failed");
  const color = def ? CATEGORY_COLOR[def.category] : "var(--fg-3)";
  const out = n.output as { count?: number } | null;
  return (
    <li className="relative pl-12">
      <span
        className="absolute left-0 top-3 grid size-11 place-items-center rounded-2xl ring-4 ring-[var(--bg-3)]"
        style={{ color, background: `color-mix(in srgb, ${color} 16%, var(--bg-3))` }}
      >
        {def ? <NodeIcon name={def.icon} className="size-5" /> : index + 1}
      </span>
      <GlassCard className="overflow-hidden">
        <button className="flex w-full flex-wrap items-center gap-3 p-4 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{n.label}</span>
            <span className="block truncate text-xs text-fg-3">
              {def?.label ?? n.nodeType}
              {n.branch ? ` · ${n.branch.true} true, ${n.branch.false} false` : out?.count != null ? ` · ${out.count} item(s) out` : ""}
              {n.attempts > 1 ? ` · ${n.attempts} attempts` : ""}
            </span>
          </span>
          <span className="text-xs tabular-nums text-fg-3">{fmtDuration(n.durationMs)}</span>
          <ExecBadge status={n.status} />
          <ChevronDown className={cn("size-4 text-fg-3 transition-transform", open && "rotate-180")} />
        </button>
        {n.error && <p className="mx-4 mb-3 rounded-xl bg-st-blocked/10 px-3 py-2 text-xs text-st-blocked">{n.error}</p>}
        {open && (
          <div className="grid gap-3 border-t border-line p-4 lg:grid-cols-2">
            <JsonBlock title="Input" value={n.input} />
            <JsonBlock title="Output" value={n.output} accent={execColor(n.status)} />
            <p className="text-[11px] text-fg-3 lg:col-span-2">
              Started {fmtDateTime(n.startedAt)}
              {n.completedAt ? ` · finished ${fmtDateTime(n.completedAt)}` : ""}
            </p>
          </div>
        )}
      </GlassCard>
    </li>
  );
}

function JsonBlock({ title, value, accent }: { title: string; value: unknown; accent?: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: accent ?? "var(--fg-3)" }}>
        {title}
      </p>
      <pre className="scroll-thin max-h-72 overflow-auto rounded-xl bg-[var(--glass-line)] p-3 font-mono text-[11px] leading-relaxed text-fg-2">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
