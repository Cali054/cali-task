"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildEmptyWorkspace, buildSeed } from "./seed";
import { STORAGE_KEY, workspaceStorage } from "./persistence";
import type {
  Activity,
  AppData,
  Blocker,
  Settings,
  Sprint,
  Status,
  Task,
  TaskInput,
} from "./types";
import { today, uid } from "./utils";
import { STATUS_META } from "./meta";
import { TOUR_IDS } from "./tours";
import { cancelCloudSave, loadCloudWorkspace, queueCloudSave } from "./cloud-sync";
import { authAdapter } from "./auth";

interface Actions {
  addTask: (input: TaskInput) => Task;
  updateTask: (id: string, patch: Partial<TaskInput>) => void;
  deleteTask: (id: string) => void;
  setStatus: (id: string, status: Status) => void;
  blockTask: (id: string, blocker: Omit<Blocker, "updates">) => void;
  addBlockerUpdate: (id: string, text: string, resolveTo?: Status) => void;
  logTime: (id: string, days: number, date: string, note: string) => void;
  removeTimeLog: (taskId: string, logId: string) => void;

  addSprint: (s: Omit<Sprint, "id" | "createdAt">) => Sprint;
  updateSprint: (id: string, patch: Partial<Sprint>) => void;
  deleteSprint: (id: string) => void;
  setActiveSprint: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  markTourSeen: (id: string) => void;
  markAllToursSeen: () => void;
  restartTours: () => void;
  setAutoTours: (auto: boolean) => void;
  importData: (data: AppData) => void;
  /** Clears the workspace back to one empty sprint. */
  resetData: () => void;
  /** Replaces the workspace with the Sprint 2 sample tasks. */
  loadSampleData: () => void;
}

export type Store = AppData & Actions;

const MAX_ACTIVITY = 400;

function log(state: AppData, entry: Omit<Activity, "id" | "at">): Activity[] {
  return [{ id: uid(), at: new Date().toISOString(), ...entry }, ...state.activity].slice(0, MAX_ACTIVITY);
}

