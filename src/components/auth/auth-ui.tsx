"use client";

import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Check, Eye, EyeOff, Loader2, Moon, Sun, type LucideIcon } from "lucide-react";
import { CaliLoadingIndicator, CaliLogo } from "@/components/brand/cali-logo";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useUI } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

/** Floating glass shapes behind the auth card. */
function FloatingGlass() {
  const reduce = useReducedMotion();
  const shapes = [
    { cls: "left-[8%] top-[14%] size-24 rounded-[28px] rotate-12", d: 0 },
    { cls: "right-[10%] top-[10%] size-16 rounded-full", d: 1.2 },
    { cls: "left-[14%] bottom-[12%] size-14 rounded-full", d: 0.6 },
    { cls: "right-[12%] bottom-[16%] size-28 rounded-[32px] -rotate-12", d: 1.8 },
    { cls: "left-[44%] top-[6%] size-10 rounded-2xl rotate-45", d: 2.4 },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 hidden overflow-hidden sm:block" aria-hidden>
      {shapes.map((s, i) => (
        <motion.span
          key={i}
          className={cn("glass-soft absolute", s.cls)}
          initial={{ opacity: 0, y: 20 }}
          animate={reduce ? { opacity: 0.8, y: 0 } : { opacity: 0.8, y: [0, -14, 0] }}
          transition={
            reduce
              ? { duration: 0.6 }
              : { opacity: { duration: 0.8, delay: s.d * 0.2 }, y: { duration: 7 + i, repeat: Infinity, ease: "easeInOut", delay: s.d } }
          }
        />
      ))}
    </div>
  );
}

function ThemeToggle() {
  const setPref = useTheme((s) => s.setPref);
  return (
    <button
      onClick={() => setPref(document.documentElement.classList.contains("dark") ? "light" : "dark")}
      className="glass-soft fixed right-4 top-4 z-10 grid size-10 place-items-center rounded-2xl text-fg-2 transition hover:text-fg"
      aria-label="Toggle dark mode"
    >
      <Sun className="hidden size-[18px] dark:block" />
      <Moon className="size-[18px] dark:hidden" />
    </button>
  );
}

