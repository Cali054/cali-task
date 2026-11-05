# Cali's Task

**Plan. Track. Complete.** A personal task and sprint monitoring dashboard with a liquid-glass look.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. Production build: `npm run build && npm start`.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **Tailwind CSS v4.** Design tokens and glass primitives live in `src/app/globals.css`.
- **Motion** handles the intro, page entrances, the nav highlight, and card movement.
- **Radix Dialog** powers the glass modals, written as shadcn-style primitives in `src/components/ui`.
- **Lucide** icons
- **Recharts** draws the burndown, estimated vs. actual, daily productivity, and completion history charts.
- **dnd-kit** drives the Kanban drag-and-drop (mouse, touch and keyboard).
- **Zustand** is the app state.

## Where things are

| Path | What |
|---|---|
| `src/lib/types.ts` | Data model (Task, Sprint, Blocker, TimeLog, Activity) |
| `src/lib/seed.ts` | Sprint 2 sample data (the 7 imported tasks) |
| `src/lib/store.ts` | All actions: CRUD, status transitions, blockers, time logs, sprints |
| `src/lib/persistence.ts` | **Storage adapter.** This is the one place to swap in a real backend. |
| `src/lib/metrics.ts` | Sprint metrics, burndown, and daily productivity |
| `src/components/shell` | Intro, sidebar, mobile drawer, top bar (search, sprint selector, notifications, profile) |
| `src/components/dialogs` | Task form, task detail, blocker, progress, and sprint modals |
| `src/app/*` | Pages: Overview, My Tasks, Sprint Board, Timeline, Blocked Tasks, Reports, Settings |

## Accounts & sign-in

On a new browser session the intro plays, then hands off to `/login` (or straight to the dashboard if you
chose "Remember me"). Routes:

| Route | What |
|---|---|
| `/login` | Email/username + password, show/hide, Remember me, inline validation, error shake |
| `/signup` | Full name, email, username, password (strength meter) + confirm, required consent checkbox |
| `/forgot-password` | Resets a password by confirming the account's email **and** username |
| `/privacy-policy`, `/terms-and-conditions` | Full legal pages; the same text opens in a glass modal during signup |

Accounts are stored in this browser (`cali-task:users`). Passwords are salted and hashed with PBKDF2-SHA-256
via Web Crypto, never stored in plain text. Each account has its own workspace
(`cali-task:workspace:<userId>`). At signup the user's consent is recorded with the document version and an
acceptance timestamp; it's shown in Settings → Profile.

To use a real backend, replace the functions in `authAdapter` (`src/lib/auth.ts`). Swap the reset flow for an
emailed token there too. There's no Google sign-in button because no OAuth provider is configured yet.

**Before you publish:** set `contactEmail` and `jurisdiction` in `src/lib/legal.ts` (they're placeholders),
and bump `version` whenever you edit the documents.

## Persistence

Data is stored in the browser's `localStorage`, one workspace per account. To use a real database, implement
the `StateStorage` interface (`getItem` / `setItem` / `removeItem`) in `src/lib/persistence.ts` against
your API. Nothing else needs to change. Settings → Data can export, import, or reset the workspace as JSON.

## Planning metrics

Sprint 2's committed target is "2–3 days + testing", but its task estimates add up to 6 days. The Overview
"Planning check" card shows both numbers side by side and flags the gap.
