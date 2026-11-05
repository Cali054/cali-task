"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChevronsLeft, LogOut, Plus } from "lucide-react";
import { useLogout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { NAV } from "./nav";

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl accent-gradient shadow-[0_8px_20px_-8px_var(--accent)]">
        <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.75),transparent_55%)]" />
        <span className="relative text-sm font-bold text-white">C</span>
      </span>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">Cali&apos;s Task</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-fg-3">Plan · Track · Complete</p>
        </div>
      )}
    </div>
  );
}

export function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const blocked = useStore((s) => s.tasks.filter((t) => t.sprintId === s.activeSprintId && t.status === "blocked").length);

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
              active ? "text-fg" : "text-fg-2 hover:bg-[var(--glass-soft)] hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                className="glass absolute inset-0 rounded-2xl"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className={cn("relative size-[18px] shrink-0", active && "text-accent")} />
            {!collapsed && <span className="relative truncate">{item.label}</span>}
            {item.href === "/blocked" && blocked > 0 && (
              <span
                className={cn(
                  "relative grid min-w-5 place-items-center rounded-full bg-st-blocked px-1.5 text-[10px] font-bold text-white",
                  collapsed ? "absolute right-1.5 top-1.5 min-w-4 px-1" : "ml-auto",
                )}
              >
                {blocked}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const openNewTask = useUI((s) => s.openNewTask);
  const logout = useLogout();
  return (
    <aside
      data-tour="nav"
      className={cn(
        "glass hidden shrink-0 flex-col rounded-[28px] p-3 transition-[width] duration-300 ease-out lg:flex",
        collapsed ? "w-[76px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex items-center px-1.5 pb-5 pt-2", collapsed ? "justify-center" : "justify-between")}>
        <Logo collapsed={collapsed} />
      </div>

      <button
        onClick={() => openNewTask()}
        className={cn(
          "accent-gradient mb-4 flex h-11 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-[0_10px_24px_-10px_var(--accent)] transition hover:brightness-110 active:scale-[0.98]",
        )}
        title="New task"
      >
        <Plus className="size-4" />
        {!collapsed && "New Task"}
      </button>

      <NavList collapsed={collapsed} />

      <div className="mt-auto space-y-1 pt-4">
        <button
          onClick={logout}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium text-fg-2 transition hover:bg-st-blocked/10 hover:text-st-blocked",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut className="size-[18px]" />
          {!collapsed && "Log out"}
        </button>
        <button
          onClick={onToggle}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-xs font-medium text-fg-3 transition hover:bg-[var(--glass-soft)] hover:text-fg",
            collapsed && "justify-center px-0",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
