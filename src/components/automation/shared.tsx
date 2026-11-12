"use client";

import {
  AlarmClock,
  AlertTriangle,
  ArrowRightCircle,
  ArrowRightLeft,
  BellRing,
  Calculator,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CircleDot,
  CircleSlash,
  Clock3,
  Combine,
  FileBarChart,
  FilePen,
  Filter,
  Flag,
  FlagTriangleRight,
  Gauge,
  GitMerge,
  Hourglass,
  ListFilter,
  Sparkles,
  Loader2,
  Mail,
  MessageSquarePlus,
  MousePointerClick,
  Pencil,
  PlayCircle,
  PlusCircle,
  Signal,
  SignalHigh,
  Split,
  SquarePlus,
  TrendingUp,
  Trophy,
  Type,
  UserCheck,
  UserPlus,
  UserRoundPlus,
  Workflow as WorkflowIcon,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { ExecStatus, NodeCategory, NodeExecStatus } from "@/lib/automation/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "plus-circle": PlusCircle,
  pencil: Pencil,
  "arrow-right-left": ArrowRightLeft,
  "user-plus": UserPlus,
  "check-circle": CheckCircle2,
  "alarm-clock": AlarmClock,
  "alert-triangle": AlertTriangle,
  flag: Flag,
  "play-circle": PlayCircle,
  trophy: Trophy,
  "calendar-clock": CalendarClock,
  "mouse-pointer-click": MousePointerClick,
  split: Split,
  "circle-dot": CircleDot,
  signal: Signal,
  "user-check": UserCheck,
  "calendar-range": CalendarRange,
  gauge: Gauge,
  "list-filter": ListFilter,
  "git-merge": GitMerge,
  "square-plus": SquarePlus,
  "file-pen": FilePen,
  "arrow-right-circle": ArrowRightCircle,
  "user-round-plus": UserRoundPlus,
  "signal-high": SignalHigh,
  "calendar-cog": CalendarCog,
  "message-square-plus": MessageSquarePlus,
  "bell-ring": BellRing,
  mail: Mail,
  "file-bar-chart": FileBarChart,
  "flag-triangle-right": FlagTriangleRight,
  "trending-up": TrendingUp,
  hourglass: Hourglass,
  "calendar-days": CalendarDays,
  type: Type,
  combine: Combine,
  calculator: Calculator,
  filter: Filter,
  sparkles: Sparkles,
};

export function NodeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? WorkflowIcon;
  return <Icon className={className} aria-hidden />;
}

/** Category colours: champagne triggers, steel conditions, sage actions, bronze utilities. */
export const CATEGORY_COLOR: Record<NodeCategory, string> = {
  trigger: "var(--accent)",
  condition: "var(--st-testing)",
  action: "var(--st-done)",
  utility: "var(--accent-3)",
};

export const CATEGORY_NAME: Record<NodeCategory, string> = {
  trigger: "Trigger",
  condition: "Condition",
  action: "Action",
  utility: "Utility",
};

const EXEC_META: Record<ExecStatus | NodeExecStatus, { label: string; color: string; icon: LucideIcon }> = {
  success: { label: "Success", color: "var(--st-done)", icon: CheckCircle2 },
  failed: { label: "Failed", color: "var(--st-blocked)", icon: XCircle },
  running: { label: "Running", color: "var(--accent)", icon: Loader2 },
  waiting: { label: "Waiting", color: "var(--st-testing)", icon: Clock3 },
  cancelled: { label: "Cancelled", color: "var(--st-todo)", icon: CircleSlash },
  skipped: { label: "Skipped", color: "var(--st-todo)", icon: CircleSlash },
};

export function ExecBadge({ status, className }: { status: ExecStatus | NodeExecStatus; className?: string }) {
  const m = EXEC_META[status];
  const Icon = m.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", className)}
      style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}
    >
      <Icon className={cn("size-3", status === "running" && "animate-spin")} aria-hidden />
      {m.label}
    </span>
  );
}

export const execColor = (s: ExecStatus | NodeExecStatus) => EXEC_META[s].color;

export function WorkflowStatusPill({ status }: { status: "draft" | "active" | "inactive" }) {
  const map = {
    active: { label: "Active", color: "var(--st-done)" },
    draft: { label: "Draft", color: "var(--accent)" },
    inactive: { label: "Inactive", color: "var(--st-todo)" },
  }[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ color: map.color, background: `color-mix(in srgb, ${map.color} 14%, transparent)` }}
    >
      <span className={cn("size-1.5 rounded-full", status === "active" && "animate-pulse")} style={{ background: map.color }} />
      {map.label}
    </span>
  );
}

/** Accessible on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        checked ? "accent-gradient border-transparent" : "border-[var(--glass-line)] bg-[var(--glass-line)]",
      )}
    >
      <span
        className={cn(
          "inline-block size-4.5 rounded-full bg-[var(--bg-3)] shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function fmtDuration(ms: number | null | undefined) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ${Math.round((ms % 60_000) / 1000)}s`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function execDuration(e: { startedAt: string; completedAt: string | null; status: string }) {
  if (!e.completedAt) return e.status === "waiting" ? "waiting…" : "—";
  return fmtDuration(Date.parse(e.completedAt) - Date.parse(e.startedAt));
}

export const SOURCE_LABEL: Record<string, string> = {
  event: "Event",
  schedule: "Schedule",
  manual: "Manual",
  test: "Test",
};
