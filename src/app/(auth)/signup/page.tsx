"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AtSign, CheckCircle2, Circle, Lock, Mail, Sparkles, UserRound } from "lucide-react";
import { AuthError, EMAIL_RE, USERNAME_RE, authAdapter, passwordStrength, useAuth } from "@/lib/auth";
import { PRIVACY_POLICY, TERMS, type LegalDoc } from "@/lib/legal";
import { AuthInput, AuthScreen, FormAlert, GlassCheckbox, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";
import { LegalModal } from "@/components/legal/legal-doc";

type FieldKey = "fullName" | "email" | "username" | "password" | "confirm" | "consent";

function StrengthMeter({ password }: { password: string }) {
  const s = passwordStrength(password);
  if (!password) return null;
  return (
    <div className="pt-2" aria-live="polite">
      <div className="mb-1.5 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-line)]">
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{ width: i < s.score ? "100%" : "0%", backgroundColor: s.color }}
              transition={{ duration: 0.3 }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-semibold" style={{ color: s.color }}>
          {s.label}
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
          {s.checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-1 text-[11px] ${c.ok ? "text-st-done" : "text-fg-3"}`}>
              {c.ok ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const signUp = useAuth((s) => s.signUp);
  const [v, setV] = useState({ fullName: "", email: "", username: "", password: "", confirm: "" });
  const [consent, setConsent] = useState(false);
  const [read, setRead] = useState({ privacy: false, terms: false });
  const [doc, setDocState] = useState<LegalDoc | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const setDoc = (d: LegalDoc) => {
    setDocState(d);
    setDocOpen(true);
  };
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [serverErr, setServerErr] = useState<{ field?: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const strength = passwordStrength(v.password);
  const errors: Record<FieldKey, string | null> = {
    fullName: v.fullName.trim().length < 2 ? "Enter your full name." : null,
    email: !EMAIL_RE.test(v.email.trim())
      ? "Enter a valid email address."
      : authAdapter.emailTaken(v.email)
        ? "An account with this email already exists."
        : null,
    username: !USERNAME_RE.test(v.username.trim())
      ? "3–24 characters: letters, numbers, dots or underscores."
      : authAdapter.usernameTaken(v.username)
        ? "This username is taken."
        : null,
    password: v.password.length < 8 ? "Use at least 8 characters." : strength.score < 2 ? "Too weak — add numbers, symbols or mixed case." : null,
    confirm: !v.confirm ? "Confirm your password." : v.confirm !== v.password ? "Passwords don't match." : null,
    consent: !consent ? "You need to agree to the Privacy Policy and Terms & Conditions." : null,
  };
  // Validate in real time once a field has been touched (or has content, for confirm).
  const err = (k: FieldKey) =>
    serverErr?.field === k ? serverErr.message : touched[k] || (k === "confirm" && v.confirm) ? errors[k] : null;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    if (serverErr?.field === k) setServerErr(null);
  };
  const blur = (k: FieldKey) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ fullName: true, email: true, username: true, password: true, confirm: true, consent: true });
    if (Object.values(errors).some(Boolean)) return;
    setLoading(true);
    setServerErr(null);
    try {
      await signUp({ fullName: v.fullName, email: v.email, username: v.username, password: v.password });
      setLeaving(true);
      setTimeout(() => router.replace("/"), 420);
    } catch (e) {
      setServerErr(
        e instanceof AuthError ? { field: e.field, message: e.message } : { message: "Something went wrong. Please try again." },
      );
      setLoading(false);
    }
  }

  const docLink = (d: LegalDoc, children: React.ReactNode) => (
    <button type="button" onClick={() => setDoc(d)} className="font-semibold text-accent underline-offset-2 hover:underline">
      {children}
    </button>
  );

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Start planning your sprints in minutes."
      wide
      leaving={leaving}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {serverErr && !serverErr.field && <FormAlert>{serverErr.message}</FormAlert>}
        <AuthInput
          label="Full name"
          name="fullName"
          icon={UserRound}
          autoComplete="name"
          placeholder="Your full name"
          value={v.fullName}
          onChange={set("fullName")}
          onBlur={blur("fullName")}
          error={err("fullName")}
          valid={touched.fullName && !errors.fullName}
          autoFocus
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthInput
            label="Email address"
            name="email"
            type="email"
            icon={Mail}
            autoComplete="email"
            placeholder="you@example.com"
            value={v.email}
            onChange={set("email")}
            onBlur={blur("email")}
            error={err("email")}
            valid={touched.email && !errors.email}
          />
          <AuthInput
            label="Username"
            name="username"
            icon={AtSign}
            autoComplete="username"
            placeholder="cali"
            value={v.username}
            onChange={set("username")}
            onBlur={blur("username")}
            error={err("username")}
            valid={!!v.username && !errors.username}
          />
        </div>
        <div>
          <PasswordInput
            label="Password"
            name="password"
            icon={Lock}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={v.password}
            onChange={set("password")}
            onBlur={blur("password")}
            error={err("password")}
          />
          <StrengthMeter password={v.password} />
        </div>
        <PasswordInput
          label="Confirm password"
          name="confirm"
          icon={Lock}
          autoComplete="new-password"
          placeholder="Repeat your password"
          value={v.confirm}
          onChange={set("confirm")}
          onBlur={blur("confirm")}
          error={err("confirm")}
          valid={!!v.confirm && !errors.confirm}
          hint={v.confirm && !errors.confirm ? <span className="text-st-done">Passwords match</span> : undefined}
        />

        <div className="glass-soft space-y-2 rounded-2xl p-3.5">
          <GlassCheckbox
            id="consent"
            ariaLabel="I have read and agree to the Privacy Policy and Terms & Conditions"
            checked={consent}
            onChange={(c) => {
              setConsent(c);
              setTouched((t) => ({ ...t, consent: true }));
            }}
            invalid={!!err("consent")}
          >
            I have read and agree to the {docLink(PRIVACY_POLICY, "Privacy Policy")} and{" "}
            {docLink(TERMS, "Terms & Conditions")}.
          </GlassCheckbox>
          <div className="flex flex-wrap gap-2 pl-7">
            {([
              ["privacy", PRIVACY_POLICY],
              ["terms", TERMS],
            ] as const).map(([k, d]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDoc(d)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  read[k] ? "bg-st-done/12 text-st-done" : "bg-[var(--glass-line)] text-fg-3 hover:text-fg"
                }`}
              >
                {read[k] ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
                {d.title} {read[k] ? "read" : "not yet read"}
              </button>
            ))}
          </div>
          {err("consent") && (
            <p role="alert" className="pl-7 text-xs text-st-blocked">
              {err("consent")}
            </p>
          )}
        </div>

        <SubmitButton loading={loading || leaving}>
          <Sparkles className="size-4" /> Create account
        </SubmitButton>
      </form>

      {doc && (
        <LegalModal
          key={doc.slug}
          doc={doc}
          open={docOpen}
          onOpenChange={setDocOpen}
          onRead={() => setRead((r) => ({ ...r, [doc.slug === "privacy-policy" ? "privacy" : "terms"]: true }))}
        />
      )}
    </AuthScreen>
  );
}
