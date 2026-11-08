"use client";

import type { AppData } from "./types";
import { getSupabase } from "./supabase";

/**
 * Cloud copy of a Google user's workspace (public.workspaces, one row per
 * user, protected by Row Level Security). The browser keeps a local copy
 * for instant loads; every change is pushed here a moment later, and the
 * cloud copy wins when the user signs in on another device.
 */

export type SyncState = "idle" | "saving" | "saved" | "error";

const listeners = new Set<(s: SyncState) => void>();
let state: SyncState = "idle";
function setState(s: SyncState) {
  state = s;
  listeners.forEach((l) => l(s));
}
export function getSyncState() {
  return state;
}
export function onSyncState(fn: (s: SyncState) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export async function loadCloudWorkspace(userId: string): Promise<AppData | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("workspaces").select("data").eq("user_id", userId).maybeSingle<{ data: AppData }>();
  if (error) throw error;
  return data?.data ?? null;
}

async function saveCloudWorkspace(userId: string, data: AppData) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("workspaces").upsert({ user_id: userId, data }, { onConflict: "user_id" });
  if (error) throw error;
}

const DEBOUNCE_MS = 1200;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: { userId: string; data: AppData } | null = null;

async function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  const job = pending;
  pending = null;
  if (!job) return;
  setState("saving");
  try {
    await saveCloudWorkspace(job.userId, job.data);
    setState(pending ? "saving" : "saved");
  } catch (e) {
    console.warn("[sync] Could not save workspace:", e instanceof Error ? e.message : e);
    // Keep the latest data queued and try again shortly.
    pending ??= job;
    setState("error");
    timer = setTimeout(flush, 10_000);
  }
}

/** Queues a save; rapid edits are combined into one request. */
export function queueCloudSave(userId: string, data: AppData) {
  pending = { userId, data };
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

/** Sends any queued change now (e.g. when the tab is being hidden). */
export function flushCloudSave() {
  return flush();
}

/** Drops queued work (on sign-out or account switch). */
export function cancelCloudSave() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  setState("idle");
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
