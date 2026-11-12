"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AI_PROVIDER_LABEL, deleteAiKey, getAiKeys, saveAiKey, type AiKeyStatus, type AiProvider } from "@/lib/automation/ai-client";
import { fmtDateTime } from "@/lib/utils";
import { Button, CardHeader, GlassCard } from "@/components/ui/glass";

const HELP: Record<AiProvider, { url: string; text: string }> = {
  gemini: { url: "https://aistudio.google.com/apikey", text: "Get a key in Google AI Studio (has a free tier)." },
  openai: { url: "https://platform.openai.com/api-keys", text: "Get a key in the OpenAI platform (billed per use)." },
};

/**
 * Bring-your-own AI keys. Keys go straight to Cali's server, which checks them
 * with the provider and stores them encrypted. They're never shown again.
 */
export function AiKeysCard() {
  const user = useAuth((s) => s.user);
  const google = user?.provider === "google";
  const [keys, setKeys] = useState<AiKeyStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!google) return;
    let live = true;
    getAiKeys().then(
      (r) => {
        if (!live) return;
        setKeys(r.keys);
        if (!r.ready) setError("The server isn't set up for AI keys yet (AI_KEYS_SECRET is missing).");
      },
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [google]);

  return (
    <GlassCard className="scroll-mt-24 p-5" id="ai-keys">
      <CardHeader title="AI keys" subtitle="For the AI Write Text automation step" icon={KeyRound} />
      {!google ? (
        <p className="mt-4 text-sm text-fg-2">
          AI steps need a Google account, so your key can be stored encrypted on the server instead of in this browser. Sign in with Google to use them.
        </p>
      ) : (
        <>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-fg-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-st-done" />
            Your key is checked with the provider, then encrypted on Cali&apos;s server. It&apos;s never shown again or sent back to your browser, and AI usage is billed to your own
            provider account.
          </p>
          {error && <p className="mt-3 rounded-xl bg-st-blocked/10 px-3 py-2 text-xs text-st-blocked">{error}</p>}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(["gemini", "openai"] as AiProvider[]).map((p) => (
              <ProviderKey
                key={p}
                provider={p}
                status={keys?.find((k) => k.provider === p) ?? null}
                loading={!keys && !error}
                onChange={(s) => setKeys((ks) => (ks ?? []).filter((k) => k.provider !== p).concat(s))}
              />
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}

function ProviderKey({
  provider,
  status,
  loading,
  onChange,
}: {
  provider: AiProvider;
  status: AiKeyStatus | null;
  loading: boolean;
  onChange: (s: AiKeyStatus) => void;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy("save");
    setMsg(null);
    try {
      const r = await saveAiKey(provider, value.trim());
      onChange({ provider, saved: true, last4: r.last4, updatedAt: new Date().toISOString() });
      setValue("");
      setMsg({ tone: "ok", text: "Key verified and saved." });
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Couldn't save the key." });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setMsg(null);
    try {
      await deleteAiKey(provider);
      onChange({ provider, saved: false, last4: null, updatedAt: null });
      setMsg({ tone: "ok", text: "Key removed." });
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Couldn't remove the key." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={save} className="glass-soft space-y-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{AI_PROVIDER_LABEL[provider]}</p>
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-fg-3" />
        ) : status?.saved ? (
          <span className="rounded-full bg-st-done/15 px-2 py-0.5 text-[11px] font-semibold text-st-done">Saved ••••{status.last4}</span>
        ) : (
          <span className="rounded-full bg-[var(--glass-line)] px-2 py-0.5 text-[11px] text-fg-3">Not set</span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            className="field pr-10 font-mono text-xs"
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            maxLength={300}
            placeholder={status?.saved ? "Paste a new key to replace it" : "Paste your API key"}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`${AI_PROVIDER_LABEL[provider]} API key`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-fg-3 hover:text-fg"
            aria-label={show ? "Hide key" : "Show key"}
          >
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <Button type="submit" variant="primary" size="md" disabled={!value.trim() || busy !== null}>
          {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-3">
        <a href={HELP[provider].url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {HELP[provider].text}
        </a>
        {status?.saved && (
          <span className="flex items-center gap-2">
            {status.updatedAt && <span>Updated {fmtDateTime(status.updatedAt)}</span>}
            <button type="button" onClick={remove} disabled={busy !== null} className="inline-flex items-center gap-1 font-medium text-fg-2 hover:text-st-blocked">
              <Trash2 className="size-3" /> Remove
            </button>
          </span>
        )}
      </div>
      {msg && <p className={msg.tone === "ok" ? "text-xs text-st-done" : "text-xs text-st-blocked"}>{msg.text}</p>}
    </form>
  );
}
