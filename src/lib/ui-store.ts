"use client";

import { create } from "zustand";
import type { Status } from "./types";

/** Transient UI state: which dialogs are open, global search text. */
interface UIState {
  taskForm: { open: boolean; editId: string | null; defaultStatus?: Status };
  detailId: string | null;
  blockerFor: string | null;
  progressFor: { open: boolean; taskId: string | null };
  sprintForm: { open: boolean; editId: string | null };
  search: string;
  mobileNav: boolean;
  /** Bumped on every dialog open so dialog forms remount with fresh state. */
  session: number;
  intro: "pending" | "show" | "done";

  openNewTask: (defaultStatus?: Status) => void;
  openEditTask: (id: string) => void;
  closeTaskForm: () => void;
  openDetail: (id: string | null) => void;
  openBlocker: (taskId: string | null) => void;
  openProgress: (taskId?: string | null) => void;
  closeProgress: () => void;
  openSprintForm: (editId?: string | null) => void;
  closeSprintForm: () => void;
  setSearch: (q: string) => void;
  setMobileNav: (v: boolean) => void;
  setIntro: (v: "show" | "done") => void;
}

export const useUI = create<UIState>()((set) => ({
  taskForm: { open: false, editId: null },
  detailId: null,
  blockerFor: null,
  progressFor: { open: false, taskId: null },
  sprintForm: { open: false, editId: null },
  search: "",
  mobileNav: false,
  session: 0,
  intro: "pending",

  openNewTask: (defaultStatus) =>
    set((s) => ({ taskForm: { open: true, editId: null, defaultStatus }, session: s.session + 1 })),
  openEditTask: (id) => set((s) => ({ taskForm: { open: true, editId: id }, detailId: null, session: s.session + 1 })),
  closeTaskForm: () => set((s) => ({ taskForm: { ...s.taskForm, open: false } })),
  openDetail: (id) => set({ detailId: id }),
  // "" opens the dialog with a task picker
  openBlocker: (taskId) =>
    set((s) => (taskId === null ? { blockerFor: null } : { blockerFor: taskId, detailId: null, session: s.session + 1 })),
  openProgress: (taskId = null) =>
    set((s) => ({ progressFor: { open: true, taskId }, detailId: null, session: s.session + 1 })),
  closeProgress: () => set((s) => ({ progressFor: { ...s.progressFor, open: false } })),
  openSprintForm: (editId = null) => set((s) => ({ sprintForm: { open: true, editId }, session: s.session + 1 })),
  closeSprintForm: () => set((s) => ({ sprintForm: { ...s.sprintForm, open: false } })),
  setSearch: (q) => set({ search: q }),
  setMobileNav: (v) => set({ mobileNav: v }),
  setIntro: (v) => set({ intro: v }),
}));
