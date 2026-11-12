import type { ScheduleConfig } from "./types";

export const MIN_INTERVAL_MINUTES = 15;

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  frequency: "daily",
  time: "09:00",
  weekday: 1,
  dayOfMonth: 1,
  intervalMinutes: 60,
};

export function normalizeSchedule(c: Partial<ScheduleConfig> | undefined): ScheduleConfig {
  const v = { ...DEFAULT_SCHEDULE, ...(c ?? {}) };
  const freq = ["daily", "weekly", "monthly", "interval"].includes(v.frequency) ? v.frequency : "daily";
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v.time)) ? String(v.time) : "09:00";
  return {
    frequency: freq,
    time,
    weekday: clampInt(v.weekday, 0, 6, 1),
    dayOfMonth: clampInt(v.dayOfMonth, 1, 28, 1),
    intervalMinutes: clampInt(v.intervalMinutes, MIN_INTERVAL_MINUTES, 60 * 24 * 7, 60),
  };
}

function clampInt(v: unknown, min: number, max: number, dflt: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

/** Next run strictly after `from`, in the browser's local time. */
export function nextRun(config: Partial<ScheduleConfig>, from: Date): Date {
  const c = normalizeSchedule(config);
  if (c.frequency === "interval") return new Date(from.getTime() + c.intervalMinutes * 60_000);
  const [h, m] = c.time.split(":").map(Number);
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(h, m);
  if (c.frequency === "daily") {
    if (d <= from) d.setDate(d.getDate() + 1);
    return d;
  }
  if (c.frequency === "weekly") {
    const add = (c.weekday - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + add);
    if (d <= from) d.setDate(d.getDate() + 7);
    return d;
  }
  // monthly (day 1–28 so every month has it)
  d.setDate(c.dayOfMonth);
  if (d <= from) d.setMonth(d.getMonth() + 1, c.dayOfMonth);
  return d;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function describeSchedule(config: Partial<ScheduleConfig>): string {
  const c = normalizeSchedule(config);
  switch (c.frequency) {
    case "interval":
      return c.intervalMinutes % 60 === 0 ? `Every ${c.intervalMinutes / 60}h` : `Every ${c.intervalMinutes} min`;
    case "weekly":
      return `Every ${WEEKDAYS[c.weekday]} at ${c.time}`;
    case "monthly":
      return `Monthly on day ${c.dayOfMonth} at ${c.time}`;
    default:
      return `Every day at ${c.time}`;
  }
}
