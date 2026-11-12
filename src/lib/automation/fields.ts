/**
 * Reading values out of workflow items: the field catalogue used by
 * conditions, {{template}} interpolation, and condition evaluation.
 *
 * Safety: nothing here evaluates user text as code. Templates are plain
 * {{path}} lookups against a fixed set of fields; operators are a closed list.
 */
import type { Sprint, Task } from "../types";
import type { Item, SprintReport, WorkspaceAdapter } from "./types";
import { addDays, daysDiff, toDateStr } from "../utils";

export const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  for_retest: "For Retest",
  for_testing: "For Testing",
  blocked: "Blocked",
  completed: "Completed",
};
export const PRIORITY_LABELS: Record<string, string> = { low: "Low", medium: "Medium", high: "High", critical: "Critical" };
const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export type FieldKind = "text" | "number" | "date" | "status" | "priority" | "boolean" | "list";

export interface FieldDef {
  path: string;
  label: string;
  kind: FieldKind;
  group: "Task" | "Sprint" | "Event" | "Values";
}

export const FIELDS: FieldDef[] = [
  { path: "task.title", label: "Task title", kind: "text", group: "Task" },
  { path: "task.code", label: "Task ID", kind: "text", group: "Task" },
  { path: "task.description", label: "Description", kind: "text", group: "Task" },
  { path: "task.status", label: "Status", kind: "status", group: "Task" },
  { path: "task.priority", label: "Priority", kind: "priority", group: "Task" },
  { path: "task.assignee", label: "Assignee", kind: "text", group: "Task" },
  { path: "task.labels", label: "Labels", kind: "list", group: "Task" },
  { path: "task.targetDate", label: "Due date", kind: "date", group: "Task" },
  { path: "task.startDate", label: "Start date", kind: "date", group: "Task" },
  { path: "task.daysUntilDue", label: "Days until due", kind: "number", group: "Task" },
  { path: "task.isOverdue", label: "Is overdue", kind: "boolean", group: "Task" },
  { path: "task.estimateDays", label: "Estimate (days)", kind: "number", group: "Task" },
  { path: "task.actualDays", label: "Actual (days)", kind: "number", group: "Task" },
  { path: "task.notes", label: "Notes", kind: "text", group: "Task" },
  { path: "sprint.name", label: "Sprint name", kind: "text", group: "Sprint" },
  { path: "sprint.progress", label: "Sprint progress %", kind: "number", group: "Sprint" },
  { path: "sprint.completedTasks", label: "Completed tasks", kind: "number", group: "Sprint" },
  { path: "sprint.remainingTasks", label: "Remaining tasks", kind: "number", group: "Sprint" },
  { path: "sprint.blockedTasks", label: "Blocked tasks", kind: "number", group: "Sprint" },
  { path: "sprint.daysLeft", label: "Days left in sprint", kind: "number", group: "Sprint" },
  { path: "sprint.endDate", label: "Sprint end date", kind: "date", group: "Sprint" },
  { path: "event.type", label: "Event type", kind: "text", group: "Event" },
  { path: "event.from", label: "Previous status", kind: "status", group: "Event" },
  { path: "event.to", label: "New status", kind: "status", group: "Event" },
];

export const FIELD_BY_PATH = new Map(FIELDS.map((f) => [f.path, f]));

export function fieldKind(path: string): FieldKind {
  return FIELD_BY_PATH.get(path)?.kind ?? "text";
}

/* ---------- Sprint metrics ---------- */

export const actual = (t: Task) => t.timeLogs.reduce((a, l) => a + l.days, 0);

export function sprintStats(sprint: Sprint, tasks: Task[], todayStr: string) {
  const own = tasks.filter((t) => t.sprintId === sprint.id);
  const completed = own.filter((t) => t.status === "completed").length;
  const blocked = own.filter((t) => t.status === "blocked").length;
  const overdue = own.filter((t) => t.status !== "completed" && !!t.targetDate && t.targetDate < todayStr).length;
  const byStatus: Record<string, number> = {};
  for (const t of own) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  const total = own.length;
  return {
    total,
    completed,
    remaining: total - completed,
    blocked,
    overdue,
    percent: total ? Math.round((completed / total) * 100) : 0,
    estimateDays: round(own.reduce((a, t) => a + t.estimateDays, 0)),
    actualDays: round(own.reduce((a, t) => a + actual(t), 0)),
    byStatus,
    daysLeft: daysDiff(todayStr, sprint.endDate),
  };
}

