"use client";

import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, Check, Eye, EyeOff, Loader2, Moon, Sun, type LucideIcon } from "lucide-react";
import { CaliLoadingIndicator, CaliLogo } from "@/components/brand/cali-logo";
import { AuthError, authAdapter, useAuth } from "@/lib/auth";
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
          router.replace("/dashboard");
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

/** Google's four-colour "G" mark, as required by Google's sign-in branding guidelines. */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google". Sends the browser to Google's account chooser via
 * Supabase Auth; the result comes back to /auth/callback.
 */
export function GoogleButton({ onError, disabled }: { onError: (message: string | null) => void; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  // Coming back with the browser's Back button restores this page from cache;
  // don't leave the spinner running.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => e.persisted && setLoading(false);
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  async function start() {
    onError(null);
    setLoading(true);
    try {
      await authAdapter.signInWithGoogle();
      // The browser is now leaving for Google; keep the spinner.
    } catch (e) {
      onError(e instanceof AuthError ? e.message : "Google sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={start}
      disabled={loading || disabled}
      aria-busy={loading}
      aria-label={loading ? "Connecting to Google" : "Continue with Google"}
      whileHover={loading || disabled ? undefined : { y: -1 }}
      whileTap={loading || disabled ? undefined : { scale: 0.98 }}
      className="group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-white/85 text-sm font-semibold text-[#1f1f1f] shadow-[0_8px_24px_-12px_rgba(40,50,120,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition-[background,box-shadow,opacity] hover:bg-white hover:shadow-[0_14px_32px_-14px_rgba(40,50,120,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white/[0.07] dark:text-fg dark:hover:bg-white/[0.12]"
    >
      <span className="absolute inset-0 -translate-x-full bg-[linear-gradient(110deg,transparent_30%,rgba(120,140,255,0.16)_50%,transparent_70%)] transition-transform duration-700 group-hover:translate-x-full" />
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span key="l" className="relative flex items-center gap-2.5" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Loader2 className="size-[18px] animate-spin text-accent" /> Connecting to Google…
          </motion.span>
        ) : (
          <motion.span key="t" className="relative flex items-center gap-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <span className="grid size-7 place-items-center rounded-full bg-white shadow-sm transition-transform duration-300 group-hover:scale-110">
              <GoogleMark className="size-[18px]" />
            </span>
            Continue with Google
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/** Thin "or" separator between Google and the email form. */
export function OrDivider({ children = "or" }: { children?: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-fg-3" role="separator">
      <span className="h-px flex-1 bg-[var(--glass-line)]" />
      {children}
      <span className="h-px flex-1 bg-[var(--glass-line)]" />
    </div>
  );
}

/** Consent line shown under the Google button. */
export function GoogleConsentNote() {
  return (
    <p className="mt-2.5 text-center text-[11px] leading-relaxed text-fg-3">
      By continuing with Google, you agree to our{" "}
      <Link href="/privacy-policy" className="font-medium text-accent hover:underline">Privacy Policy</Link> and{" "}
      <Link href="/terms-and-conditions" className="font-medium text-accent hover:underline">Terms &amp; Conditions</Link>.
    </p>
  );
}
