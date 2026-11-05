import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DateStr } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ---------- Calendar-day helpers (local time, "YYYY-MM-DD") ---------- */

export function toDateStr(d: Date): DateStr {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): DateStr {
  return toDateStr(new Date());
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function isWeekend(s: DateStr) {
  const day = parseDate(s).getDay();
  return day === 0 || day === 6;
}

/** Shift forward to the next working day if `s` falls on a weekend. */
export function nextWorkingDay(s: DateStr): DateStr {
  let d = s;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}

/** Add n working days (n may be fractional; rounded up, min 0). */
export function addWorkingDays(s: DateStr, n: number): DateStr {
  let d = nextWorkingDay(s);
  let left = Math.max(0, Math.ceil(n) - 1);
  while (left > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d)) left--;
  }
  return d;
}

/** Working days in the inclusive range [a, b]. */
export function workingDaysBetween(a: DateStr, b: DateStr): DateStr[] {
  const out: DateStr[] = [];
  if (b < a) return out;
  let d = a;
  while (d <= b) {
    if (!isWeekend(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** Calendar days from a to b (b - a). */
export function daysDiff(a: DateStr, b: DateStr) {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

export function mondayOf(s: DateStr): DateStr {
  const d = parseDate(s);
  const day = d.getDay();
  if (day === 6) return addDays(s, 2);
  if (day === 0) return addDays(s, 1);
  return addDays(s, 1 - day);
}

export function fmtDate(s: DateStr | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!s) return "—";
  return parseDate(s).toLocaleDateString(undefined, opts ?? { month: "short", day: "numeric" });
}

export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDays(n: number) {
  const v = Math.round(n * 100) / 100;
  return `${v} ${v === 1 ? "day" : "days"}`;
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
