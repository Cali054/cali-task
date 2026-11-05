"use client";

import { useCallback } from "react";
import { useStore } from "./store";
import { useUI } from "./ui-store";
import type { Status } from "./types";

/**
 * Single entry point for status changes from the UI. Moving a task to
 * Blocked asks for blocker details first; everything else applies directly.
 */
export function useChangeStatus() {
  const setStatus = useStore((s) => s.setStatus);
  const openBlocker = useUI((s) => s.openBlocker);
  return useCallback(
    (taskId: string, status: Status) => {
      if (status === "blocked") openBlocker(taskId);
      else setStatus(taskId, status);
    },
    [setStatus, openBlocker],
  );
}
