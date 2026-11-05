import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * Persistence adapter for the workspace.
 *
 * The prototype stores everything in the browser's localStorage. To move to a
 * real database, implement `StateStorage` (getItem / setItem / removeItem)
 * against your API — e.g. GET/PUT /api/workspace — and return it here. The
 * store, pages and components don't need to change.
 */
const localAdapter: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* storage full or unavailable — keep working in memory */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {}
  },
};

export const STORAGE_KEY = "cali-task:workspace";
export const workspaceStorage = createJSONStorage(() => localAdapter);
