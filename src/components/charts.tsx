"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { fmtDate } from "@/lib/utils";

const axis = { stroke: "var(--fg-3)", fontSize: 11, tickLine: false, axisLine: false } as const;

function GlassTooltip({ active, payload, label }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-2xl px-3 py-2 text-xs">
      <p className="mb-1 font-semibold">{typeof label === "string" && /^\d{4}-/.test(label) ? fmtDate(label, { weekday: "short", month: "short", day: "numeric" }) : label}</p>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <p key={String(p.dataKey)} className="flex items-center gap-2 text-fg-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}: <span className="font-semibold text-fg">{p.value}</span>
          </p>
        ))}
    </div>
  );
}

const tickDate = (v: string) => (/^\d{4}-/.test(v) ? fmtDate(v, { month: "numeric", day: "numeric" }) : v);

export function BurndownChart({
  data,
  height = 260,
}: {
  data: { date: string; ideal: number; remaining: number | null }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="bd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={tickDate} {...axis} />
        <YAxis {...axis} allowDecimals />
        <Tooltip content={<GlassTooltip />} cursor={{ stroke: "var(--fg-3)", strokeDasharray: "3 3" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--fg-2)" }} />
        <Line
          type="linear"
          dataKey="ideal"
          name="Ideal remaining"
          stroke="var(--fg-3)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Area
          type="monotone"
          dataKey="remaining"
          name="Actual remaining"
          stroke="var(--series-1)"
          strokeWidth={2}
          fill="url(#bd-fill)"
          dot={{ r: 4, strokeWidth: 2, fill: "var(--glass-strong)" }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function EstimateVsActualChart({
  data,
  height = 280,
}: {
  data: { label: string; estimate: number; actual: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="label" {...axis} interval={0} />
        <YAxis {...axis} />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: "var(--glass-line)" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--fg-2)" }} />
        <Bar dataKey="estimate" name="Estimated (days)" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="actual" name="Actual (days)" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyChart({
  data,
  height = 240,
}: {
  data: { date: string; logged: number; completed: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={tickDate} {...axis} />
        <YAxis {...axis} />
        <Tooltip content={<GlassTooltip />} cursor={{ fill: "var(--glass-line)" }} />
        <Bar dataKey="logged" name="Days logged" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CompletionsChart({
  data,
  height = 240,
}: {
  data: { date: string; completed: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="cc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-3)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--series-3)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={tickDate} {...axis} />
        <YAxis {...axis} allowDecimals={false} />
        <Tooltip content={<GlassTooltip />} cursor={{ stroke: "var(--fg-3)", strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey="completed" name="Cumulative completed" stroke="var(--series-3)" strokeWidth={2} fill="url(#cc-fill)" dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Ring gauge (not a chart library — a single headline value). */
export function Ring({ value, size = 120, stroke = 10, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--grad-a)" />
            <stop offset="50%" stopColor="var(--grad-b)" />
            <stop offset="100%" stopColor="var(--grad-c)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--glass-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-g)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-semibold tracking-tight">{Math.round(pct * 100)}%</p>
        {label && <p className="text-[10px] uppercase tracking-wider text-fg-3">{label}</p>}
      </div>
    </div>
  );
}

/** Donut of tasks per status, with the total in the middle. */
export function StatusDonut({
  data,
  size = 168,
}: {
  data: { key: string; label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const shown = data.filter((d) => d.value > 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={shown.length ? shown : [{ key: "empty", label: "No tasks", value: 1, color: "var(--glass-line)" }]}
            dataKey="value"
            nameKey="label"
            innerRadius="70%"
            outerRadius="100%"
            paddingAngle={shown.length > 1 ? 2.5 : 0}
            cornerRadius={4}
            stroke="none"
            isAnimationActive
          >
            {(shown.length ? shown : [{ key: "empty", color: "var(--glass-line)" }]).map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          {shown.length > 0 && <Tooltip content={<GlassTooltip />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold tracking-tight">{total}</p>
          <p className="text-[10px] uppercase tracking-wider text-fg-3">tasks</p>
        </div>
      </div>
    </div>
  );
}
