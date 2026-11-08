"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AuthError, useAuth, type User } from "@/lib/auth";
import { AuthScreen, FormAlert, GoogleMark } from "@/components/auth/auth-ui";

// The one-time code may only be exchanged once, even if React runs the
// effect twice (Strict Mode) or the component remounts.
let pending: { key: string; promise: Promise<User> } | null = null;
function completeOnce(search: string) {
  if (pending?.key !== search) {
    pending = { key: search, promise: useAuth.getState().completeGoogleSignIn(new URLSearchParams(search)) };
  }
  return pending.promise;
}

/** Google sends the browser back here after the account is chosen. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let active = true;
    const search = window.location.search;
    completeOnce(search)
      .then(() => {
        if (!active) return;
        // Remove the code from the address bar and history.
        window.history.replaceState(null, "", window.location.pathname);
        setLeaving(true);
        setTimeout(() => router.replace("/dashboard"), 420);
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof AuthError ? e.message : "Google sign-in failed. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <AuthScreen
      title={error ? "Couldn't sign you in" : "Signing you in"}
      subtitle={error ? "Nothing was changed. You can try again." : "Finishing your Google sign-in…"}
      leaving={leaving}
    >
      {error ? (
        <div className="space-y-4">
          <FormAlert>{error}</FormAlert>
          <Link
            href="/login"
            className="glass-soft flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition hover:bg-[var(--glass-hover)]"
          >
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4" role="status" aria-live="polite">
          <span className="relative grid size-16 place-items-center rounded-full bg-white shadow-[0_10px_30px_-12px_rgba(40,50,120,0.5)]">
            <GoogleMark className="size-8" />
            <Loader2 className="absolute -inset-2 size-20 animate-spin text-accent/60" strokeWidth={1.2} aria-hidden />
          </span>
          <p className="text-sm text-fg-2">Setting up your Cali workspace…</p>
        </div>
      )}
    </AuthScreen>
  );
}
