"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, AtSign, CheckCircle2, KeyRound, Lock, Mail } from "lucide-react";
import { AuthError, EMAIL_RE, authAdapter, passwordStrength, LIMITS } from "@/lib/auth";
import { AuthInput, AuthScreen, FormAlert, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";

/**
 * Accounts live on this device and there's no email service, so a reset is
 * confirmed with the account's email and username together.
 */
export default function ForgotPasswordPage() {
  const [v, setV] = useState({ email: "", username: "", password: "", confirm: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const errors = {
    email: !EMAIL_RE.test(v.email.trim()) ? "Enter the email on your account." : null,
    username: !v.username.trim() ? "Enter your username." : null,
    password: passwordStrength(v.password).score < 2 || v.password.length < 8 ? "Use at least 8 characters with some variety." : null,
    confirm: v.confirm !== v.password || !v.confirm ? "Passwords don't match." : null,
  };
  const err = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, username: true, password: true, confirm: true });
    if (Object.values(errors).some(Boolean)) return;
    setLoading(true);
    setError(null);
    try {
      await authAdapter.resetPassword(v.email, v.username, v.password);
      setDone(true);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title={done ? "Password updated" : "Reset your password"}
      subtitle={done ? "You can sign in with your new password." : "Confirm your account details and choose a new password."}
      footer={
        <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      }
    >
      {done ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-2">
          <span className="grid size-16 place-items-center rounded-full bg-st-done/15 text-st-done">
            <CheckCircle2 className="size-8" />
          </span>
          <Link
            href="/login"
            className="accent-gradient flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-on-accent shadow-[0_10px_28px_-12px_color-mix(in_srgb,var(--grad-b)_70%,transparent)] hover:brightness-110"
          >
            Go to sign in
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error && <FormAlert>{error}</FormAlert>}
          <AuthInput label="Email address" name="email" maxLength={LIMITS.email} type="email" icon={Mail} autoComplete="email" value={v.email} onChange={set("email")} onBlur={blur("email")} error={err("email")} autoFocus />
          <AuthInput label="Username" name="username" maxLength={LIMITS.username} icon={AtSign} autoComplete="username" value={v.username} onChange={set("username")} onBlur={blur("username")} error={err("username")} />
          <PasswordInput label="New password" name="password" maxLength={LIMITS.password} icon={Lock} autoComplete="new-password" value={v.password} onChange={set("password")} onBlur={blur("password")} error={err("password")} />
          <PasswordInput label="Confirm new password" name="confirm" maxLength={LIMITS.password} icon={Lock} autoComplete="new-password" value={v.confirm} onChange={set("confirm")} onBlur={blur("confirm")} error={err("confirm")} />
          <SubmitButton loading={loading}>
            <KeyRound className="size-4" /> Update password
          </SubmitButton>
        </form>
      )}
    </AuthScreen>
  );
}