export function buildSprintReport(sprint: Sprint, tasks: Task[], now: Date): SprintReport {
  const s = sprintStats(sprint, tasks, toDateStr(now));
  const parts = Object.entries(s.byStatus).map(([k, v]) => `${STATUS_LABELS[k] ?? k} ${v}`);
  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    generatedAt: now.toISOString(),
    total: s.total,
    completed: s.completed,
    remaining: s.remaining,
    blocked: s.blocked,
    overdue: s.overdue,
    percent: s.percent,
    estimateDays: s.estimateDays,
    actualDays: s.actualDays,
    byStatus: s.byStatus,
    summary:
      `${sprint.name}: ${s.completed}/${s.total} tasks completed (${s.percent}%), ${s.remaining} remaining` +
      (s.blocked ? `, ${s.blocked} blocked` : "") +
      (s.overdue ? `, ${s.overdue} overdue` : "") +
      `. Estimated ${s.estimateDays}d, actual ${s.actualDays}d.` +
      (parts.length ? ` By status: ${parts.join(", ")}.` : ""),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/* ---------- Field resolution ---------- */

/** Reads a field from an item. Supports catalogue fields, vars.*, and report.*. */
export function resolveField(item: Item, path: string, ws: WorkspaceAdapter): unknown {
  const todayStr = toDateStr(ws.now());
  const [root, ...rest] = path.split(".");
  const key = rest.join(".");
  if (root === "vars") return getPath(item.vars, key);
  if (root === "report") return item.report ? getPath(item.report as unknown as Record<string, unknown>, key) : undefined;
  if (root === "event") return own(item.event, key);
  if (root === "now") return ws.now().toISOString();
  if (root === "today") return todayStr;
  if (root === "owner") return key === "name" || !key ? ws.ownerName() : undefined;

  if (root === "task") {
    const t = item.task;
    if (!t) return undefined;
    switch (key) {
      case "assignee":
        return t.assignee?.trim() || ws.ownerName();
      case "labels":
        return t.labels ?? [];
      case "daysUntilDue":
        return t.targetDate ? daysDiff(todayStr, t.targetDate) : null;
      case "isOverdue":
        return t.status !== "completed" && !!t.targetDate && t.targetDate < todayStr;
      case "actualDays":
        return actual(t);
      case "statusLabel":
        return STATUS_LABELS[t.status];
      case "priorityLabel":
        return PRIORITY_LABELS[t.priority];
      case "sprintName":
        return ws.getSprint(t.sprintId)?.name ?? "";
      default:
        return own(t, key);
    }
  }

  if (root === "sprint") {
    const sp = item.sprint ?? (item.task ? ws.getSprint(item.task.sprintId) : null) ?? ws.getSprint(ws.activeSprintId());
    if (!sp) return undefined;
    const needsStats = ["progress", "completedTasks", "remainingTasks", "blockedTasks", "totalTasks", "daysLeft"];
    if (needsStats.includes(key)) {
      const s = sprintStats(sp, ws.tasks(), todayStr);
      return {
        progress: s.percent,
        completedTasks: s.completed,
        remainingTasks: s.remaining,
        blockedTasks: s.blocked,
        totalTasks: s.total,
        daysLeft: s.daysLeft,
      }[key];
    }
    return own(sp, key);
  }
  return undefined;
}

/** A direct, own property only (never the prototype chain). */
function own(obj: unknown, key: string): unknown {
  if (obj == null || typeof obj !== "object" || !key || key.includes(".")) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? (obj as Record<string, unknown>)[key] : undefined;
}

function getPath(obj: Record<string, unknown> | null | undefined, path: string): unknown {
  if (!obj) return undefined;
  if (!path) return obj;
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    // Own properties only — never walk into prototypes.
    if (!Object.prototype.hasOwnProperty.call(cur, k)) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

const TEMPLATE_RE = /\{\{\s*([a-zA-Z][\w.]{0,80})\s*\}\}/g;

/** Replaces {{field.path}} with values from the item. Unknown fields become "". */
export function renderTemplate(tpl: string, item: Item, ws: WorkspaceAdapter): string {
  return String(tpl ?? "").replace(TEMPLATE_RE, (_, path: string) => display(path, resolveField(item, path, ws)));
}

function display(path: string, v: unknown): string {
  if (v == null) return "";
  if (path === "task.status" || path === "event.from" || path === "event.to") return STATUS_LABELS[String(v)] ?? String(v);
  if (path === "task.priority") return PRIORITY_LABELS[String(v)] ?? String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/* ---------- Conditions ---------- */

export const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "gt", label: "Greater than" },
  { value: "lt", label: "Less than" },
  { value: "contains", label: "Contains" },
  { value: "empty", label: "Is empty" },
  { value: "not_empty", label: "Is not empty" },
] as const;
export type Operator = (typeof OPERATORS)[number]["value"];
export const OPERATOR_VALUES = OPERATORS.map((o) => o.value) as string[];

export interface Condition {
  field: string;
  operator: Operator;
  value: string;
}
export interface ConditionGroup {
  match: "all" | "any";
  conditions: Condition[];
}
export interface ConditionSet {
  match: "all" | "any";
  groups: ConditionGroup[];
}

/** Resolves "today", "today+3", "today-1" into a date; other text is returned as-is. */
export function resolveDateToken(v: string, now: Date): string {
  const m = /^\s*today\s*(?:([+-])\s*(\d{1,4}))?\s*$/i.exec(v ?? "");
  if (!m) return (v ?? "").trim();
  const t = toDateStr(now);
  return m[1] ? addDays(t, (m[1] === "-" ? -1 : 1) * Number(m[2])) : t;
}

function isEmpty(v: unknown) {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

export function evalCondition(item: Item, c: Condition, ws: WorkspaceAdapter): boolean {
  const kind = fieldKind(c.field);
  const raw = resolveField(item, c.field, ws);
  if (c.operator === "empty") return isEmpty(raw);
  if (c.operator === "not_empty") return !isEmpty(raw);

  let target: string = String(c.value ?? "").trim();
  if (kind === "date") target = resolveDateToken(target, ws.now());

  if (c.operator === "contains") {
    if (Array.isArray(raw)) return raw.some((x) => String(x).toLowerCase() === target.toLowerCase());
    return String(raw ?? "").toLowerCase().includes(target.toLowerCase());
  }

  // Comparable values
  let a: number | string | boolean | null;
  let b: number | string | boolean | null;
  if (kind === "priority") {
    a = PRIORITY_RANK[String(raw)] ?? null;
    b = PRIORITY_RANK[target.toLowerCase()] ?? null;
  } else if (kind === "boolean") {
    a = Boolean(raw);
    b = /^(true|yes|1)$/i.test(target);
  } else if (kind === "number" || (typeof raw === "number" && target !== "" && !isNaN(Number(target)))) {
    a = raw == null || raw === "" ? null : Number(raw);
    b = target === "" ? null : Number(target);
  } else {
    a = raw == null ? null : Array.isArray(raw) ? raw.join(",") : String(raw);
    b = target;
  }

  switch (c.operator) {
    case "equals":
      return typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b;
    case "not_equals":
      return typeof a === "string" && typeof b === "string" ? a.toLowerCase() !== b.toLowerCase() : a !== b;
    case "gt":
      return a != null && b != null && a > b;
    case "lt":
      return a != null && b != null && a < b;
    default:
      return false;
  }
}

export function evalConditionSet(item: Item, set: ConditionSet, ws: WorkspaceAdapter): boolean {
  const groups = set.groups.filter((g) => g.conditions.length > 0);
  if (groups.length === 0) return true;
  const groupResult = (g: ConditionGroup) =>
    g.match === "any" ? g.conditions.some((c) => evalCondition(item, c, ws)) : g.conditions.every((c) => evalCondition(item, c, ws));
  return set.match === "any" ? groups.some(groupResult) : groups.every(groupResult);
}

export function describeCondition(c: Condition): string {
  const f = FIELD_BY_PATH.get(c.field)?.label ?? c.field;
  const op = OPERATORS.find((o) => o.value === c.operator)?.label.toLowerCase() ?? c.operator;
  if (c.operator === "empty" || c.operator === "not_empty") return `${f} ${op}`;
  const v = fieldKind(c.field) === "status" ? STATUS_LABELS[c.value] ?? c.value : fieldKind(c.field) === "priority" ? PRIORITY_LABELS[c.value] ?? c.value : c.value;
  return `${f} ${op} ${v}`;
}
