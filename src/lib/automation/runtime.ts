"use client";

/**
 * Automation runtime: connects the engine to the live workspace.
 *
 * - Detects task and sprint events by watching the workspace store.
 * - Dispatches them to matching active workflows (once per event).
 * - Runs scheduled triggers, deadline/overdue/sprint watchers and resumes
 *   delayed runs — in one tab only (leader election via Web Locks).
 * - Records executions, notifications and an audit log, mirrored to
 *   Supabase for Google accounts.
 */
import { useStore } from "../store";
import type { Status, Task, TaskInput } from "../types";
import { daysDiff, today, toDateStr, uid } from "../utils";
import { executeWorkflow, LIMITS } from "./engine";
import { currentOrigin, eventsSuppressed, withOrigin } from "./event-gate";
import { createMemoryAdapter, newTask } from "./memory-adapter";
import { itemsForScope, NODE_BY_TYPE } from "./nodes";
import { nextRun, normalizeSchedule } from "./schedule";
import { bindAutomationStore, useAutomation } from "./store";
import { hasErrors, validateWorkflow } from "./validate";
import * as cloud from "./cloud";
import type {
  AiRequest,
  AppNotification,
  AutomationEvent,
  Execution,
  ExecSource,
  Item,
  WFNode,
  Workflow,
  WorkflowDefinition,
  WorkflowSchedule,
  WorkspaceAdapter,
} from "./types";
import { NodeError } from "./types";

export interface AutomationUser {
  id: string;
  provider: "password" | "google";
  email: string;
  fullName: string;
}

interface Session {
  user: AutomationUser;
  cloud: boolean;
  stop: () => void;
}

let session: Session | null = null;
const TICK_MS = 30_000;
const A = () => useAutomation.getState();
const W = () => useStore.getState();

/* ---------- Session ---------- */

export async function startAutomation(user: AutomationUser) {
  if (session?.user.id === user.id) return;
  stopAutomation();
  const storeKey = await bindAutomationStore(user.id);
  const useCloud = user.provider === "google";
  const cleanups: (() => void)[] = [];
  session = { user, cloud: useCloud, stop: () => cleanups.forEach((f) => f()) };

  if (useCloud) await syncFromCloud();
  else A().setCloud("off");

  // Task/sprint events from the workspace.
  cleanups.push(
    useStore.subscribe((s, prev) => {
      if (eventsSuppressed() || !session) return;
      const origin = currentOrigin();
      if (s.tasks !== prev.tasks) diffTasks(prev.tasks, s.tasks, origin);
      if (s.sprints !== prev.sprints) {
        const before = new Set(prev.sprints.map((x) => x.id));
        for (const sp of s.sprints)
          if (!before.has(sp.id)) dispatch({ id: `sprint_created:${sp.id}`, type: "sprint_created", at: now(), sprintId: sp.id, origin });
      }
    }),
  );

  // Another tab changed automations: pick the change up.
  const onStorage = (e: StorageEvent) => {
    if (e.key === storeKey) void useAutomation.persist.rehydrate();
  };
  window.addEventListener("storage", onStorage);
  cleanups.push(() => window.removeEventListener("storage", onStorage));

  // One tab runs schedules and watchers.
  const abort = new AbortController();
  let release: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const lead = () => {
    A().setLeader(true);
    setTimeout(() => void tick(), 2000);
    timer = setInterval(() => void tick(), TICK_MS);
  };
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    navigator.locks
      .request("cali-task:automation-leader", { signal: abort.signal }, () => {
        lead();
        return new Promise<void>((r) => (release = r));
      })
      .catch(() => {});
  } else lead();
  cleanups.push(() => {
    abort.abort();
    release?.();
    if (timer) clearInterval(timer);
    A().setLeader(false);
  });
}

export function stopAutomation() {
  session?.stop();
  session = null;
}

