import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Server-only helpers for "bring your own key" AI (Gemini, OpenAI).
 *
 * Keys are encrypted with AES-256-GCM using AI_KEYS_SECRET (a server-only
 * environment variable) before they are stored in Supabase, and decrypted
 * only here, for the duration of one provider request. The browser never
 * receives a key back — only its last 4 characters.
 */

export type AiProvider = "gemini" | "openai";
export const AI_PROVIDERS: AiProvider[] = ["gemini", "openai"];
export const isProvider = (v: unknown): v is AiProvider => v === "gemini" || v === "openai";

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/* ---------- Encryption ---------- */

function secretKey(): Buffer | null {
  const s = process.env.AI_KEYS_SECRET;
  if (!s || s.length < 32) return null;
  // Any long random string works; hash it to exactly 32 bytes.
  return createHash("sha256").update(s, "utf8").digest();
}

export const encryptionReady = () => secretKey() !== null;

export function encrypt(plain: string): string {
  const key = secretKey();
  if (!key) throw new Error("AI_KEYS_SECRET is not set.");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function decrypt(packed: string): string {
  const key = secretKey();
  if (!key) throw new Error("AI_KEYS_SECRET is not set.");
  const [v, iv, tag, data] = packed.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unreadable key.");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/* ---------- Auth ---------- */

/** Verifies the caller's Supabase session; returns a client acting as that user (RLS applies). */
export async function authenticate(req: Request): Promise<{ user: User; sb: SupabaseClient } | Response> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return json(503, { error: "Sign-in service isn't configured." });

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return json(403, { error: "Cross-site request refused." });

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return json(401, { error: "Sign in with Google to use AI steps." });
  const sb = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return json(401, { error: "Your session expired. Sign in again." });
  return { user: data.user, sb };
}

/** Loads and decrypts the user's key for a provider. */
export async function loadKey(sb: SupabaseClient, userId: string, provider: AiProvider): Promise<string | Response> {
  if (!encryptionReady()) return json(501, { error: "AI keys aren't set up on the server yet (AI_KEYS_SECRET is missing)." });
  const { data, error } = await sb.from("ai_keys").select("ciphertext").eq("user_id", userId).eq("provider", provider).maybeSingle<{ ciphertext: string }>();
  if (error) return json(503, { error: "AI key storage is missing. Run the AI keys migration in Supabase." });
  if (!data) return json(400, { error: `Add your ${provider === "gemini" ? "Gemini" : "OpenAI"} API key in Settings → AI keys first.` });
  try {
    return decrypt(data.ciphertext);
  } catch {
    return json(400, { error: "Your saved key can't be read (the server secret changed). Save it again in Settings." });
  }
}

/* ---------- Providers ---------- */

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 25_000;

async function call(url: string, init: RequestInit, provider: AiProvider) {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new ProviderError(timeout ? "The AI provider took too long to answer." : "Couldn't reach the AI provider.", 502);
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const name = provider === "gemini" ? "Gemini" : "OpenAI";
    const detail = String((body.error as { message?: string } | undefined)?.message ?? "").slice(0, 200);
    if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(JSON.stringify(body)))
      throw new ProviderError(`${name} rejected the API key.`, 400);
    if (res.status === 429) throw new ProviderError(`${name} rate limit or quota reached. ${detail}`.trim(), 429);
    if (res.status === 400 || res.status === 404) throw new ProviderError(`${name}: ${detail || "invalid request"}`, 400);
    throw new ProviderError(`${name} error (${res.status}).`, 502);
  }
  return body;
}

export interface ModelInfo {
  id: string;
  label: string;
}

/** Text models the key can use (also proves the key works). */
export async function listModels(provider: AiProvider, key: string): Promise<ModelInfo[]> {
  if (provider === "gemini") {
    const out: ModelInfo[] = [];
    let page = "";
    for (let i = 0; i < 5; i++) {
      const body = await call(
        `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`,
        { headers: { "x-goog-api-key": key } },
        provider,
      );
      const models = (body.models ?? []) as { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
      for (const m of models)
        if (m.supportedGenerationMethods?.includes("generateContent") && !/embedding|aqa|imagen|veo|tts|image|audio/i.test(m.name))
          out.push({ id: m.name.replace(/^models\//, ""), label: m.displayName || m.name.replace(/^models\//, "") });
      page = String(body.nextPageToken ?? "");
      if (!page) break;
    }
    return out;
  }
  const body = await call("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } }, provider);
  const models = (body.data ?? []) as { id: string; created?: number }[];
  return models
    .filter((m) => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !/(audio|realtime|tts|transcribe|image|embedding|search|instruct|moderation)/.test(m.id))
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .map((m) => ({ id: m.id, label: m.id }));
}

export async function generate(
  provider: AiProvider,
  key: string,
  p: { model: string; system: string; prompt: string; maxOutputTokens: number },
): Promise<string> {
  if (provider === "gemini") {
    const body = await call(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: p.system }] },
          contents: [{ role: "user", parts: [{ text: p.prompt }] }],
          generationConfig: { maxOutputTokens: p.maxOutputTokens },
        }),
      },
      provider,
    );
    const cand = (body.candidates as { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] | undefined)?.[0];
    const text = (cand?.content?.parts ?? []).filter((x) => !x.thought).map((x) => x.text ?? "").join("").trim();
    if (!text) throw new ProviderError(`Gemini returned no text${cand?.finishReason ? ` (${cand.finishReason})` : ""}.`, 502);
    return text;
  }
  const body = await call(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.prompt },
        ],
        max_completion_tokens: p.maxOutputTokens,
      }),
    },
    provider,
  );
  const choice = (body.choices as { message?: { content?: string }; finish_reason?: string }[] | undefined)?.[0];
  const text = (choice?.message?.content ?? "").trim();
  if (!text) throw new ProviderError(`OpenAI returned no text${choice?.finish_reason ? ` (${choice.finish_reason})` : ""}.`, 502);
  return text;
}