/**
 * Layout for login/signup/reset. Redirects signed-in users to the dashboard
 * and waits for the intro to finish before animating the card in.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
  wide,
  leaving,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Plays the exit animation (e.g. after a successful sign-in). */
  leaving?: boolean;
}) {
  const router = useRouter();
  const intro = useUI((s) => s.intro);
  const status = useAuth((s) => s.status);
  const reduce = useReducedMotion();
  const [redirecting, setRedirecting] = useState(false);

  // Already signed in when arriving here → go straight to the dashboard.
  useEffect(() => {
    useAuth
      .getState()
      .init()
      .then(() => {
        if (useAuth.getState().status === "authed") {
          setRedirecting(true);
          router.replace("/");
        }
      });
  }, [router]);

  const visible = intro === "done" && status !== "loading" && !redirecting;

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-x-clip px-4 py-10">
      <FloatingGlass />
      <ThemeToggle />
      <AnimatePresence>
        {visible && (
          <motion.div
            key="card"
            className={cn("relative w-full", wide ? "max-w-[480px]" : "max-w-[420px]")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96, filter: "blur(10px)" }}
            animate={
              leaving
                ? reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 1.04, filter: "blur(8px)" }
                : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
            }
            transition={{ duration: leaving ? 0.45 : 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {/* glow behind card */}
            <div className="absolute -inset-6 -z-10 rounded-[48px] bg-[radial-gradient(closest-side,var(--orb-b),transparent)] opacity-70 blur-2xl" />
            <div className="glass-strong rounded-[28px] p-6 sm:p-8">
              <div className="mb-6 flex flex-col items-center text-center">
                <motion.div
                  className="mb-5"
                  initial={reduce ? false : { scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <CaliLogo height={72} align="center" tagline priority />
                </motion.div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                <p className="mt-1 text-sm text-fg-2">{subtitle}</p>
              </div>
              {children}
            </div>
            {footer && <div className="mt-5 text-center text-sm text-fg-2">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
      {!visible && intro === "done" && <CaliLoadingIndicator fullscreen />}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  error?: string | null;
  valid?: boolean;
  hint?: ReactNode;
  trailing?: ReactNode;
};

export const AuthInput = forwardRef<HTMLInputElement, InputProps>(function AuthInput(
  { label, icon: Icon, error, valid, hint, trailing, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const errId = `${inputId}-error`;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-fg-2">
        {label}
      </label>
      <div
        className={cn(
          "group relative flex h-12 items-center rounded-2xl border bg-[var(--glass-soft)] transition-all duration-200",
          "focus-within:bg-[var(--glass)] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent),0_8px_24px_-12px_var(--accent)]",
          error
            ? "border-st-blocked/70 focus-within:border-st-blocked"
            : "border-[var(--glass-border)] focus-within:border-accent",
        )}
      >
        <Icon
          className={cn(
            "ml-3.5 size-[18px] shrink-0 transition-colors",
            error ? "text-st-blocked" : "text-fg-3 group-focus-within:text-accent",
          )}
          aria-hidden
        />
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-fg outline-none placeholder:text-fg-3"
          {...props}
        />
        {valid && !error && !trailing && <Check className="mr-3.5 size-4 text-st-done" aria-hidden />}
        {trailing}
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="err"
            id={errId}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1 overflow-hidden pt-1.5 text-xs text-st-blocked"
          >
            <AlertCircle className="size-3.5 shrink-0" /> {error}
          </motion.p>
        ) : hint ? (
          <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-1.5 text-[11px] text-fg-3">
            {hint}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, "type" | "trailing">>(function PasswordInput(
  props,
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <AuthInput
      ref={ref}
      {...props}
      type={show ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="mr-1.5 grid size-9 place-items-center rounded-xl text-fg-3 transition hover:bg-[var(--glass-soft)] hover:text-fg"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      }
    />
  );
});

/** Primary auth button with a shimmer on hover and a spinner while loading. */
export function SubmitButton({ loading, children, disabled }: { loading?: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <motion.button
      type="submit"
      disabled={loading || disabled}
      whileHover={loading || disabled ? undefined : { y: -1 }}
      whileTap={loading || disabled ? undefined : { scale: 0.98 }}
      className="accent-gradient group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-semibold text-white shadow-[0_12px_28px_-10px_var(--accent)] transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.35)_50%,transparent_70%)] transition-transform duration-700 group-hover:translate-x-full" />
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span key="l" className="relative flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Loader2 className="size-4 animate-spin" /> Please wait…
          </motion.span>
        ) : (
          <motion.span key="t" className="relative flex items-center gap-2" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, x: 0 }}
      animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
      transition={{ duration: 0.4 }}
      className="mb-4 flex items-start gap-2 rounded-2xl border border-st-blocked/30 bg-st-blocked/10 px-3.5 py-3 text-sm text-st-blocked"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{children}</span>
    </motion.div>
  );
}

export function GlassCheckbox({
  checked,
  onChange,
  children,
  invalid,
  id,
  ariaLabel,
}: {
  ariaLabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  invalid?: boolean;
  id: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-all duration-200",
          checked
            ? "accent-gradient border-transparent shadow-[0_4px_12px_-4px_var(--accent)]"
            : invalid
              ? "border-st-blocked bg-st-blocked/10"
              : "border-[var(--glass-border)] bg-[var(--glass-soft)] hover:border-accent",
        )}
      >
        <motion.span initial={false} animate={{ scale: checked ? 1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
          <Check className="size-3.5 text-white" strokeWidth={3} />
        </motion.span>
      </button>
      <label htmlFor={id} className="cursor-pointer select-none text-sm leading-snug text-fg-2">
        {children}
      </label>
    </div>
  );
}
