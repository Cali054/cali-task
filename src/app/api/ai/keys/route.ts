import { AI_PROVIDERS, authenticate, encrypt, encryptionReady, isProvider, json, listModels, ProviderError } from "@/lib/server/ai";

/**
 * The signed-in user's AI provider keys.
 * GET    → which providers have a key (last 4 characters only)
 * POST   → { provider, apiKey }: checks the key with the provider, then stores it encrypted
 * DELETE → ?provider=gemini|openai
 * Keys are never returned to the browser.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { data, error } = await auth.sb.from("ai_keys").select("provider, last4, updated_at").eq("user_id", auth.user.id);
  if (error) return json(503, { error: "AI key storage is missing. Run the AI keys migration in Supabase.", ready: false });
  return json(200, {
    ready: encryptionReady(),
    keys: AI_PROVIDERS.map((p) => {
      const row = (data ?? []).find((r) => r.provider === p);
      return { provider: p, saved: !!row, last4: row?.last4 ?? null, updatedAt: row?.updated_at ?? null };
    }),
  });
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  if (!encryptionReady()) return json(501, { error: "AI keys aren't set up on the server yet (AI_KEYS_SECRET is missing)." });
  const body = (await req.json().catch(() => ({}))) as { provider?: unknown; apiKey?: unknown };
  if (!isProvider(body.provider)) return json(400, { error: "Choose Gemini or OpenAI." });
  const key = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (key.length < 20 || key.length > 300 || /\s/.test(key)) return json(400, { error: "That doesn't look like an API key." });

  // Prove the key works before saving it.
  let models: { id: string; label: string }[];
  try {
    models = await listModels(body.provider, key);
  } catch (e) {
    return json(e instanceof ProviderError ? e.status : 502, { error: e instanceof Error ? e.message : "Couldn't check the key." });
  }

  const { error } = await auth.sb.from("ai_keys").upsert(
    { user_id: auth.user.id, provider: body.provider, ciphertext: encrypt(key), last4: key.slice(-4) },
    { onConflict: "user_id,provider" },
  );
  if (error) return json(503, { error: "Couldn't save the key. Run the AI keys migration in Supabase." });
  await auth.sb.from("workflow_audit_log").insert({ user_id: auth.user.id, action: "ai_key_saved", detail: `Saved a ${body.provider} API key (…${key.slice(-4)}).` });
  return json(200, { ok: true, last4: key.slice(-4), models: models.length });
}

export async function DELETE(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const provider = new URL(req.url).searchParams.get("provider");
  if (!isProvider(provider)) return json(400, { error: "Choose Gemini or OpenAI." });
  const { error } = await auth.sb.from("ai_keys").delete().eq("user_id", auth.user.id).eq("provider", provider);
  if (error) return json(503, { error: "Couldn't remove the key." });
  await auth.sb.from("workflow_audit_log").insert({ user_id: auth.user.id, action: "ai_key_removed", detail: `Removed the ${provider} API key.` });
  return json(200, { ok: true });
}
