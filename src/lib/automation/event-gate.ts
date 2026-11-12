/**
 * Tiny shared state between the workspace store and the automation runtime
 * (kept separate to avoid an import cycle).
 *
 * - Bulk changes (import, reset, sample data) are not task events.
 * - Changes made by a running automation carry its id and chain depth, so a
 *   workflow doesn't re-trigger itself and chains stay bounded.
 */
let suppressed = 0;
let origin: { workflowId: string; depth: number } | null = null;

export function suppressEvents<T>(fn: () => T): T {
  suppressed++;
  try {
    return fn();
  } finally {
    suppressed--;
  }
}
export const eventsSuppressed = () => suppressed > 0;

export function withOrigin<T>(o: { workflowId: string; depth: number }, fn: () => T): T {
  const prev = origin;
  origin = o;
  try {
    return fn();
  } finally {
    origin = prev;
  }
}
export const currentOrigin = () => origin;