async function syncFromCloud() {
  A().setCloud("loading");
  try {
    const remote = await cloud.loadAutomationCloud();
    const local = A();
    const remoteIds = new Set(remote.workflows.map((w) => w.id));
    // Workflows made here before the tables existed are uploaded, not lost.
    const localOnly = local.workflows.filter((w) => !remoteIds.has(w.id));
    for (const w of localOnly) await cloud.saveWorkflowCloud(w, session!.user.id).catch(() => {});
    const execIds = new Set(remote.executions.map((e) => e.id));
    const localNodes = new Map(local.executions.map((e) => [e.id, e.nodes]));
    const notifIds = new Set(remote.notifications.map((n) => n.id));
    local.replaceAll({
      workflows: [...remote.workflows, ...localOnly],
      schedules: remote.schedules.length ? remote.schedules : local.schedules,
      executions: [
        ...remote.executions.map((e) => ({ ...e, nodes: localNodes.get(e.id) ?? [] })),
        ...local.executions.filter((e) => !execIds.has(e.id)),
      ].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
      notifications: [...remote.notifications, ...local.notifications.filter((n) => !notifIds.has(n.id))].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      audit: remote.audit.length ? remote.audit : local.audit,
    });
    A().setCloud("ok");
  } catch (e) {
    console.warn("[automation] cloud load failed:", e instanceof Error ? e.message : e);
    A().setCloud(cloud.isMissingTable(e) ? "missing" : "error");
  }
}

const cloudOn = () => !!session?.cloud && A().cloud === "ok";
function mirror(label: string, fn: () => Promise<unknown>) {
  if (!cloudOn()) return;
  fn().catch((e) => console.warn(`[automation] ${label} failed:`, e?.message ?? e));
}

const now = () => new Date().toISOString();

function audit(workflowId: string | null, action: string, detail: string) {
  const a = { id: uid(), at: now(), workflowId, action, detail };
  A().addAudit(a);
  if (session) mirror("audit", () => cloud.insertAuditCloud(a, session!.user.id));
}

/* ---------- Event detection ---------- */

function diffTasks(prev: Task[], next: Task[], origin: AutomationEvent["origin"]) {
  const before = new Map(prev.map((t) => [t.id, t]));
  const at = now();
  for (const t of next) {
    const old = before.get(t.id);
    if (!old) {
      dispatch({ id: `task_created:${t.id}`, type: "task_created", at, taskId: t.id, sprintId: t.sprintId, origin });
      continue;
    }
    if (old === t) continue;
    if (old.updatedAt !== t.updatedAt)
      dispatch({ id: `task_updated:${t.id}:${t.updatedAt}`, type: "task_updated", at, taskId: t.id, sprintId: t.sprintId, origin });
    if (old.status !== t.status) {
      const n = t.history.length;
      dispatch({ id: `status:${t.id}:${n}`, type: "task_status_changed", at, taskId: t.id, sprintId: t.sprintId, from: old.status, to: t.status, origin });
      if (t.status === "completed")
        dispatch({ id: `completed:${t.id}:${n}`, type: "task_completed", at, taskId: t.id, sprintId: t.sprintId, from: old.status, to: t.status, origin });
    }
    if ((old.assignee ?? "") !== (t.assignee ?? "") && t.assignee)
      dispatch({ id: `assigned:${t.id}:${t.assignee}:${t.updatedAt}`, type: "task_assigned", at, taskId: t.id, sprintId: t.sprintId, assignee: t.assignee, origin });
  }
}

const triggerOf = (w: Workflow): WFNode | undefined => w.definition.nodes.find((n) => NODE_BY_TYPE.get(n.type)?.category === "trigger");

function dispatch(event: AutomationEvent) {
  const ws = readAdapter();
  for (const w of A().workflows) {
    if (w.status !== "active") continue;
    const trig = triggerOf(w);
    const def = trig && NODE_BY_TYPE.get(trig.type);
    if (!trig || def?.event !== event.type) continue;
    if (def.matches && !def.matches(event, trig.config ?? {}, ws)) continue;
    tryRun(w, event, itemsForEvent(event));
  }
}

function itemsForEvent(e: AutomationEvent): Item[] {
  const s = W();
  if (e.taskId) {
    const task = s.tasks.find((t) => t.id === e.taskId);
    return task ? [{ task, sprint: s.sprints.find((x) => x.id === task.sprintId) ?? null, event: e, vars: {} }] : [];
  }
  if (e.sprintId) {
    const sprint = s.sprints.find((x) => x.id === e.sprintId);
    return sprint ? [{ sprint, event: e, vars: {} }] : [];
  }
  return [{ event: e, vars: {} }];
}

