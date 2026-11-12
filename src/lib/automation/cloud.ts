"use client";

/**
 * Supabase mirror of a Google user's automations (tables from
 * supabase/migrations/20261112000000_automation.sql, all protected by Row
 * Level Security). Writes are best-effort: the app keeps working from its
 * local copy if the network or the tables are unavailable.
 */
import { getSupabase } from "../supabase";
import type { AppNotification, AuditEntry, Execution, NodeExecution, Workflow, WorkflowSchedule } from "./types";

type Row = Record<string, unknown>;

/** Postgres/PostgREST codes for "table doesn't exist yet". */
export function isMissingTable(e: unknown) {
  const code = (e as { code?: string })?.code;
  return code === "42P01" || code === "PGRST205" || code === "PGRST204";
}

function sb() {
  const c = getSupabase();
  if (!c) throw new Error("Supabase isn't configured.");
  return c;
}

/* ---------- Mapping ---------- */

const toWorkflowRow = (w: Workflow, userId: string): Row => ({
  id: w.id,
  user_id: userId,
  name: w.name,
  description: w.description,
  status: w.status,
  workflow_definition: w.definition,
  settings: w.settings,
  template_id: w.templateId ?? null,
  created_by: userId,
  activated_at: w.activatedAt,
  last_run_at: w.lastRunAt,
  created_at: w.createdAt,
});

const fromWorkflowRow = (r: Row): Workflow => ({
  id: String(r.id),
  name: String(r.name),
  description: String(r.description ?? ""),
  status: r.status as Workflow["status"],
  definition: r.workflow_definition as Workflow["definition"],
  settings: { allowSelfTrigger: false, maxRunsPerHour: 60, ...((r.settings as object) ?? {}) },
  createdBy: String(r.created_by),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
  activatedAt: (r.activated_at as string) ?? null,
  lastRunAt: (r.last_run_at as string) ?? null,
  templateId: (r.template_id as string) ?? null,
});

const toExecRow = (e: Execution, userId: string): Row => ({
  id: e.id,
  workflow_id: e.workflowId,
  user_id: userId,
  trigger_event_id: e.triggerEventId,
  trigger_type: e.triggerType,
  source: e.source,
  status: e.status,
  dry_run: e.dryRun,
  depth: e.depth,
  input_data: e.input ?? null,
  output_data: e.output ?? null,
  resume_state: e.resume,
  error_message: e.error?.slice(0, 2000) ?? null,
  started_at: e.startedAt,
  completed_at: e.completedAt,
});

const fromExecRow = (r: Row, workflows: Workflow[]): Execution => ({
  id: String(r.id),
  workflowId: String(r.workflow_id),
  workflowName: workflows.find((w) => w.id === r.workflow_id)?.name ?? "Deleted workflow",
  triggerType: String(r.trigger_type),
  triggerEventId: (r.trigger_event_id as string) ?? null,
  source: r.source as Execution["source"],
  status: r.status as Execution["status"],
  dryRun: Boolean(r.dry_run),
  depth: Number(r.depth ?? 0),
  input: r.input_data,
  output: r.output_data,
  startedAt: String(r.started_at),
  completedAt: (r.completed_at as string) ?? null,
  error: (r.error_message as string) ?? null,
  nodes: [],
  resume: (r.resume_state as Execution["resume"]) ?? null,
});

const toNodeRow = (n: NodeExecution, executionId: string, userId: string): Row => ({
  id: n.id,
  execution_id: executionId,
  user_id: userId,
  node_id: n.nodeId,
  node_type: n.nodeType,
  label: n.label,
  status: n.status,
  input_data: n.input ?? null,
  output_data: n.output ?? null,
  branch: n.branch ?? null,
  attempts: n.attempts,
  duration_ms: n.durationMs,
  error_message: n.error?.slice(0, 2000) ?? null,
  started_at: n.startedAt,
  completed_at: n.completedAt,
});

const fromNodeRow = (r: Row): NodeExecution => ({
  id: String(r.id),
  nodeId: String(r.node_id),
  nodeType: String(r.node_type),
  label: String(r.label ?? ""),
  status: r.status as NodeExecution["status"],
  input: r.input_data,
  output: r.output_data,
  branch: (r.branch as NodeExecution["branch"]) ?? null,
  attempts: Number(r.attempts ?? 1),
  durationMs: Number(r.duration_ms ?? 0),
  error: (r.error_message as string) ?? null,
  startedAt: String(r.started_at),
  completedAt: (r.completed_at as string) ?? null,
});

const toNotifRow = (n: AppNotification, userId: string): Row => ({
  id: n.id,
  workflow_id: n.workflowId,
  execution_id: n.executionId,
  user_id: userId,
  recipient_id: userId,
  notification_type: n.type,
  title: n.title.slice(0, 200),
  message: n.message.slice(0, 2000),
  task_id: n.taskId,
  created_at: n.createdAt,
  read_at: n.readAt,
});

const fromNotifRow = (r: Row): AppNotification => ({
  id: String(r.id),
  workflowId: (r.workflow_id as string) ?? null,
  executionId: (r.execution_id as string) ?? null,
  recipientId: String(r.recipient_id),
  type: r.notification_type as AppNotification["type"],
  title: String(r.title),
  message: String(r.message ?? ""),
  taskId: (r.task_id as string) ?? null,
  createdAt: String(r.created_at),
  readAt: (r.read_at as string) ?? null,
});

