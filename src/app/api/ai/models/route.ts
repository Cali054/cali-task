import { authenticate, isProvider, json, listModels, loadKey, ProviderError } from "@/lib/server/ai";

/** Text models available to the user's saved key: GET ?provider=gemini|openai */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const provider = new URL(req.url).searchParams.get("provider");
  if (!isProvider(provider)) return json(400, { error: "Choose Gemini or OpenAI." });
  const key = await loadKey(auth.sb, auth.user.id, provider);
  if (key instanceof Response) return key;
  try {
    return json(200, { models: await listModels(provider, key) });
  } catch (e) {
    return json(e instanceof ProviderError ? e.status : 502, { error: e instanceof Error ? e.message : "Couldn't list models." });
  }
}