const lastLimitAudit = new Map<string, number>();

/** Guards (loops, duplicates, rate limits), then queues the run. */
function tryRun(w: Workflow, event: AutomationEvent, items: Item[], source: ExecSource = "event") {
  const depth = event.origin ? event.origin.depth + 1 : 0;
  if (event.origin) {
    if (event.origin.workflowId === w.id && !w.settings.allowSelfTrigger) return;
    if (depth > LIMITS.maxDepth) {
      audit(w.id, "skipped", `Not run: automation chain deeper than ${LIMITS.maxDepth} (${event.type}).`);
      return;
    }
  }
  if (A().processed[w.id]?.includes(event.id)) return;
  const hourAgo = Date.now() - 3_600_000;
  const recent = A().executions.filter((e) => e.workflowId === w.id && e.source !== "test" && Date.parse(e.startedAt) > hourAgo).length;
  if (recent >= w.settings.maxRunsPerHour) {
    if (Date.now() - (lastLimitAudit.get(w.id) ?? 0) > 600_000) {
      lastLimitAudit.set(w.id, Date.now());
      audit(w.id, "rate_limited", `Paused: reached ${w.settings.maxRunsPerHour} runs in the last hour.`);
    }
    return;
  }
  A().markProcessed(w.id, event.id);
  void enqueue(() => runExecution(w, { source, event, items, depth, dryRun: false }));
}

/* ---------- Running ---------- */

let chain: Promise<unknown> = Promise.resolve();
/** Runs one execution at a time so changes never interleave. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

interface RunParams {
  source: ExecSource;
  event?: AutomationEvent | null;
  items: Item[];
  depth: number;
  dryRun: boolean;
}

async function runExecution(w: Workflow, p: RunParams, resume?: Execution): Promise<Execution | null> {
  if (!session) return null;
  const userId = session.user.id;
  const trig = triggerOf(w);
  const exec: Execution = resume ?? {
    id: uid(),
    workflowId: w.id,
    workflowName: w.name,
    triggerType: trig?.type ?? "unknown",
    triggerEventId: p.event?.id ?? null,
    source: p.source,
    status: "running",
    dryRun: p.dryRun,
    depth: p.depth,
    input: p.event ? { event: p.event } : { source: p.source, items: p.items.length },
    output: null,
    startedAt: now(),
    completedAt: null,
    error: null,
    nodes: [],
    resume: null,
  };

  const recordInCloud = cloudOn() && p.source !== "test";
  if (recordInCloud && !resume) {
    try {
      if ((await cloud.insertExecutionCloud(exec, userId)) === "duplicate") return null; // another tab/device ran it
    } catch (e) {
      console.warn("[automation] could not record run:", (e as Error)?.message);
      if (/limit/i.test((e as Error)?.message ?? "")) {
        audit(w.id, "rate_limited", "The server's hourly automation limit was reached.");
        return null;
      }
    }
  }

  A().upsertExecution(exec);
  let result: Execution;
  try {
    const ws = p.dryRun
      ? createMemoryAdapter(workspaceSnapshot(), { owner: ownerName(), ownerId: userId, dryRun: true, ai: aiGenerate })
      : liveAdapter(w, exec);
    result = await executeWorkflow({
      workflow: w,
      ws,
      execution: exec,
      items: p.items,
      event: p.event,
      makeId: uid,
      onProgress: (e) => A().upsertExecution(e),
    });
  } catch (e) {
    // Never leave a run stuck as "running".
    result = { ...exec, status: "failed", error: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`, completedAt: now(), resume: null };
  }
  A().upsertExecution({ ...result, nodes: [...result.nodes] });

  if (!p.dryRun && p.source !== "test") {
    const cur = A().workflows.find((x) => x.id === w.id);
    if (cur) A().upsertWorkflow({ ...cur, lastRunAt: exec.startedAt });
  }
  if (recordInCloud) mirror("finish run", () => cloud.finishExecutionCloud(result, userId, result.nodes));
  if (result.status === "waiting") scheduleResume(result);
  return result;
}

const resumeTimers = new Map<string, ReturnType<typeof setTimeout>>();
/** Short delays resume on time; longer ones are picked up by the scheduler tick. */
function scheduleResume(e: Execution) {
  if (!e.resume) return;
  const ms = Date.parse(e.resume.resumeAt) - Date.now();
  if (ms > TICK_MS) return;
  clearTimeout(resumeTimers.get(e.id));
  resumeTimers.set(
    e.id,
    setTimeout(() => {
      resumeTimers.delete(e.id);
      void resumeExecution(e.id);
    }, Math.max(0, ms)),
  );
}