/** Applies a status transition with all side effects (history, dates, blocker). */
function transition(task: Task, to: Status): Task {
  if (task.status === to) return task;
  const now = new Date().toISOString();
  const d = today();
  const next: Task = {
    ...task,
    status: to,
    updatedAt: now,
    history: [...task.history, { at: now, from: task.status, to }],
  };
  if (to === "completed") next.completedDate = d;
  else if (task.status === "completed") next.completedDate = null;
  if (to === "in_progress" && !task.startDate) next.startDate = d;
  if (task.status === "blocked" && task.blocker && !task.blocker.resolvedOn) {
    next.blocker = { ...task.blocker, resolvedOn: d };
  }
  return next;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...buildEmptyWorkspace(),

      addTask: (input) => {
        const now = new Date().toISOString();
        const task: Task = {
          ...input,
          id: uid(),
          timeLogs: [],
          blocker: input.blocker ?? null,
          completedDate: input.status === "completed" ? input.completedDate ?? today() : null,
          history: [{ at: now, from: null, to: input.status }],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          tasks: [...s.tasks, task],
          activity: log(s, { taskId: task.id, kind: "created", message: `Created #${task.code} ${task.title}` }),
        }));
        return task;
      },

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            let next: Task = { ...t, ...patch, updatedAt: new Date().toISOString() } as Task;
            if (patch.status && patch.status !== t.status) {
              next = transition({ ...next, status: t.status }, patch.status);
              if (patch.completedDate !== undefined && patch.status === "completed" && patch.completedDate)
                next.completedDate = patch.completedDate;
            }
            return next;
          }),
          activity: log(s, {
            taskId: id,
            kind: "updated",
            message: `Updated #${s.tasks.find((t) => t.id === id)?.code ?? ""}`,
          }),
        })),

      deleteTask: (id) =>
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          return {
            tasks: s.tasks
              .filter((x) => x.id !== id)
              .map((x) =>
                x.dependencies.includes(id) ? { ...x, dependencies: x.dependencies.filter((d) => d !== id) } : x,
              ),
            activity: log(s, { taskId: null, kind: "deleted", message: `Deleted #${t?.code} ${t?.title ?? ""}` }),
          };
        }),

      setStatus: (id, status) =>
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t || t.status === status) return {};
          return {
            tasks: s.tasks.map((x) => (x.id === id ? transition(x, status) : x)),
            activity: log(s, {
              taskId: id,
              kind: "status",
              message: `#${t.code} moved ${STATUS_META[t.status].label} → ${STATUS_META[status].label}`,
            }),
          };
        }),

      blockTask: (id, blocker) =>
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return {};
          const keepUpdates = t.blocker && !t.blocker.resolvedOn ? t.blocker.updates : [];
          const moved = transition(t, "blocked");
          return {
            tasks: s.tasks.map((x) =>
              x.id === id ? { ...moved, blocker: { ...blocker, updates: keepUpdates } } : x,
            ),
            activity: log(s, { taskId: id, kind: "blocker", message: `#${t.code} blocked: ${blocker.reason}` }),
          };
        }),

      addBlockerUpdate: (id, text, resolveTo) =>
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t || !t.blocker) return {};
          const update = { id: uid(), at: new Date().toISOString(), text };
          let next: Task = {
            ...t,
            blocker: { ...t.blocker, updates: [...t.blocker.updates, update] },
            updatedAt: update.at,
          };
          if (resolveTo) next = transition(next, resolveTo);
          return {
            tasks: s.tasks.map((x) => (x.id === id ? next : x)),
            activity: log(s, {
              taskId: id,
              kind: "blocker",
              message: resolveTo
                ? `#${t.code} unblocked → ${STATUS_META[resolveTo].label}`
                : `#${t.code} blocker update: ${text}`,
            }),
          };
        }),

      logTime: (id, days, date, note) =>
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return {};
          return {
            tasks: s.tasks.map((x) =>
              x.id === id
                ? {
                    ...x,
                    startDate: x.startDate ?? date,
                    timeLogs: [...x.timeLogs, { id: uid(), date, days, note }],
                    updatedAt: new Date().toISOString(),
                  }
                : x,
            ),
            activity: log(s, { taskId: id, kind: "time", message: `Logged ${days}d on #${t.code}` }),
          };
        }),

      removeTimeLog: (taskId, logId) =>
        set((s) => ({
          tasks: s.tasks.map((x) =>
            x.id === taskId ? { ...x, timeLogs: x.timeLogs.filter((l) => l.id !== logId) } : x,
          ),
        })),

      addSprint: (input) => {
        const sprint: Sprint = { ...input, id: uid(), createdAt: new Date().toISOString() };
        set((s) => ({
          sprints: [...s.sprints, sprint],
          activeSprintId: sprint.id,
          activity: log(s, { taskId: null, kind: "sprint", message: `Created ${sprint.name}` }),
        }));
        return sprint;
      },

      updateSprint: (id, patch) =>
        set((s) => ({ sprints: s.sprints.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      deleteSprint: (id) => {
        const s = get();
        if (s.sprints.length <= 1) return;
        const remaining = s.sprints.filter((x) => x.id !== id);
        set({
          sprints: remaining,
          tasks: s.tasks.filter((t) => t.sprintId !== id),
          activeSprintId: s.activeSprintId === id ? remaining[remaining.length - 1].id : s.activeSprintId,
          activity: log(s, {
            taskId: null,
            kind: "sprint",
            message: `Deleted ${s.sprints.find((x) => x.id === id)?.name}`,
          }),
        });
      },

      setActiveSprint: (id) => set({ activeSprintId: id }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      markTourSeen: (id) =>
        set((s) => {
          const tours = s.settings.tours ?? { auto: false, seen: [] };
          if (tours.seen.includes(id)) return {};
          return { settings: { ...s.settings, tours: { ...tours, seen: [...tours.seen, id] } } };
        }),
      markAllToursSeen: () =>
        set((s) => ({ settings: { ...s.settings, tours: { auto: s.settings.tours?.auto ?? false, seen: [...TOUR_IDS] } } })),
      restartTours: () => set((s) => ({ settings: { ...s.settings, tours: { auto: true, seen: [] } } })),
      setAutoTours: (auto) =>
        set((s) => ({ settings: { ...s.settings, tours: { seen: s.settings.tours?.seen ?? [], auto } } })),

      importData: (data) =>
        set({
          tasks: data.tasks,
          sprints: data.sprints,
          activity: data.activity ?? [],
          activeSprintId: data.activeSprintId,
          settings: data.settings,
        }),

      resetData: () => set((s) => ({ ...buildEmptyWorkspace(s.settings.userName), settings: s.settings })),

      loadSampleData: () => set((s) => ({ ...buildSeed(), settings: s.settings })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: workspaceStorage,
      skipHydration: true,
      partialize: (s) => ({
        version: s.version,
        tasks: s.tasks,
        sprints: s.sprints,
        activity: s.activity,
        activeSprintId: s.activeSprintId,
        settings: s.settings,
      }),
    },
  ),
);

/* ---------- Selectors ---------- */

export const actualDays = (t: Task) => t.timeLogs.reduce((a, l) => a + l.days, 0);

export function useActiveSprint() {
  return useStore((s) => s.sprints.find((x) => x.id === s.activeSprintId) ?? s.sprints[0]);
}

export function useSprintTasks() {
  const tasks = useStore((s) => s.tasks);
  const sprintId = useStore((s) => s.activeSprintId);
  return tasks.filter((t) => t.sprintId === sprintId);
}

/** The saved part of the store (same shape as a backup file). */
function snapshot(s: Store): AppData {
  return {
    version: s.version,
    tasks: s.tasks,
    sprints: s.sprints,
    activity: s.activity,
    activeSprintId: s.activeSprintId,
    settings: s.settings,
  };
}
const DATA_KEYS = ["tasks", "sprints", "activity", "activeSprintId", "settings"] as const;

let stopSync: (() => void) | null = null;

/** Stops pushing changes to the cloud (sign-out, account switch). */
export function unbindWorkspaceSync() {
  stopSync?.();
  stopSync = null;
  cancelCloudSave();
}

/**
 * Points the store at the signed-in user's workspace. Each account gets its
 * own storage key; a workspace saved before accounts existed is handed to the
 * first email/password account that signs in. New accounts start empty.
 *
 * Google accounts (`cloud`) also load from and save to Supabase. The cloud
 * copy wins over this browser's copy. On a first Google sign-in, a local
 * email/password account with the same email on this device is carried over
 * instead of starting from scratch, so the person keeps one workspace.
 */
export async function bindWorkspace(
  userId: string,
  displayName: string,
  opts: { cloud?: boolean; email?: string } = {},
) {
  unbindWorkspaceSync();
  const name = `${STORAGE_KEY}:${userId}`;
  let existing: string | null = null;
  let uploadFirst = false;
  try {
    existing = localStorage.getItem(name);
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (!opts.cloud && !existing && legacy) {
      localStorage.setItem(name, legacy);
      localStorage.removeItem(STORAGE_KEY);
      existing = legacy;
    }
  } catch {}

  if (opts.cloud) {
    try {
      const remote = await loadCloudWorkspace(userId);
      if (remote) {
        existing = JSON.stringify({ state: remote, version: remote.version ?? 1 });
      } else {
        if (!existing && opts.email) existing = authAdapter.localWorkspaceForEmail(opts.email);
        uploadFirst = true;
      }
      if (existing) localStorage.setItem(name, existing);
    } catch (e) {
      // Offline or schema missing: carry on with this browser's copy.
      console.warn("[sync] Could not load cloud workspace:", e instanceof Error ? e.message : e);
    }
  }

  useStore.persist.setOptions({ name });
  if (existing) {
    await useStore.persist.rehydrate();
  } else {
    useStore.setState(buildEmptyWorkspace(displayName));
  }

  if (opts.cloud) {
    if (uploadFirst) queueCloudSave(userId, snapshot(useStore.getState()));
    stopSync = useStore.subscribe((s, prev) => {
      if (DATA_KEYS.some((k) => s[k] !== prev[k])) queueCloudSave(userId, snapshot(s));
    });
  }
}
