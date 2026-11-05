"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, UserRound } from "lucide-react";
import { AuthError, useAuth, LIMITS } from "@/lib/auth";
import { AuthInput, AuthScreen, FormAlert, GlassCheckbox, PasswordInput, SubmitButton } from "@/components/auth/auth-ui";

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const errors = {
    identifier: !identifier.trim() ? "Enter your email or username." : null,
    password: !password ? "Enter your password." : null,
  };
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ identifier: true, password: true });
    if (errors.identifier || errors.password) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(identifier, password, remember);
      setLeaving(true);
      setTimeout(() => router.replace("/"), 420);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to plan, track and complete."
      leaving={leaving}
      footer={
        <>
          New to Cali&apos;s Task?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <AuthInput
          label="Email or username"
          name="identifier"
          maxLength={LIMITS.email}
          icon={UserRound}
          autoComplete="username"
          placeholder="you@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, identifier: true }))}
          error={show("identifier")}
          autoFocus
        />
        <PasswordInput
          label="Password"
          name="password"
          maxLength={LIMITS.password}
          icon={Lock}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={show("password")}
        />
        <div className="flex items-center justify-between gap-3 pt-1">
          <GlassCheckbox id="remember" checked={remember} onChange={setRemember}>
            Remember me
          </GlassCheckbox>
          <Link href="/forgot-password" className="text-sm font-medium text-accent hover:underline">
            Forgot password?
          </Link>
        </div>
        <div className="pt-2">
          <SubmitButton loading={loading || leaving}>
            Sign in <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </SubmitButton>
        </div>
        <p className="text-center text-[11px] text-fg-3">
          Your account is stored securely on this device.
        </p>
      </form>
    </AuthScreen>
  );
}