const toScheduleRow = (s: WorkflowSchedule, userId: string): Row => ({
  id: s.id,
  workflow_id: s.workflowId,
  user_id: userId,
  schedule_type: s.scheduleType,
  schedule_configuration: s.config,
  next_execution_at: s.nextExecutionAt,
  is_active: s.isActive,
});

const fromScheduleRow = (r: Row): WorkflowSchedule => ({
  id: String(r.id),
  workflowId: String(r.workflow_id),
  scheduleType: r.schedule_type as WorkflowSchedule["scheduleType"],
  config: r.schedule_configuration as WorkflowSchedule["config"],
  nextExecutionAt: (r.next_execution_at as string) ?? null,
  isActive: Boolean(r.is_active),
});

/* ---------- Reads ---------- */

export async function loadAutomationCloud() {
  const c = sb();
  const [wf, sc, ex, no, au] = await Promise.all([
    c.from("workflows").select("*").order("updated_at", { ascending: false }).limit(200),
    c.from("workflow_schedules").select("*").limit(200),
    c.from("workflow_executions").select("*").order("started_at", { ascending: false }).limit(200),
    c.from("workflow_notifications").select("*").order("created_at", { ascending: false }).limit(200),
    c.from("workflow_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  for (const r of [wf, sc, ex, no, au]) if (r.error) throw r.error;
  const workflows = (wf.data ?? []).map(fromWorkflowRow);
  return {
    workflows,
    schedules: (sc.data ?? []).map(fromScheduleRow),
    executions: (ex.data ?? []).map((r) => fromExecRow(r, workflows)),
    notifications: (no.data ?? []).map(fromNotifRow),
    audit: (au.data ?? []).map(
      (r): AuditEntry => ({ id: String(r.id), at: String(r.created_at), workflowId: (r.workflow_id as string) ?? null, action: String(r.action), detail: String(r.detail ?? "") }),
    ),
  };
}

export async function loadNodeExecutions(executionId: string): Promise<NodeExecution[]> {
  const { data, error } = await sb().from("workflow_node_executions").select("*").eq("execution_id", executionId).order("started_at");
  if (error) throw error;
  return (data ?? []).map(fromNodeRow);
}

/* ---------- Writes ---------- */

export async function saveWorkflowCloud(w: Workflow, userId: string) {
  const { error } = await sb().from("workflows").upsert(toWorkflowRow(w, userId), { onConflict: "id" });
  if (error) throw error;
}

export async function deleteWorkflowCloud(id: string) {
  const { error } = await sb().from("workflows").delete().eq("id", id);
  if (error) throw error;
}

export async function saveScheduleCloud(s: WorkflowSchedule, userId: string) {
  const { error } = await sb().from("workflow_schedules").upsert(toScheduleRow(s, userId), { onConflict: "workflow_id" });
  if (error) throw error;
}

export async function deleteScheduleCloud(workflowId: string) {
  const { error } = await sb().from("workflow_schedules").delete().eq("workflow_id", workflowId);
  if (error) throw error;
}

/**
 * Claims a due scheduled run: moves next_execution_at forward only if it
 * still has the value this device saw. Another device that got there first
 * makes this return false, so each run happens once.
 */
export async function claimScheduleCloud(s: WorkflowSchedule, nextAt: string): Promise<boolean> {
  let q = sb().from("workflow_schedules").update({ next_execution_at: nextAt }).eq("id", s.id);
  q = s.nextExecutionAt ? q.eq("next_execution_at", s.nextExecutionAt) : q.is("next_execution_at", null);
  const { data, error } = await q.select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Records the start of a run. Returns "duplicate" if this event was already handled. */
export async function insertExecutionCloud(e: Execution, userId: string): Promise<"ok" | "duplicate"> {
  const { error } = await sb().from("workflow_executions").insert(toExecRow(e, userId));
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw error;
  }
  return "ok";
}

export async function finishExecutionCloud(e: Execution, userId: string, newNodes: NodeExecution[]) {
  const c = sb();
  const { error } = await c
    .from("workflow_executions")
    .update({ status: e.status, output_data: e.output ?? null, resume_state: e.resume, error_message: e.error?.slice(0, 2000) ?? null, completed_at: e.completedAt })
    .eq("id", e.id);
  if (error) throw error;
  if (newNodes.length) {
    const { error: ne } = await c.from("workflow_node_executions").upsert(newNodes.map((n) => toNodeRow(n, e.id, userId)), { onConflict: "id" });
    if (ne) throw ne;
  }
}

export async function insertNotificationCloud(n: AppNotification, userId: string) {
  const { error } = await sb().from("workflow_notifications").insert(toNotifRow(n, userId));
  if (error) throw error;
}

export async function markNotificationsReadCloud(ids: string[]) {
  if (!ids.length) return;
  const { error } = await sb().from("workflow_notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  if (error) throw error;
}

export async function deleteNotificationCloud(id: string) {
  const { error } = await sb().from("workflow_notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function insertAuditCloud(a: AuditEntry, userId: string) {
  const { error } = await sb().from("workflow_audit_log").insert({ id: a.id, user_id: userId, workflow_id: a.workflowId, action: a.action, detail: a.detail.slice(0, 1000), created_at: a.at });
  if (error) throw error;
}

export async function accessToken(): Promise<string | null> {
  const { data } = await sb().auth.getSession();
  return data.session?.access_token ?? null;
}