async function resumeExecution(id: string) {
  const e = A().executions.find((x) => x.id === id);
  if (!e || e.status !== "waiting" || !e.resume || Date.parse(e.resume.resumeAt) > Date.now()) return;
  const w = A().workflows.find((x) => x.id === e.workflowId);
  if (!w || w.status !== "active") {
    const cancelled = { ...e, status: "cancelled" as const, completedAt: now(), error: "The workflow was turned off while waiting.", resume: null };
    A().upsertExecution(cancelled);
    if (session) mirror("cancel run", () => cloud.finishExecutionCloud(cancelled, session!.user.id, cancelled.nodes));
    return;
  }
  await enqueue(() => runExecution(w, { source: e.source, items: [], depth: e.depth, dryRun: false }, structuredClone(e)));
}

/* ---------- Adapters ---------- */

/** Plain data copy of the workspace (no store functions) for dry runs. */
function workspaceSnapshot() {
  const s = W();
  return { version: s.version, tasks: s.tasks, sprints: s.sprints, activity: [], activeSprintId: s.activeSprintId, settings: s.settings };
}

function ownerName() {
  return W().settings.userName || session?.user.fullName || "You";
}

function readAdapter(): WorkspaceAdapter {
  return liveAdapter(null, null);
}

function liveAdapter(w: Workflow | null, exec: Execution | null): WorkspaceAdapter {
  const origin = { workflowId: w?.id ?? "", depth: exec?.depth ?? 0 };
  const act = <T,>(fn: () => T) => withOrigin(origin, fn);
  const must = (t: Task | undefined) => {
    if (!t) throw new NodeError("Task not found.");
    return t;
  };
  const getTask = (id: string) => W().tasks.find((t) => t.id === id) ?? null;
  const getSprint = (id: string) => W().sprints.find((s) => s.id === id) ?? null;
  return {
    dryRun: false,
    now: () => new Date(),
    tasks: () => W().tasks,
    sprints: () => W().sprints,
    activeSprintId: () => W().activeSprintId,
    getTask,
    getSprint,
    ownerName,
    ownerId: () => session?.user.id ?? "",

    createTask(input) {
      const d = newTask(input, W().tasks, new Date(), "tmp");
      const taskInput: TaskInput = {
        code: d.code,
        title: d.title,
        description: d.description,
        sprintId: d.sprintId,
        estimateDays: d.estimateDays,
        status: d.status,
        priority: d.priority,
        startDate: d.startDate,
        targetDate: d.targetDate,
        completedDate: d.completedDate,
        notes: d.notes,
        dependencies: [],
        assignee: d.assignee,
        blocker: null,
      };
      return act(() => W().addTask(taskInput));
    },
    updateTask(id, patch) {
      must(getTask(id) ?? undefined);
      act(() => W().updateTask(id, patch as Partial<TaskInput>));
      return must(getTask(id) ?? undefined);
    },
    setStatus(id, status: Status, reason) {
      must(getTask(id) ?? undefined);
      act(() =>
        status === "blocked"
          ? W().blockTask(id, { reason: reason || "Blocked by automation", blockedOn: today(), waitingOn: "", requiredAction: "" })
          : W().setStatus(id, status),
      );
      return must(getTask(id) ?? undefined);
    },
    addComment(id, text, author) {
      must(getTask(id) ?? undefined);
      act(() => W().addComment(id, text, author));
      return must(getTask(id) ?? undefined);
    },
    createSprint(input, makeActive) {
      const prevActive = W().activeSprintId;
      const s = act(() => W().addSprint(input));
      if (!makeActive) W().setActiveSprint(prevActive);
      return s;
    },
    updateSprint(id, patch) {
      if (!getSprint(id)) throw new NodeError("Sprint not found.");
      act(() => W().updateSprint(id, patch));
      return getSprint(id)!;
    },
    notify(n) {
      const rec: AppNotification = {
        id: uid(),
        workflowId: w?.id ?? null,
        executionId: exec?.id ?? null,
        recipientId: session?.user.id ?? "",
        type: "in_app",
        title: n.title,
        message: n.message,
        taskId: n.taskId,
        createdAt: now(),
        readAt: null,
      };
      A().addNotification(rec);
      // Test runs aren't stored in the cloud, so don't link to them there.
      const cloudRec = exec?.source === "test" ? { ...rec, executionId: null } : rec;
      if (session) mirror("notification", () => cloud.insertNotificationCloud(cloudRec, session!.user.id));
      return rec;
    },
    async sendEmail(n) {
      if (!session?.cloud) throw new NodeError("Email notifications need a Google account (delivery runs through Cali's server).");
      const token = await cloud.accessToken().catch(() => null);
      if (!token) throw new NodeError("You're signed out of Google; sign in again to send email.");
      let res: Response;
      try {
        res = await fetch("/api/automation/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subject: n.subject, body: n.body, workflowId: w?.id ?? null, executionId: exec?.id ?? null }),
        });
      } catch {
        throw new NodeError("Couldn't reach the email service.", true);
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string; to?: string; error?: string; notification?: AppNotification };
      if (!res.ok) throw new NodeError(body.error || `Email failed (${res.status}).`, res.status >= 500 && res.status !== 501);
      if (body.notification) A().addNotification(body.notification);
      return { id: body.id ?? "", to: body.to ?? "" };
    },
    generateText: aiGenerate,
  };
}

