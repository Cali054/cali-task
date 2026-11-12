"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppNotification, AuditEntry, Execution, Workflow, WorkflowSchedule } from "./types";

/**
 * The signed-in user's automations, kept in this browser (one key per
 * account). For Google accounts the same data is mirrored to Supabase
 * (see ./cloud.ts) and the cloud copy wins on sign-in.
 */
export type CloudState = "off" | "loading" | "ok" | "missing" | "error";

interface State {
  workflows: Workflow[];
  executions: Execution[];
  notifications: AppNotification[];
  schedules: WorkflowSchedule[];
  audit: AuditEntry[];
  /** Event ids each workflow has already handled (dedupe). */
  processed: Record<string, string[]>;
  cloud: CloudState;
  /** Whether this tab runs schedules and watch triggers. */
  leader: boolean;
  /** Account whose automations are loaded (null until ready). */
  boundTo: string | null;
}

interface Actions {
  upsertWorkflow: (w: Workflow) => void;
  removeWorkflow: (id: string) => void;
  upsertExecution: (e: Execution) => void;
  removeExecutionsFor: (workflowId: string) => void;
  addNotification: (n: AppNotification) => void;
  markRead: (ids: string[]) => void;
  removeNotification: (id: string) => void;
  upsertSchedule: (s: WorkflowSchedule) => void;
  removeScheduleFor: (workflowId: string) => void;
  addAudit: (a: AuditEntry) => void;
  markProcessed: (workflowId: string, eventId: string) => void;
  replaceAll: (p: Partial<Pick<State, "workflows" | "executions" | "notifications" | "schedules" | "audit">>) => void;
  setCloud: (c: CloudState) => void;
  setLeader: (l: boolean) => void;
}

export const MAX_EXECUTIONS = 200;
const MAX_NOTIFICATIONS = 200;
const MAX_AUDIT = 300;
const MAX_PROCESSED = 500;

const EMPTY = { workflows: [], executions: [], notifications: [], schedules: [], audit: [], processed: {} };

export const AUTOMATION_KEY = "cali-task:automation";

export const useAutomation = create<State & Actions>()(
  persist(
    (set) => ({
      ...EMPTY,
      cloud: "off",
      leader: false,
      boundTo: null,

      upsertWorkflow: (w) =>
        set((s) => ({
          workflows: s.workflows.some((x) => x.id === w.id) ? s.workflows.map((x) => (x.id === w.id ? w : x)) : [w, ...s.workflows],
        })),
      removeWorkflow: (id) =>
        set((s) => {
          const processed = { ...s.processed };
          delete processed[id];
          return {
            workflows: s.workflows.filter((w) => w.id !== id),
            schedules: s.schedules.filter((x) => x.workflowId !== id),
            processed,
          };
        }),
      upsertExecution: (e) =>
        set((s) => {
          const exists = s.executions.some((x) => x.id === e.id);
          const list = exists ? s.executions.map((x) => (x.id === e.id ? e : x)) : [e, ...s.executions];
          // Keep the newest runs, but never drop one that's still waiting to resume.
          const keep = list.slice(0, MAX_EXECUTIONS);
          const waiting = list.slice(MAX_EXECUTIONS).filter((x) => x.status === "waiting" || x.status === "running");
          return { executions: [...keep, ...waiting] };
        }),
      removeExecutionsFor: (workflowId) => set((s) => ({ executions: s.executions.filter((e) => e.workflowId !== workflowId) })),
      addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, MAX_NOTIFICATIONS) })),
      markRead: (ids) =>
        set((s) => {
          const at = new Date().toISOString();
          return { notifications: s.notifications.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: at } : n)) };
        }),
      removeNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      upsertSchedule: (sc) =>
        set((s) => ({
          schedules: s.schedules.some((x) => x.workflowId === sc.workflowId)
            ? s.schedules.map((x) => (x.workflowId === sc.workflowId ? sc : x))
            : [...s.schedules, sc],
        })),
      removeScheduleFor: (workflowId) => set((s) => ({ schedules: s.schedules.filter((x) => x.workflowId !== workflowId) })),
      addAudit: (a) => set((s) => ({ audit: [a, ...s.audit].slice(0, MAX_AUDIT) })),
      markProcessed: (workflowId, eventId) =>
        set((s) => ({
          processed: { ...s.processed, [workflowId]: [eventId, ...(s.processed[workflowId] ?? []).filter((x) => x !== eventId)].slice(0, MAX_PROCESSED) },
        })),
      replaceAll: (p) => set(p),
      setCloud: (cloud) => set({ cloud }),
      setLeader: (leader) => set({ leader }),
    }),
    {
      name: AUTOMATION_KEY,
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => ({
        getItem: (n) => {
          try {
            return localStorage.getItem(n);
          } catch {
            return null;
          }
        },
        setItem: (n, v) => {
          try {
            localStorage.setItem(n, v);
          } catch {
            /* storage full — keep working in memory */
          }
        },
        removeItem: (n) => {
          try {
            localStorage.removeItem(n);
          } catch {}
        },
      })),
      partialize: (s) => ({
        workflows: s.workflows,
        executions: s.executions,
        notifications: s.notifications,
        schedules: s.schedules,
        audit: s.audit,
        processed: s.processed,
      }),
    },
  ),
);

/** Points the store at this account's saved automations. */
export async function bindAutomationStore(userId: string) {
  const name = `${AUTOMATION_KEY}:${userId}`;
  // Every setState also saves, so mark "not ready" while still pointing at the
  // previous account, and never write before this account's data is loaded.
  if (useAutomation.getState().boundTo !== null) useAutomation.setState({ boundTo: null });
  useAutomation.persist.setOptions({ name });
  let has = false;
  try {
    has = localStorage.getItem(name) != null;
  } catch {}
  if (has) await useAutomation.persist.rehydrate();
  else useAutomation.setState({ ...EMPTY });
  useAutomation.setState({ boundTo: userId });
  return name;
}
