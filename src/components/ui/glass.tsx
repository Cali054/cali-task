"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PRIORITY_META, STATUS_META } from "@/lib/meta";
import type { Priority, Status } from "@/lib/types";

export function GlassCard({
  className,
  as: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { as?: "div" | "section" | "article" }) {
  return <Tag className={cn("glass min-w-0 rounded-[24px]", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="glass-soft grid size-9 shrink-0 place-items-center rounded-xl text-accent">
            <Icon className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="truncate text-xs text-fg-3">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "glass" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "glass", size = "md", type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-[0.97]",
        size === "sm" && "h-8 rounded-xl px-3 text-xs",
        size === "md" && "h-10 rounded-2xl px-4 text-sm",
        size === "icon" && "size-10 rounded-2xl",
        variant === "primary" &&
          "accent-gradient font-semibold text-on-accent shadow-[0_10px_28px_-12px_color-mix(in_srgb,var(--grad-b)_70%,transparent)] hover:brightness-105 hover:shadow-[var(--glow)]",
        variant === "glass" && "glass-soft text-fg hover:border-[color-mix(in_srgb,var(--accent-3)_55%,transparent)] hover:bg-[var(--glass-hover)]",
        variant === "ghost" && "text-fg-2 hover:bg-[var(--glass-soft)] hover:text-fg",
        variant === "danger" && "bg-st-blocked text-on-status hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
});

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        className,
      )}
      style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}
    >
      <Icon className="size-3" aria-hidden />
      {m.label}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const m = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium text-fg-2", className)}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: 4 + i * 2.5,
              background: i <= m.rank ? m.color : "var(--glass-line)",
            }}
          />
        ))}
      </span>
      {m.label}
    </span>
  );
}

export function Progress({
  value,
  color,
  className,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--glass-line)]", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", !color && "accent-gradient")}
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-fg-2">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-fg-3">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="glass-soft mb-1 grid size-12 place-items-center rounded-2xl text-accent">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {text && <p className="max-w-xs text-xs text-fg-3">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