/** Calls the user's own AI provider through Cali's server (the key never reaches the browser). */
async function aiGenerate(p: AiRequest): Promise<string> {
  if (!session?.cloud) throw new NodeError("AI steps need a Google account (your API key is stored encrypted on Cali's server).");
  const token = await cloud.accessToken().catch(() => null);
  if (!token) throw new NodeError("You're signed out of Google; sign in again to use AI steps.");
  let res: Response;
  try {
    res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(p),
    });
  } catch {
    throw new NodeError("Couldn't reach Cali's server.", true);
  }
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!res.ok || !body.text) {
    const recoverable = res.status === 429 || res.status === 502 || res.status === 504;
    throw new NodeError(body.error || `AI request failed (${res.status}).`, recoverable);
  }
  return body.text;
}

/* ---------- Scheduler & watchers (leader tab only) ---------- */

let ticking = false;
async function tick() {
  if (!session || ticking) return;
  ticking = true;
  try {
    // 1. Resume delayed runs.
    for (const e of A().executions)
      if (e.status === "waiting" && e.resume && Date.parse(e.resume.resumeAt) <= Date.now()) {
        if (cloudOn()) {
          // Several devices may be open; only one resumes.
          const claimed = await claimResume(e.id);
          if (!claimed) continue;
        }
        await resumeExecution(e.id);
      }

    // 2. Scheduled triggers (a missed run catches up once).
    for (const sc of A().schedules) {
      if (!sc.isActive || !sc.nextExecutionAt || Date.parse(sc.nextExecutionAt) > Date.now()) continue;
      const w = A().workflows.find((x) => x.id === sc.workflowId && x.status === "active");
      if (!w) continue;
      const next = nextRun(sc.config, new Date()).toISOString();
      if (cloudOn()) {
        const ok = await cloud.claimScheduleCloud(sc, next).catch(() => false);
        if (!ok) {
          void syncFromCloud();
          continue;
        }
      }
      A().upsertSchedule({ ...sc, nextExecutionAt: next });
      const trig = triggerOf(w);
      const items = itemsForScope(String(trig?.config?.forEach ?? "none"), readAdapter());
      tryRun(w, { id: `schedule:${w.id}:${sc.nextExecutionAt}`, type: "schedule", at: now() }, items, "schedule");
    }

    // 3. Date-based watchers.
    watch();
  } finally {
    ticking = false;
  }
}

