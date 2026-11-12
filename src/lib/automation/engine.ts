/**
 * Workflow execution engine.
 *
 * Runs a saved workflow definition: starts at its trigger, executes connected
 * steps in order (breadth-first), routes items down TRUE/FALSE branches,
 * passes each step's output items to the next, and records every step.
 * Stops safely on the first failure, retries recoverable errors, enforces a
 * step limit and an active-time budget, and can pause on Delay steps and
 * resume later from the saved queue.
 */
import { NODE_BY_TYPE, MAX_ITEMS, type NodeResult } from "./nodes";
import { hasErrors, validateWorkflow } from "./validate";
import type {
  AutomationEvent,
  Execution,
  HandleId,
  Item,
  NodeExecution,
  QueueEntry,
  Workflow,
  WorkspaceAdapter,
} from "./types";
import { NodeError } from "./types";

export const LIMITS = {
  /** Steps one run may execute (a step that runs on two branches counts twice). */
  maxSteps: 200,
  /** Time a run may spend actively working, not counting Delay waits. */
  maxActiveMs: 30_000,
  /** Retries for recoverable errors. */
  maxRetries: 3,
  /** Event chains: an automation's change may trigger at most this many more. */
  maxDepth: 3,
};

export interface RunOptions {
  workflow: Workflow;
  ws: WorkspaceAdapter;
  /** A record created by the caller with status "running" (fresh) or "waiting" (resume). */
  execution: Execution;
  /** Items produced by the trigger (fresh runs). */
  items?: Item[];
  event?: AutomationEvent | null;
  makeId: () => string;
  onProgress?: (e: Execution) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Compact, size-bounded view of items for the execution log. */
export function summarizeItems(items: Item[]) {
  return {
    count: items.length,
    items: items.slice(0, 15).map((i) => ({
      ...(i.task
        ? {
            task: {
              id: i.task.id,
              code: i.task.code,
              title: i.task.title,
              status: i.task.status,
              priority: i.task.priority,
              targetDate: i.task.targetDate,
              assignee: i.task.assignee || null,
              labels: i.task.labels ?? [],
            },
          }
        : {}),
      ...(i.sprint ? { sprint: { id: i.sprint.id, name: i.sprint.name, startDate: i.sprint.startDate, endDate: i.sprint.endDate } } : {}),
      ...(i.report ? { report: i.report } : {}),
      ...(i.event ? { event: { type: i.event.type, from: i.event.from ?? undefined, to: i.event.to ?? undefined } } : {}),
      ...(Object.keys(i.vars ?? {}).length ? { vars: clip(i.vars) } : {}),
    })),
  };
}

function clip(v: unknown): unknown {
  const s = JSON.stringify(v);
  return s && s.length > 4000 ? { truncated: true, preview: s.slice(0, 4000) } : v;
}

export async function executeWorkflow(opts: RunOptions): Promise<Execution> {
  const { workflow, ws, makeId } = opts;
  const sleep = opts.sleep ?? defaultSleep;
  const exec = opts.execution;
  const progress = () => opts.onProgress?.({ ...exec, nodes: [...exec.nodes] });
  const def = workflow.definition;
  const byId = new Map(def.nodes.map((n) => [n.id, n]));

  const fail = (message: string) => {
    exec.status = "failed";
    exec.error = message;
    exec.completedAt = ws.now().toISOString();
    exec.resume = null;
    progress();
    return exec;
  };

  const issues = validateWorkflow(def);
  if (hasErrors(issues)) return fail(`Workflow is invalid: ${issues.find((i) => i.level === "error")!.message}`);

  const children = (nodeId: string, handle: HandleId, items: Item[]): QueueEntry[] =>
    items.length === 0
      ? []
      : def.edges.filter((e) => e.source === nodeId && (e.sourceHandle ?? "out") === handle).map((e) => ({ nodeId: e.target, items }));

  let queue: QueueEntry[];
  let steps: number;
  let activeMs: number;

  if (exec.resume) {
    queue = exec.resume.queue;
    steps = exec.resume.steps;
    activeMs = exec.resume.activeMs;
    exec.status = "running";
    exec.resume = null;
    for (const n of exec.nodes) if (n.status === "waiting") n.status = "success";
  } else {
    const trigger = def.nodes.find((n) => NODE_BY_TYPE.get(n.type)?.category === "trigger")!;
    const items = (opts.items ?? []).slice(0, MAX_ITEMS);
    const t0 = ws.now();
    exec.nodes.push({
      id: makeId(),
      nodeId: trigger.id,
      nodeType: trigger.type,
      label: trigger.label || NODE_BY_TYPE.get(trigger.type)!.label,
      status: "success",
      input: opts.event ? { event: opts.event } : { source: exec.source },
      output: summarizeItems(items),
      startedAt: t0.toISOString(),
      completedAt: t0.toISOString(),
      durationMs: 0,
      attempts: 1,
      error: null,
    });
    queue = children(trigger.id, "out", items);
    steps = 0;
    activeMs = 0;
    if (items.length === 0) exec.output = { note: "The trigger found nothing to process." };
  }
  progress();

  const runStart = Date.now() - activeMs;
  let lastOut: Item[] | null = null;

  while (queue.length) {
    if (++steps > LIMITS.maxSteps) return fail(`Stopped after ${LIMITS.maxSteps} steps (safety limit).`);
    if (Date.now() - runStart > LIMITS.maxActiveMs) return fail(`Timed out after ${LIMITS.maxActiveMs / 1000}s.`);

    const entry = queue.shift()!;
    const node = byId.get(entry.nodeId);
    const nd = node ? NODE_BY_TYPE.get(node.type) : undefined;
    if (!node || !nd?.run) return fail("A step in this workflow no longer exists.");

    const label = node.label || nd.label;
    const rec: NodeExecution = {
      id: makeId(),
      nodeId: node.id,
      nodeType: node.type,
      label,
      status: "running",
      input: summarizeItems(entry.items),
      output: null,
      startedAt: ws.now().toISOString(),
      completedAt: null,
      durationMs: 0,
      attempts: 0,
      error: null,
    };
    exec.nodes.push(rec);
    progress();

    if (entry.items.length > MAX_ITEMS) {
      rec.status = "failed";
      rec.error = `${entry.items.length} items is over the ${MAX_ITEMS}-item limit.`;
      return fail(`${label}: ${rec.error}`);
    }

    const started = Date.now();
    const maxAttempts = nd.retryable ? 1 + Math.min(LIMITS.maxRetries, Math.max(0, Number(node.config?.retries ?? 0) || 0)) : 1;
    let result: NodeResult | null = null;
    let error: string | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      rec.attempts = attempt;
      try {
        result = await nd.run({ ws, workflow, node, executionId: exec.id }, entry.items, node.config ?? {});
        error = null;
        break;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        const recoverable = e instanceof NodeError ? e.recoverable : false;
        if (!recoverable || attempt === maxAttempts) break;
        await sleep(Math.min(8000, 750 * 2 ** (attempt - 1)));
      }
    }
    rec.durationMs = Date.now() - started;
    rec.completedAt = ws.now().toISOString();

    if (error || !result) {
      rec.status = "failed";
      rec.error = error ?? "The step returned nothing.";
      return fail(`${label}: ${rec.error}`);
    }

    rec.status = "success";
    if (nd.category === "condition") {
      rec.branch = { true: result.true?.length ?? 0, false: result.false?.length ?? 0 };
      rec.output = { true: summarizeItems(result.true ?? []), false: summarizeItems(result.false ?? []) };
    } else {
      rec.output = { ...summarizeItems(result.out ?? []), ...(result.detail ? { detail: result.detail } : {}) };
    }

    const next = [
      ...children(node.id, "out", result.out ?? []),
      ...children(node.id, "true", result.true ?? []),
      ...children(node.id, "false", result.false ?? []),
    ];
    lastOut = result.out ?? result.true ?? lastOut;

    if (result.waitUntil) {
      if (ws.dryRun) {
        rec.output = { ...(rec.output as object), note: `Would wait until ${result.waitUntil.toISOString()} (skipped in test).` };
      } else {
        rec.status = "waiting";
        exec.status = "waiting";
        exec.resume = {
          resumeAt: result.waitUntil.toISOString(),
          queue: [...next, ...queue],
          steps,
          activeMs: Date.now() - runStart,
        };
        progress();
        return exec;
      }
    }
    queue.push(...next);
    progress();
  }

  exec.status = "success";
  exec.completedAt = ws.now().toISOString();
  if (lastOut) exec.output = summarizeItems(lastOut);
  exec.resume = null;
  progress();
  return exec;
}
