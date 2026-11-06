"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LogOut, X } from "lucide-react";
import { bindWorkspace } from "@/lib/store";
import { useAuth, useLogout } from "@/lib/auth";
import { useUI } from "@/lib/ui-store";
import { Logo, NavList, Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TaskFormDialog } from "@/components/dialogs/task-form-dialog";
import { TaskDetailDialog } from "@/components/dialogs/task-detail-dialog";
import { BlockerDialog } from "@/components/dialogs/blocker-dialog";
import { ProgressDialog } from "@/components/dialogs/progress-dialog";
import { SprintDialog } from "@/components/dialogs/sprint-dialog";
import { TourController } from "@/components/tour/tour-controller";
import { CaliLoadingIndicator } from "@/components/brand/cali-logo";

const SIDEBAR_KEY = "cali-task:sidebar-collapsed";

function MobileNav() {
  const open = useUI((s) => s.mobileNav);
  const setOpen = useUI((s) => s.setMobileNav);
  const openNewTask = useUI((s) => s.openNewTask);
  const logout = useLogout();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-[rgba(20,24,50,0.3)] backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            className="glass-strong fixed inset-y-3 left-3 z-50 flex w-[272px] flex-col rounded-[28px] p-3 lg:hidden"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            aria-label="Navigation"
          >
            <div className="flex items-center justify-between px-1.5 pb-5 pt-2">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="grid size-9 place-items-center rounded-xl hover:bg-[var(--glass-soft)]"
                aria-label="Close navigation"
              >
                <X className="size-4" />
              </button>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                openNewTask();
              }}
              className="accent-gradient mb-4 h-11 rounded-2xl text-sm font-semibold text-white"
            >
              + New Task
            </button>
            <NavList onNavigate={() => setOpen(false)} />
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="mt-auto flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium text-fg-2 transition hover:bg-st-blocked/10 hover:text-st-blocked"
            >
              <LogOut className="size-[18px]" /> Log out
            </button>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  const intro = useUI((s) => s.intro);
  const [boundFor, setBoundFor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const reduce = useReducedMotion();

  useEffect(() => {
    useAuth.getState().init();
  }, []);

  // Redirect right away: the login page loads under the intro and animates in
  // once the intro exits.
  useEffect(() => {
    if (status === "anon") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authed" || !user) return;
    let cancelled = false;
    bindWorkspace(user.id, user.fullName.split(/\s+/)[0] || user.username).then(() => {
      if (!cancelled) setBoundFor(user.id);
    });
    return () => {
      cancelled = true;
    };
  }, [status, user]);

  const toggleSidebar = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  const hydrated = status === "authed" && !!user && boundFor === user.id;
  const ready = hydrated && intro === "done";

  return (
    <>
      {!hydrated && intro === "done" && <CaliLoadingIndicator fullscreen />}
      {hydrated && (
        <motion.div
          className="flex min-h-dvh gap-4 p-3 sm:p-4 lg:h-dvh lg:min-h-0"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: "blur(6px)" }}
          animate={ready ? { opacity: 1, scale: 1, filter: "blur(0px)" } : undefined}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
          <main className="glass-soft scroll-thin relative min-w-0 flex-1 rounded-[28px] p-4 sm:p-6 lg:overflow-y-auto">
            <Topbar />
            {children}
          </main>
        </motion.div>
      )}

      {hydrated && (
        <>
          <MobileNav />
          <TaskFormDialog />
          <TaskDetailDialog />
          <BlockerDialog />
          <ProgressDialog />
          <SprintDialog />
          <TourController ready={ready} />
        </>
      )}
    </>
  );
}