async function claimResume(id: string) {
  const c = (await import("../supabase")).getSupabase();
  if (!c) return true;
  const { data, error } = await c.from("workflow_executions").update({ status: "running" }).eq("id", id).eq("status", "waiting").select("id");
  if (error) return true; // fall back to local behaviour
  return (data ?? []).length > 0;
}

function watch() {
  const s = W();
  const t0 = today();
  const ws = readAdapter();
  for (const w of A().workflows) {
    if (w.status !== "active") continue;
    const trig = triggerOf(w);
    const def = trig && NODE_BY_TYPE.get(trig.type);
    if (!trig || !def) continue;
    const c = trig.config ?? {};
    const since = toDateStr(new Date(w.activatedAt ?? w.createdAt));
    const fire = (e: AutomationEvent) => {
      if (def.matches && !def.matches(e, c, ws)) return;
      tryRun(w, e, itemsForEvent(e));
    };
    switch (def.event) {
      case "task_deadline_approaching": {
        const n = c.interval === "custom" ? Math.max(0, Number(c.customDays) || 0) : Number(c.interval) || 1;
        for (const t of s.tasks) {
          if (t.status === "completed" || !t.targetDate) continue;
          const d = daysDiff(t0, t.targetDate);
          if (d >= 0 && d <= n)
            fire({ id: `deadline:${t.id}:${t.targetDate}:${n}`, type: "task_deadline_approaching", at: now(), taskId: t.id, sprintId: t.sprintId, daysLeft: d });
        }
        break;
      }
      case "task_overdue":
        for (const t of s.tasks)
          if (t.status !== "completed" && t.targetDate && t.targetDate < t0)
            fire({ id: `overdue:${t.id}:${t.targetDate}`, type: "task_overdue", at: now(), taskId: t.id, sprintId: t.sprintId });
        break;
      case "sprint_started":
        for (const sp of s.sprints)
          if (sp.startDate <= t0 && sp.startDate >= since && t0 <= sp.endDate)
            fire({ id: `sprint_started:${sp.id}:${sp.startDate}`, type: "sprint_started", at: now(), sprintId: sp.id });
        break;
      case "sprint_completed": {
        const when = String(c.when ?? "either");
        for (const sp of s.sprints) {
          if (sp.endDate < since) continue; // finished before this workflow existed
          const own = s.tasks.filter((t) => t.sprintId === sp.id);
          const ended = sp.endDate < t0;
          const allDone = own.length > 0 && own.every((t) => t.status === "completed");
          const hit = when === "end_date" ? ended : when === "all_done" ? allDone : ended || allDone;
          if (hit) fire({ id: `sprint_completed:${sp.id}:${when}`, type: "sprint_completed", at: now(), sprintId: sp.id });
        }
        break;
      }
    }
  }
}

/* ---------- Public API for the UI ---------- */

export const DEFAULT_SETTINGS = { allowSelfTrigger: false, maxRunsPerHour: 60 };

export function newWorkflow(p: { name: string; description?: string; definition: WorkflowDefinition; templateId?: string | null }): Workflow {
  const t = now();
  return {
    id: uid(),
    name: p.name.trim().slice(0, 120) || "Untitled workflow",
    description: (p.description ?? "").slice(0, 1000),
    status: "draft",
    definition: p.definition,
    settings: { ...DEFAULT_SETTINGS },
    createdBy: session?.user.id ?? "",
    createdAt: t,
    updatedAt: t,
    activatedAt: null,
    lastRunAt: null,
    templateId: p.templateId ?? null,
  };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  workflow?: Workflow;
}

