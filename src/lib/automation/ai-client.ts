"use client";

import { accessToken } from "./cloud";

export type AiProvider = "gemini" | "openai";
export const AI_PROVIDER_LABEL: Record<AiProvider, string> = { gemini: "Google Gemini", openai: "OpenAI (GPT)" };

export interface AiKeyStatus {
  provider: AiProvider;
  saved: boolean;
  last4: string | null;
  updatedAt: string | null;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken().catch(() => null);
  if (!token) throw new Error("Sign in with Google to use AI keys.");
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status}).`);
  return body;
}

export const getAiKeys = () => api<{ ready: boolean; keys: AiKeyStatus[] }>("/api/ai/keys");

export async function saveAiKey(provider: AiProvider, apiKey: string) {
  const r = await api<{ ok: boolean; last4: string }>("/api/ai/keys", { method: "POST", body: JSON.stringify({ provider, apiKey }) });
  modelCache.delete(provider);
  return r;
}

export async function deleteAiKey(provider: AiProvider) {
  modelCache.delete(provider);
  return api<{ ok: boolean }>(`/api/ai/keys?provider=${provider}`, { method: "DELETE" });
}

const modelCache = new Map<AiProvider, Promise<{ id: string; label: string }[]>>();

/** Models the saved key can use (cached for the session). */
export function getAiModels(provider: AiProvider) {
  let p = modelCache.get(provider);
  if (!p) {
    p = api<{ models: { id: string; label: string }[] }>(`/api/ai/models?provider=${provider}`).then((r) => r.models);
    p.catch(() => modelCache.delete(provider));
    modelCache.set(provider, p);
  }
  return p;
}
