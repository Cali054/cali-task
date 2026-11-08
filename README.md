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
| `src/app/page.tsx` | Public landing page at `/` (sections in `src/components/landing`) |
| `src/app/(app)/*` | App pages: Overview (`/dashboard`), My Tasks, Sprint Board, Timeline, Blocked Tasks, Reports, Settings |
| `src/components/landing` | Landing sections and the app previews they show. Preview data is fixed in `preview-data.ts`; it never reads a real workspace |

## Brand

The logo lives in `public/brand`, and everything shows it through `src/components/brand`:

| Component | Use |
|---|---|
| `CaliLogo` | Emblem + wordmark. Props: `height`, `variant` (`primary`, `mono`), `tone`, `tagline` |
| `CaliLogoIcon` | Emblem only. Props: `size`, `variant` (`gradient`, `mono`), `float`, `glow` |
| `CaliSplashScreen` | The intro |
| `CaliLoadingIndicator` | Loading state |

All assets, including the favicons, are generated from `design/logo/cali-logo-source.webp` by
`design/logo/build_brand_assets.py`. The source is a raster image, so there's no true SVG logo yet; with a
vector or higher-resolution original, replace the source (and the coordinates at the top of the script).

## Accounts & sign-in

**Google sign-in** needs a Supabase project and a Google OAuth client. See [docs/google-sign-in-setup.md](docs/google-sign-in-setup.md). Google accounts store their profile and workspace in Supabase Postgres behind Row Level Security, so they sync across devices. Email/password accounts below stay on the device.

On a new browser session the intro plays, then hands off to `/login` (or straight to the dashboard if you
chose "Remember me"). Routes:

| Route | What |
|---|---|
| `/login` | Email/username + password, show/hide, Remember me, inline validation, error shake |
| `/signup` | Full name, email, username, password (strength meter) + confirm, required consent checkbox |
| `/forgot-password` | Resets a password by confirming the account's email **and** username |
| `/auth/callback` | Finishes **Continue with Google** (Supabase Auth, OAuth PKCE) and opens the dashboard |
| `/privacy-policy`, `/terms-and-conditions` | Full legal pages; the same text opens in a glass modal during signup |

Accounts are stored in this browser (`cali-task:users`). Passwords are salted and hashed with PBKDF2-SHA-256
via Web Crypto, never stored in plain text. Each account has its own workspace
(`cali-task:workspace:<userId>`). At signup the user's consent is recorded with the document version and an
acceptance timestamp; it's shown in Settings → Profile.

Email/password accounts could move to Supabase Auth too (`authAdapter` in `src/lib/auth.ts`), which would
also give them an emailed password-reset link.

**Legal documents:** the owner, contact email and jurisdiction are set in `src/lib/legal.ts`. Bump `version`
whenever you edit the documents.

## Persistence

Data is stored in the browser's `localStorage`, one workspace per account. To use a real database, implement
the `StateStorage` interface (`getItem` / `setItem` / `removeItem`) in `src/lib/persistence.ts` against
your API. Nothing else needs to change. Settings → Data can export, import, or reset the workspace as JSON.

## Planning metrics

Sprint 2's committed target is "2–3 days + testing", but its task estimates add up to 6 days. The Overview
"Planning check" card shows both numbers side by side and flags the gap.
