import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Sends an automation email to the signed-in user.
 *
 * - The caller must send their Supabase access token; it is verified here.
 * - The recipient is always the account's own verified email address, so
 *   this can't be used to send mail to anyone else.
 * - Limited to 20 emails per user per hour (counted in the database), plus
 *   a small per-instance burst limit.
 * - Delivery uses Resend (https://resend.com). Set RESEND_API_KEY and
 *   AUTOMATION_EMAIL_FROM on the server; both stay server-side only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOURLY_LIMIT = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const burst = new Map<string, number[]>();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json(503, { error: "Sign-in service isn't configured." });

  // Same-origin requests only.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return json(403, { error: "Cross-site request refused." });

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return json(401, { error: "Sign in to send email." });

  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await sb.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user) return json(401, { error: "Your session expired. Sign in again." });
  if (!user.email || !user.email_confirmed_at) return json(403, { error: "Your email address isn't verified." });

  let input: { subject?: unknown; body?: unknown; workflowId?: unknown; executionId?: unknown };
  try {
    input = await req.json();
  } catch {
    return json(400, { error: "Invalid request." });
  }
  const subject = typeof input.subject === "string" ? input.subject.replace(/[\r\n]+/g, " ").trim().slice(0, 160) : "";
  const text = typeof input.body === "string" ? input.body.slice(0, 2000) : "";
  if (!subject || !text.trim()) return json(400, { error: "Subject and body are required." });
  const workflowId = typeof input.workflowId === "string" && UUID.test(input.workflowId) ? input.workflowId : null;
  const executionId = typeof input.executionId === "string" && UUID.test(input.executionId) ? input.executionId : null;

  // Burst limit per server instance.
  const nowMs = Date.now();
  const recent = (burst.get(user.id) ?? []).filter((t) => nowMs - t < 60_000);
  if (recent.length >= 5) return json(429, { error: "Too many emails at once. Try again in a minute." });

  // Hourly limit, counted in the database.
  const since = new Date(nowMs - 3_600_000).toISOString();
  const { count, error: countError } = await sb
    .from("workflow_notifications")
    .select("id", { count: "exact", head: true })
    .eq("notification_type", "email")
    .gte("created_at", since);
  if (countError) return json(503, { error: "Automation tables are missing. Run the automation migration in Supabase." });
  if ((count ?? 0) >= HOURLY_LIMIT) return json(429, { error: `Email limit reached (${HOURLY_LIMIT} per hour).` });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTOMATION_EMAIL_FROM;
  if (!apiKey || !from)
    return json(501, { error: "Email delivery isn't set up yet. Add RESEND_API_KEY and AUTOMATION_EMAIL_FROM to the server environment." });

  recent.push(nowMs);
  burst.set(user.id, recent);

  let sendRes: Response;
  try {
    sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject,
        text: `${text}\n\n— Sent by a Cali's Task automation`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#1d1b16">${escapeHtml(text).replace(/\n/g, "<br>")}<p style="color:#8a8578;font-size:12px;margin-top:24px">Sent by a Cali's Task automation</p></div>`,
      }),
    });
  } catch {
    return json(502, { error: "Couldn't reach the email provider." });
  }
  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => "");
    console.warn("[email] provider error", sendRes.status, detail.slice(0, 300));
    return json(sendRes.status >= 500 ? 502 : 400, { error: `The email provider refused the message (${sendRes.status}).` });
  }
  const sent = (await sendRes.json().catch(() => ({}))) as { id?: string };

  const notification = {
    id: randomUUID(),
    workflow_id: workflowId,
    execution_id: executionId,
    user_id: user.id,
    recipient_id: user.id,
    notification_type: "email",
    title: subject,
    message: `Emailed to ${user.email}`,
    task_id: null,
    created_at: new Date().toISOString(),
    read_at: new Date().toISOString(),
  };
  let ins = await sb.from("workflow_notifications").insert(notification);
  if (ins.error?.code === "23503") {
    // The run or workflow isn't in the cloud (e.g. a test of an unsaved draft).
    ins = await sb.from("workflow_notifications").insert({ ...notification, workflow_id: null, execution_id: null });
  }
  if (ins.error) console.warn("[email] could not record notification", ins.error.message);

  return json(200, {
    id: sent.id ?? notification.id,
    to: user.email,
    notification: {
      id: notification.id,
      workflowId,
      executionId,
      recipientId: user.id,
      type: "email",
      title: subject,
      message: notification.message,
      taskId: null,
      createdAt: notification.created_at,
      readAt: notification.read_at,
    },
  });
}
