/**
 * A workspace adapter over a private copy of the data. Used for dry-run
 * tests in the builder (nothing real changes) and for engine tests.
 */
import type { AppData, Sprint, Status, Task } from "../types";
import type { AiRequest, AppNotification, NewTaskInput, WorkspaceAdapter } from "./types";
import { NodeError } from "./types";
import { toDateStr } from "../utils";

export function nextTaskCode(tasks: Task[]): string {
  const max = tasks.reduce((m, t) => (/^\d{1,9}$/.test(t.code) ? Math.max(m, Number(t.code)) : m), 0);
  return String(max + 1 || 1);
}

export function newTask(input: NewTaskInput, tasks: Task[], now: Date, id: string): Task {
  const iso = now.toISOString();
  const status = input.status ?? "todo";
  return {
    id,
    code: nextTaskCode(tasks),
    title: input.title,
    description: input.description ?? "",
    sprintId: input.sprintId,
    estimateDays: input.estimateDays ?? 1,
    timeLogs: [],
    status,
    priority: input.priority ?? "medium",
    startDate: status === "in_progress" ? toDateStr(now) : null,
    targetDate: input.targetDate ?? null,
    completedDate: status === "completed" ? toDateStr(now) : null,
    notes: "",
    dependencies: [],
    blocker: null,
    history: [{ at: iso, from: null, to: status }],
    assignee: input.assignee || undefined,
    createdAt: iso,
    updatedAt: iso,
  };
}

export interface MemoryAdapter extends WorkspaceAdapter {
  data: AppData;
  notifications: AppNotification[];
  emails: { subject: string; body: string }[];
  changes: string[];
}

export function createMemoryAdapter(
  source: AppData,
  opts: {
    owner: string;
    ownerId: string;
    now?: () => Date;
    dryRun?: boolean;
    email?: (n: { subject: string; body: string }) => Promise<{ id: string; to: string }>;
    /** AI text doesn't change the workspace, so dry runs may call the real provider. */
    ai?: (p: AiRequest) => Promise<string>;
  },
): MemoryAdapter {
  const data: AppData = structuredClone(source);
  let seq = 0;
  const id = () => `mem-${Date.now().toString(36)}-${++seq}`;
  const now = opts.now ?? (() => new Date());
  const notifications: AppNotification[] = [];
  const emails: { subject: string; body: string }[] = [];
  const changes: string[] = [];

  const mustTask = (tid: string) => {
    const t = data.tasks.find((x) => x.id === tid);
    if (!t) throw new NodeError("Task not found.");
    return t;
  };
  const put = (t: Task) => {
    data.tasks = data.tasks.map((x) => (x.id === t.id ? t : x));
    return t;
  };

  return {
    dryRun: opts.dryRun ?? true,
    data,
    notifications,
    emails,
    changes,
    now,
    tasks: () => data.tasks,
    sprints: () => data.sprints,
    activeSprintId: () => data.activeSprintId,
    getTask: (tid) => data.tasks.find((t) => t.id === tid) ?? null,
    getSprint: (sid) => data.sprints.find((s) => s.id === sid) ?? null,
    ownerName: () => opts.owner,
    ownerId: () => opts.ownerId,

    createTask(input) {
      const t = newTask(input, data.tasks, now(), id());
      data.tasks = [...data.tasks, t];
      changes.push(`Create task #${t.code} "${t.title}"`);
      return t;
    },
    updateTask(tid, patch) {
      const t = mustTask(tid);
      changes.push(`Update #${t.code}: ${Object.keys(patch).join(", ")}`);
      return put({ ...t, ...patch, updatedAt: now().toISOString() });
    },
    setStatus(tid, status: Status, reason) {
      const t = mustTask(tid);
      changes.push(`Move #${t.code} → ${status}`);
      const at = now().toISOString();
      return put({
        ...t,
        status,
        updatedAt: at,
        completedDate: status === "completed" ? toDateStr(now()) : null,
        history: [...t.history, { at, from: t.status, to: status }],
        blocker:
          status === "blocked"
            ? { reason: reason || "Blocked by automation", blockedOn: toDateStr(now()), waitingOn: "", requiredAction: "", updates: [] }
            : t.blocker,
      });
    },
    addComment(tid, text, author) {
      const t = mustTask(tid);
      changes.push(`Comment on #${t.code}`);
      return put({ ...t, comments: [...(t.comments ?? []), { id: id(), at: now().toISOString(), author, text }] });
    },
    createSprint(input, makeActive) {
      const s: Sprint = { ...input, id: id(), createdAt: now().toISOString() };
      data.sprints = [...data.sprints, s];
      if (makeActive) data.activeSprintId = s.id;
      changes.push(`Create sprint "${s.name}"`);
      return s;
    },
    updateSprint(sid, patch) {
      const s = data.sprints.find((x) => x.id === sid);
      if (!s) throw new NodeError("Sprint not found.");
      const next = { ...s, ...patch };
      data.sprints = data.sprints.map((x) => (x.id === sid ? next : x));
      changes.push(`Update sprint "${s.name}"`);
      return next;
    },
    notify(n) {
      const rec: AppNotification = {
        id: id(),
        workflowId: null,
        executionId: null,
        recipientId: opts.ownerId,
        type: "in_app",
        title: n.title,
        message: n.message,
        taskId: n.taskId,
        createdAt: now().toISOString(),
        readAt: null,
      };
      notifications.push(rec);
      changes.push(`Notify: ${n.title}`);
      return rec;
    },
    async sendEmail(n) {
      emails.push(n);
      changes.push(`Email: ${n.subject}`);
      if (opts.email) return opts.email(n);
      return { id: id(), to: "(test — not sent)" };
    },
    async generateText(p) {
      if (opts.ai) return opts.ai(p);
      return `(AI text from ${p.provider}/${p.model})`;
    },
  };
}
