"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Ban, Bell, LogOut, CalendarClock, Menu, Monitor, Moon, Search, Settings, Sparkles, Sun } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth, useLogout } from "@/lib/auth";
import { useUI } from "@/lib/ui-store";
import { useTheme, type ThemePref } from "@/lib/theme";
import { isOverdue } from "@/lib/metrics";
import { cn, daysDiff, fmtDate, today } from "@/lib/utils";
import { Popover } from "@/components/ui/popover";

const SEEN_KEY = "cali-task:seen-notifications";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "C";
  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-2),var(--accent-3))] text-sm font-semibold text-white ring-2 ring-white/60 dark:ring-white/15",
        className,
      )}
    >
      {initials}
    </span>
  );
}

function SprintSelect() {
  const sprints = useStore((s) => s.sprints);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const setActiveSprint = useStore((s) => s.setActiveSprint);
  const openSprintForm = useUI((s) => s.openSprintForm);
  return (
    <label className="glass-soft flex h-10 items-center gap-2 rounded-2xl pl-3 pr-1 text-sm">
      <Sparkles className="size-4 text-accent" />
      <span className="sr-only">Active sprint</span>
      <select
        value={activeSprintId}
        onChange={(e) => (e.target.value === "__new" ? openSprintForm() : setActiveSprint(e.target.value))}
        className="h-full max-w-36 cursor-pointer bg-transparent pr-2 font-medium outline-none"
      >
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
        <option value="__new">+ New sprint…</option>
      </select>
    </label>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const search = useUI((s) => s.search);
  const setSearch = useUI((s) => s.setSearch);
  const openDetail = useUI((s) => s.openDetail);
  const tasks = useStore((s) => s.tasks);
  const sprints = useStore((s) => s.sprints);
  const [focus, setFocus] = useState(false);

  const q = search.trim().toLowerCase();
  const results = q
    ? tasks
        .filter((t) => `${t.code} ${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(q))
        .slice(0, 6)
    : [];

  return (
    <div className="relative w-full max-w-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFocus(false);
          router.push("/tasks");
        }}
        className="glass-soft flex h-10 items-center gap-2 rounded-2xl px-3"
        role="search"
      >
        <Search className="size-4 shrink-0 text-fg-3" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Search tasks, IDs, notes…"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-fg-3"
          aria-label="Search tasks"
        />
        <kbd className="hidden rounded-md border border-line px-1.5 text-[10px] text-fg-3 md:block">↵</kbd>
      </form>
      {focus && q && (
        <div className="glass-strong absolute left-0 right-0 top-full z-40 mt-2 rounded-[20px] p-2">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-fg-3">No tasks match “{search}”.</p>
          ) : (
            results.map((t) => (
              <button
                key={t.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  openDetail(t.id);
                  setFocus(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--glass-hover)]"
              >
                <span className="font-mono text-xs text-fg-3">#{t.code}</span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="hidden text-[11px] text-fg-3 sm:inline">{sprints.find((s) => s.id === t.sprintId)?.name}</span>
              </button>
            ))
          )}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setFocus(false);
              router.push("/tasks");
            }}
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-accent hover:bg-[var(--glass-hover)]"
          >
            See all results in My Tasks →
          </button>
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const tasks = useStore((s) => s.tasks);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const openDetail = useUI((s) => s.openDetail);
  const [seen, setSeen] = useState<string[]>(() => (typeof window === "undefined" ? [] : readSeen()));

  const items = useMemo(() => {
    const t0 = today();
    const out: { key: string; taskId: string; icon: typeof Bell; tone: string; title: string; text: string }[] = [];
    for (const t of tasks.filter((x) => x.sprintId === activeSprintId)) {
      if (t.status === "blocked" && t.blocker) {
        out.push({
          key: `blocked:${t.id}:${t.blocker.blockedOn}`,
          taskId: t.id,
          icon: Ban,
          tone: "var(--st-blocked)",
          title: `#${t.code} is blocked`,
          text: `${daysDiff(t.blocker.blockedOn, t0)}d · waiting on ${t.blocker.waitingOn || "clarification"}`,
        });
      } else if (isOverdue(t)) {
        out.push({
          key: `overdue:${t.id}:${t.targetDate}`,
          taskId: t.id,
          icon: AlertTriangle,
          tone: "var(--warn)",
          title: `#${t.code} is overdue`,
          text: `Target was ${fmtDate(t.targetDate)}`,
        });
      } else if (t.status !== "completed" && t.targetDate === t0) {
        out.push({
          key: `due:${t.id}:${t0}`,
          taskId: t.id,
          icon: CalendarClock,
          tone: "var(--accent)",
          title: `#${t.code} is due today`,
          text: t.title,
        });
      }
    }
    return out;
  }, [tasks, activeSprintId]);

  const unread = items.filter((i) => !seen.includes(i.key)).length;

  return (
    <Popover
      className="w-[min(340px,calc(100vw-32px))]"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="glass-soft relative grid size-10 place-items-center rounded-2xl text-fg-2 transition hover:text-fg"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-st-blocked px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                className="text-xs font-medium text-accent"
                onClick={() => {
                  const keys = items.map((i) => i.key);
                  setSeen(keys);
                  try {
                    localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
                  } catch {}
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-fg-3">You&apos;re all caught up.</p>
          ) : (
            <ul className="scroll-thin max-h-80 overflow-y-auto">
              {items.map((n) => {
                const Icon = n.icon;
                return (
                  <li key={n.key}>
                    <button
                      onClick={() => {
                        openDetail(n.taskId);
                        close();
                      }}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-[var(--glass-hover)]"
                    >
                      <span
                        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl"
                        style={{ color: n.tone, background: `color-mix(in srgb, ${n.tone} 14%, transparent)` }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {n.title}
                          {!seen.includes(n.key) && <span className="size-1.5 rounded-full bg-accent" />}
                        </span>
                        <span className="block truncate text-xs text-fg-3">{n.text}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

const THEME_OPTS: { v: ThemePref; icon: typeof Sun; label: string }[] = [
  { v: "light", icon: Sun, label: "Light" },
  { v: "dark", icon: Moon, label: "Dark" },
  { v: "system", icon: Monitor, label: "System" },
];

export function ThemeSwitch({ className }: { className?: string }) {
  const pref = useTheme((s) => s.pref);
  const setPref = useTheme((s) => s.setPref);
  return (
    <div className={cn("glass-soft flex rounded-2xl p-1", className)} role="radiogroup" aria-label="Theme">
      {THEME_OPTS.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          role="radio"
          aria-checked={pref === v}
          onClick={() => setPref(v)}
          title={label}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition",
            pref === v ? "glass text-fg" : "text-fg-3 hover:text-fg",
          )}
        >
          <Icon className="size-3.5" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function useClientToday() {
  return useSyncExternalStore(
    () => () => {},
    () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    () => "",
  );
}

export function Topbar() {
  const setIntro = useUI((s) => s.setIntro);
  const userName = useStore((s) => s.settings.userName);
  const user = useAuth((s) => s.user);
  const logout = useLogout();
  const setMobileNav = useUI((s) => s.setMobileNav);
  const dateLabel = useClientToday();
  const pref = useTheme((s) => s.pref);
  const setPref = useTheme((s) => s.setPref);
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <header className="flex flex-wrap items-center gap-3 pb-5">
      <button
        className="glass-soft grid size-10 place-items-center rounded-2xl lg:hidden"
        onClick={() => setMobileNav(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
          Welcome back, <span className="text-gradient">{userName || "Cali"}</span>!
        </h2>
        <p className="truncate text-xs text-fg-3">{dateLabel}</p>
      </div>
      <div className="order-last flex w-full items-center gap-2 xl:order-none xl:w-auto xl:flex-1 xl:justify-end">
        <GlobalSearch />
        <SprintSelect />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPref(isDark ? "light" : "dark")}
          className="glass-soft hidden size-10 place-items-center rounded-2xl text-fg-2 transition hover:text-fg sm:grid"
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          title={pref === "system" ? "Following system theme" : undefined}
        >
          <Sun className="hidden size-[18px] dark:block" />
          <Moon className="size-[18px] dark:hidden" />
        </button>
        <Notifications />
        <Popover
          className="w-64"
          trigger={({ toggle }) => (
            <button onClick={toggle} aria-label="Profile menu" className="rounded-full transition hover:scale-105">
              <Avatar name={userName} />
            </button>
          )}
        >
          {(close) => (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-2 py-1.5">
                <Avatar name={userName} className="size-9" />
                <div>
                  <p className="text-sm font-semibold">{user?.fullName ?? userName}</p>
                  <p className="max-w-40 truncate text-xs text-fg-3">{user?.email ?? "Personal workspace"}</p>
                </div>
              </div>
              <ThemeSwitch />
              <div className="border-t border-line pt-1">
                <Link
                  href="/settings"
                  onClick={close}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-[var(--glass-hover)]"
                >
                  <Settings className="size-4" /> Settings
                </Link>
                <button
                  onClick={() => {
                    close();
                    setIntro("show");
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-[var(--glass-hover)]"
                >
                  <Sparkles className="size-4" /> Replay intro
                </button>
                <button
                  onClick={() => {
                    close();
                    logout();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-st-blocked hover:bg-[var(--glass-hover)]"
                >
                  <LogOut className="size-4" /> Log out
                </button>
              </div>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}

