import { PRIORITIES, STATUSES, type Activity, type AppData, type Blocker, type Sprint, type Task } from "./types";

/**
 * Validates an imported backup and rebuilds it field by field, so a
 * hand-edited or malicious file can't inject unexpected shapes into the app.
 */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

class BackupError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 2000, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, 1000) : fallback);
const date = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

function blocker(v: unknown): Blocker | null {
  if (!isObj(v)) return null;
  return {
    reason: str(v.reason),
    blockedOn: date(v.blockedOn) ?? new Date().toISOString().slice(0, 10),
    waitingOn: str(v.waitingOn, 200),
    requiredAction: str(v.requiredAction, 500),
    resolvedOn: date(v.resolvedOn) ?? undefined,
    updates: Array.isArray(v.updates)
      ? v.updates.filter(isObj).slice(0, 500).map((u) => ({ id: str(u.id, 64) || crypto.randomUUID(), at: iso(u.at), text: str(u.text) }))
      : [],
  };
}

function task(v: unknown, sprintIds: Set<string>): Task {
  if (!isObj(v) || typeof v.id !== "string" || typeof v.code !== "string")
    throw new BackupError("A task in the file is missing its ID.");
  if (!sprintIds.has(v.sprintId as string)) throw new BackupError(`Task #${v.code} points to a sprint that isn't in the file.`);
  return {
    id: str(v.id, 64),
    code: str(v.code, 40),
    title: str(v.title, 300) || "(untitled)",
    description: str(v.description, 5000),
    sprintId: v.sprintId as string,
    estimateDays: num(v.estimateDays),
    timeLogs: Array.isArray(v.timeLogs)
      ? v.timeLogs
          .filter(isObj)
          .slice(0, 2000)
          .map((l) => ({ id: str(l.id, 64) || crypto.randomUUID(), date: date(l.date) ?? new Date().toISOString().slice(0, 10), days: num(l.days), note: str(l.note, 500) }))
      : [],
    status: oneOf(v.status, STATUSES, "todo"),
    priority: oneOf(v.priority, PRIORITIES, "medium"),
    startDate: date(v.startDate),
    targetDate: date(v.targetDate),
    completedDate: date(v.completedDate),
    notes: str(v.notes, 5000),
    dependencies: Array.isArray(v.dependencies) ? v.dependencies.filter((d): d is string => typeof d === "string").slice(0, 100) : [],
    blocker: blocker(v.blocker),
    history: Array.isArray(v.history)
      ? v.history
          .filter(isObj)
          .slice(0, 1000)
          .map((h) => ({ at: iso(h.at), from: h.from === null ? null : oneOf(h.from, STATUSES, "todo"), to: oneOf(h.to, STATUSES, "todo") }))
      : [],
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
  };
}

function sprint(v: unknown): Sprint {
  if (!isObj(v) || typeof v.id !== "string") throw new BackupError("A sprint in the file is missing its ID.");
  const startDate = date(v.startDate);
  const endDate = date(v.endDate);
  if (!startDate || !endDate || endDate < startDate) throw new BackupError(`Sprint "${str(v.name, 80)}" has invalid dates.`);
  const tMin = typeof v.targetDaysMin === "number" ? num(v.targetDaysMin) : null;
  const tMax = typeof v.targetDaysMax === "number" ? num(v.targetDaysMax) : null;
  return {
    id: str(v.id, 64),
    name: str(v.name, 80) || "Sprint",
    goal: str(v.goal, 500),
    startDate,
    endDate,
    targetLabel: str(v.targetLabel, 80),
    targetDaysMin: tMin,
    targetDaysMax: tMax,
    createdAt: iso(v.createdAt),
  };
}

export function parseBackup(raw: unknown, currentUserName: string): AppData {
  try {
    if (!isObj(raw) || !Array.isArray(raw.sprints) || !Array.isArray(raw.tasks))
      throw new BackupError("This file doesn't look like a Cali's Task backup.");
    if (raw.sprints.length === 0) throw new BackupError("The backup has no sprints.");
    if (raw.tasks.length > 5000 || raw.sprints.length > 500) throw new BackupError("The backup is too large.");
    const sprints = raw.sprints.map(sprint);
    const sprintIds = new Set(sprints.map((s) => s.id));
    const tasks = raw.tasks.map((t) => task(t, sprintIds));
    const taskIds = new Set(tasks.map((t) => t.id));
    for (const t of tasks) t.dependencies = t.dependencies.filter((d) => taskIds.has(d) && d !== t.id);
    const activity: Activity[] = Array.isArray(raw.activity)
      ? raw.activity
          .filter(isObj)
          .slice(0, 400)
          .map((a) => ({
            id: str(a.id, 64) || crypto.randomUUID(),
            at: iso(a.at),
            taskId: typeof a.taskId === "string" && taskIds.has(a.taskId) ? a.taskId : null,
            kind: oneOf(a.kind, ["created", "status", "updated", "deleted", "time", "blocker", "sprint"] as const, "updated"),
            message: str(a.message, 300),
          }))
      : [];
    const settings = isObj(raw.settings) ? raw.settings : {};
    return {
      version: 1,
      sprints,
      tasks,
      activity,
      activeSprintId: sprintIds.has(raw.activeSprintId as string) ? (raw.activeSprintId as string) : sprints[0].id,
      settings: {
        userName: str(settings.userName, 80) || currentUserName,
        showIntro: true,
        tours: isObj(settings.tours)
          ? {
              auto: settings.tours.auto === true,
              seen: Array.isArray(settings.tours.seen)
                ? settings.tours.seen.filter((x): x is string => typeof x === "string").slice(0, 20)
                : [],
            }
          : undefined,
      },
    };
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError("This file couldn't be read as a Cali's Task backup.");
  }
}