export async function saveWorkflow(w: Workflow, opts: { isNew?: boolean } = {}): Promise<SaveResult> {
  if (!session) return { ok: false, error: "Not signed in." };
  const issues = validateWorkflow(w.definition);
  if (w.status === "active" && hasErrors(issues))
    return { ok: false, error: "This workflow is active. Fix the errors (or turn it off) before saving." };
  const saved: Workflow = { ...w, name: w.name.trim().slice(0, 120) || "Untitled workflow", updatedAt: now() };
  if (cloudOn()) {
    try {
      await cloud.saveWorkflowCloud(saved, session.user.id);
    } catch (e) {
      return { ok: false, error: `Couldn't save to the cloud: ${(e as Error)?.message ?? e}` };
    }
  }
  A().upsertWorkflow(saved);
  syncSchedule(saved);
  audit(saved.id, opts.isNew ? "created" : "updated", `${opts.isNew ? "Created" : "Saved"} "${saved.name}" (${saved.definition.nodes.length} steps).`);
  return { ok: true, workflow: saved };
}

export async function setWorkflowStatus(id: string, status: "active" | "inactive"): Promise<SaveResult> {
  const w = A().workflows.find((x) => x.id === id);
  if (!w) return { ok: false, error: "Workflow not found." };
  if (status === "active") {
    const issues = validateWorkflow(w.definition);
    if (hasErrors(issues)) return { ok: false, error: issues.find((i) => i.level === "error")!.message };
    if (!w.definition.edges.length) return { ok: false, error: "Connect the trigger to at least one step first." };
  }
  const next: Workflow = { ...w, status, activatedAt: status === "active" ? now() : w.activatedAt };
  const r = await saveWorkflowQuiet(next);
  if (r.ok) audit(id, status === "active" ? "activated" : "deactivated", `${status === "active" ? "Activated" : "Deactivated"} "${w.name}".`);
  return r;
}

async function saveWorkflowQuiet(w: Workflow): Promise<SaveResult> {
  const saved = { ...w, updatedAt: now() };
  if (cloudOn()) {
    try {
      await cloud.saveWorkflowCloud(saved, session!.user.id);
    } catch (e) {
      return { ok: false, error: `Couldn't save to the cloud: ${(e as Error)?.message ?? e}` };
    }
  }
  A().upsertWorkflow(saved);
  syncSchedule(saved);
  return { ok: true, workflow: saved };
}

function syncSchedule(w: Workflow) {
  const trig = triggerOf(w);
  const existing = A().schedules.find((s) => s.workflowId === w.id);
  if (trig?.type !== "trigger.schedule") {
    if (existing) {
      A().removeScheduleFor(w.id);
      mirror("delete schedule", () => cloud.deleteScheduleCloud(w.id));
    }
    return;
  }
  const config = normalizeSchedule({ ...trig.config, weekday: Number(trig.config.weekday ?? 1) } as never);
  const active = w.status === "active";
  const sameConfig = existing && JSON.stringify(existing.config) === JSON.stringify(config);
  const sc: WorkflowSchedule = {
    id: existing?.id ?? uid(),
    workflowId: w.id,
    scheduleType: config.frequency,
    config,
    nextExecutionAt: active ? (sameConfig && existing?.isActive && existing.nextExecutionAt ? existing.nextExecutionAt : nextRun(config, new Date()).toISOString()) : null,
    isActive: active,
  };
  A().upsertSchedule(sc);
  mirror("save schedule", () => cloud.saveScheduleCloud(sc, session!.user.id));
}

export async function deleteWorkflow(id: string): Promise<SaveResult> {
  const w = A().workflows.find((x) => x.id === id);
  if (!w) return { ok: true };
  if (cloudOn()) {
    try {
      await cloud.deleteWorkflowCloud(id);
    } catch (e) {
      return { ok: false, error: `Couldn't delete from the cloud: ${(e as Error)?.message ?? e}` };
    }
  }
  A().removeWorkflow(id);
  A().removeExecutionsFor(id);
  audit(null, "deleted", `Deleted "${w.name}".`);
  return { ok: true };
}

export async function duplicateWorkflow(id: string): Promise<SaveResult> {
  const w = A().workflows.find((x) => x.id === id);
  if (!w) return { ok: false, error: "Workflow not found." };
  const map = new Map(w.definition.nodes.map((n) => [n.id, uid()]));
  const copy = newWorkflow({
    name: `${w.name} (copy)`,
    description: w.description,
    templateId: w.templateId,
    definition: {
      nodes: w.definition.nodes.map((n) => ({ ...structuredClone(n), id: map.get(n.id)! })),
      edges: w.definition.edges.map((e) => ({ ...e, id: uid(), source: map.get(e.source)!, target: map.get(e.target)! })),
      viewport: w.definition.viewport,
    },
  });
  return saveWorkflow(copy, { isNew: true });
}

