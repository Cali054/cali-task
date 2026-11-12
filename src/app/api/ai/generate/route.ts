import { authenticate, generate, isProvider, json, loadKey, ProviderError } from "@/lib/server/ai";

/**
 * Generates text for an "AI Write Text" automation step with the user's own key.
 * Limited to 60 requests per user per hour (counted in the database).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOURLY_LIMIT = 60;
const MODEL_RE = /^[A-Za-z0-9][\w.\-:]{0,99}$/;

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const b = (await req.json().catch(() => ({}))) as { provider?: unknown; model?: unknown; prompt?: unknown; system?: unknown; maxWords?: unknown };
  if (!isProvider(b.provider)) return json(400, { error: "Choose Gemini or OpenAI." });
  const model = typeof b.model === "string" ? b.model.trim() : "";
  if (!MODEL_RE.test(model)) return json(400, { error: "Choose a model." });
  const prompt = typeof b.prompt === "string" ? b.prompt.trim().slice(0, 6000) : "";
  if (!prompt) return json(400, { error: "The prompt is empty." });
  const system = typeof b.system === "string" ? b.system.slice(0, 2000) : "";
  const maxWords = Math.min(800, Math.max(20, Math.round(Number(b.maxWords) || 150)));

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error: countError } = await auth.sb.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (countError) return json(503, { error: "AI storage is missing. Run the AI keys migration in Supabase." });
  if ((count ?? 0) >= HOURLY_LIMIT) return json(429, { error: `AI limit reached (${HOURLY_LIMIT} requests per hour).` });

  const key = await loadKey(auth.sb, auth.user.id, b.provider);
  if (key instanceof Response) return key;
  await auth.sb.from("ai_usage").insert({ user_id: auth.user.id, provider: b.provider, model });

  try {
    // Generous token budget: some models think before answering. Length is steered by the instructions.
    const text = await generate(b.provider, key, { model, system, prompt, maxOutputTokens: Math.max(2048, maxWords * 6) });
    return json(200, { text: text.slice(0, 6000) });
  } catch (e) {
    return json(e instanceof ProviderError ? e.status : 502, { error: e instanceof Error ? e.message : "The AI request failed." });
  }
}
