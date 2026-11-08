"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used for Google sign-in and for syncing a Google
 * user's workspace. Only the public URL and the publishable (anon) key are
 * used here; they are safe in the browser because Row Level Security limits
 * every query to the signed-in user's own rows. The service-role key must
 * never be added to this app.
 *
 * When the variables aren't set (e.g. a fresh clone), Google sign-in is shown
 * as unavailable and email/password accounts keep working as before.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured || typeof window === "undefined") return null;
  client ??= createClient(SUPABASE_URL!, KEY!, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // The /auth/callback page exchanges the code itself, exactly once.
      detectSessionInUrl: false,
      storageKey: "cali-task:supabase-auth",
    },
  });
  return client;
}

export const OAUTH_CALLBACK_PATH = "/auth/callback";

/** Columns of public.profiles the app reads. */
export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  google_id: string | null;
  email_verified: boolean;
  consent_version: string | null;
  consent_at: string | null;
  created_at: string;
}

export const PROFILE_COLUMNS =
  "id, email, full_name, display_name, avatar_url, google_id, email_verified, consent_version, consent_at, created_at";