/** "Run now" for manual and scheduled workflows: real changes. */
export async function runNow(id: string): Promise<Execution | null> {
  const w = A().workflows.find((x) => x.id === id);
  if (!w) return null;
  const trig = triggerOf(w);
  if (!trig) return null;
  const items = sampleItems(w, null);
  audit(id, "run", `Ran "${w.name}" manually.`);
  return enqueue(() => runExecution(w, { source: "manual", items, depth: 0, dryRun: false, event: { id: `manual:${uid()}`, type: "manual", at: now() } }));
}

/**
 * Test a workflow (saved or not). Dry runs use a private copy of the
 * workspace, so nothing changes; "apply changes" runs it for real.
 */
export async function testWorkflow(w: Workflow, opts: { dryRun: boolean; taskId?: string | null }): Promise<Execution | null> {
  if (!session) return null;
  const items = sampleItems(w, opts.taskId ?? null);
  if (!opts.dryRun) audit(w.id, "test", `Tested "${w.name}" with real changes.`);
  return enqueue(() => runExecution(w, { source: "test", items, depth: 0, dryRun: opts.dryRun }));
}

/** What the trigger would hand to the first step, for tests and manual runs. */
export function sampleItems(w: Workflow, taskId: string | null): Item[] {
  const trig = triggerOf(w);
  const def = trig && NODE_BY_TYPE.get(trig.type);
  const s = W();
  if (!trig || !def) return [];
  const at = now();
  if (def.event === "schedule" || def.event === "manual") return itemsForScope(String(trig.config?.forEach ?? "none"), readAdapter());
  if (def.event?.startsWith("sprint")) {
    const sp = s.sprints.find((x) => x.id === s.activeSprintId) ?? s.sprints[0];
    return sp ? [{ sprint: sp, event: { id: `test:${uid()}`, type: def.event, at, sprintId: sp.id }, vars: {} }] : [];
  }
  const task =
    (taskId && s.tasks.find((t) => t.id === taskId)) ||
    s.tasks.find((t) => t.sprintId === s.activeSprintId && t.status !== "completed") ||
    s.tasks[0];
  if (!task) return [];
  return [
    {
      task,
      sprint: s.sprints.find((x) => x.id === task.sprintId) ?? null,
      event: { id: `test:${uid()}`, type: def.event!, at, taskId: task.id, sprintId: task.sprintId, from: task.history.at(-1)?.from ?? null, to: task.status, assignee: task.assignee ?? null },
      vars: {},
    },
  ];
}

export function cancelExecution(id: string) {
  const e = A().executions.find((x) => x.id === id);
  if (!e || (e.status !== "waiting" && e.status !== "running")) return;
  clearTimeout(resumeTimers.get(id));
  const c: Execution = { ...e, status: "cancelled", completedAt: now(), error: "Cancelled by you.", resume: null };
  A().upsertExecution(c);
  if (session && e.source !== "test") mirror("cancel run", () => cloud.finishExecutionCloud(c, session!.user.id, []));
  audit(e.workflowId, "cancelled", `Cancelled a run of "${e.workflowName}".`);
}

export async function loadExecutionDetail(id: string) {
  const e = A().executions.find((x) => x.id === id);
  if (!e || e.nodes.length || !cloudOn()) return e ?? null;
  try {
    const nodes = await cloud.loadNodeExecutions(id);
    const full = { ...e, nodes };
    A().upsertExecution(full);
    return full;
  } catch {
    return e;
  }
}

export function markNotificationsRead(ids: string[]) {
  A().markRead(ids);
  mirror("mark read", () => cloud.markNotificationsReadCloud(ids));
}

export function deleteNotification(id: string) {
  A().removeNotification(id);
  mirror("delete notification", () => cloud.deleteNotificationCloud(id));
}

export function retryCloud() {
  if (session?.cloud) void syncFromCloud();
}
