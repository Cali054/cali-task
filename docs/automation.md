# Automation Center

A visual, no-code workflow builder for Cali's Task. Workflows react to task and sprint events, run on a
schedule or on demand, and really change your workspace (tasks, sprints, comments, notifications).

## Setup

1. **Database (Google accounts):** in the Supabase SQL editor, run
   `supabase/migrations/20261112000000_automation.sql`. Until you do, the Automation Center shows a notice
   and keeps workflows in the browser only. Email/password accounts always keep them in the browser.
2. **Email steps (optional):** create a [Resend](https://resend.com) account, verify a sending domain, and add
   two **server-only** environment variables (in `.env.local`, and on Vercel as *Sensitive*):
   - `RESEND_API_KEY`
   - `AUTOMATION_EMAIL_FROM`, e.g. `Cali's Task <automations@yourdomain.com>`

   Redeploy after adding them. Without them, email steps fail with "Email delivery isn't set up yet" and
   everything else works.

## How it works

```
workspace store ──(diff)──▶ events ──▶ matching active workflows ──▶ engine ──▶ workspace store
       ▲                                      ▲                         │
       │                     scheduler / date watchers (1 tab)          ├─▶ notifications (bell)
       └──────────────────────── actions ◀────────────────────────────┘ └─▶ execution history
```

| Piece | File |
| --- | --- |
| Engine (pure TypeScript, runs anywhere) | `src/lib/automation/engine.ts` |
| Node registry: settings, validation, executors | `src/lib/automation/nodes.ts` |
| Fields, `{{templates}}`, conditions | `src/lib/automation/fields.ts` |
| Workflow validation (types, loops, handles) | `src/lib/automation/validate.ts` |
| Runtime: events, scheduler, guards, recording | `src/lib/automation/runtime.ts` |
| Supabase mirror | `src/lib/automation/cloud.ts` |
| Email delivery (server) | `src/app/api/automation/email/route.ts` |
| UI | `src/app/(app)/automation/**`, `src/components/automation/**` |

**Engine.** It starts at the trigger, runs connected steps breadth-first, and passes *items* between them
(each item carries a task and/or sprint plus `vars`). Conditions split items between their TRUE and FALSE
outputs. Every step is recorded with its input, output, duration, attempts and error. The first failure
stops the run. Steps that can fail transiently (email) retry with backoff. Delay steps pause the run and
save its queue, and it resumes later.

**Events.** Task created / updated / status changed / assigned / completed and sprint created are detected
by diffing the workspace store, so every way of changing a task counts (dialogs, board drag, the blocked
page, automations). Bulk replacements (import, reset, sample data) are not events. Deadline approaching,
overdue, sprint started and sprint completed are checked every 30 s.

**Safety**

- No user code or SQL is ever executed. Templates are `{{field}}` lookups on own properties only, and
  operators come from a fixed list.
- Each workflow handles a given event once. Event ids are remembered locally, and in Supabase a unique
  index on `(workflow_id, trigger_event_id)` rejects duplicates from other tabs or devices.
- Loops are prevented in three ways. Workflows can't contain cycles. A workflow isn't triggered by its own
  changes unless allowed. Automation chains stop at depth 3.
- Limits:
  - 200 steps and 30 s of active time per run.
  - At most 50 items changed per action step.
  - 60 runs per workflow per hour.
  - 500 runs per user per hour, enforced by the database.
  - 20 emails per hour.
- The server validates definitions too: a check constraint allows only known step types, at most 60 steps
  and one trigger.
- Every table has Row Level Security limiting rows to their owner. Execution history and the audit log can't
  be rewritten from the browser; only status, result and read markers can change.
- Email goes only to the signed-in account's own verified address. The route verifies the Supabase
  session, accepts same-origin requests only, and keeps its API key on the server.
- Workflow create, save, activate, deactivate, delete, manual runs, live tests and rate-limit pauses are
  written to the audit log.

## Limits to know

- **Automations run in the app.** Scheduled and date-based triggers, and resuming delayed runs, happen
  while Cali is open in a browser, in one tab chosen automatically. When you come back, a missed schedule
  catches up once. Running them with Cali closed needs a server worker, for example a Vercel Cron or
  Supabase Edge Function using the same engine, which hasn't been built yet.
- **Single-user workspaces.** "Notify assignee / sprint owner / project manager" notifies you, the
  workspace owner. The assignee is a free-text name. Real recipients come with team workspaces.
- History keeps the newest 200 runs per account.

## Testing

- `npm run test:automation` runs the engine tests on an in-memory workspace: every template, every action,
  branching, retries, delay/resume, limits and schedules.
- In the builder, **Test → Dry run** runs the workflow on a copy of your workspace and shows each step's
  result on the canvas; **Apply changes** runs it for real.
