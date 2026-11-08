# Google sign-in setup (Supabase)

Cali's "Continue with Google" button uses **Supabase Auth**. The code is already in the app; these steps create the accounts and keys it needs. It takes about 15 minutes. Until it's done, the Google button shows "Google sign-in isn't set up for this app yet" and email/password accounts keep working as before.

You'll need:
- your **Vercel URL** (for example `https://cali-task.vercel.app`)
- a Google account

## 1. Create the Supabase project

1. Go to <https://supabase.com>, sign in, and click **New project**. Choose a region close to your users (Singapore for the Philippines) and set a database password. Keep the password somewhere safe; the app doesn't need it.
2. When the project is ready, open **SQL Editor → New query**. Paste the contents of `supabase/migrations/20261108000000_profiles_and_workspaces.sql` and click **Run**. This creates the `profiles` and `workspaces` tables, turns on Row Level Security, and adds the triggers that create a profile on first sign-in.
3. Open **Project Settings → API** (or **Connect**) and copy:
   - **Project URL**: this becomes `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (or the legacy **anon** key): this becomes `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   Do **not** copy the `service_role` / secret key anywhere in this project.

## 2. Create the Google OAuth client

1. Go to <https://console.cloud.google.com>, then create or select a project.
2. Open **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding):
   - App name: `Cali`, support email: your email, and upload the logo (`public/brand/icon-512.png`) if you like.
   - Under **Audience**, choose **External**.
   - Under **Data access**, the scopes are `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`. These are the basic profile and email; no sensitive scopes are requested.
   - App domain links: your Vercel URL, plus `/privacy-policy` and `/terms-and-conditions`.
3. Open **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `http://localhost:3000` and your Vercel URL.
   - **Authorized redirect URIs**: the callback URL shown in Supabase under **Authentication → Sign In / Providers → Google**. It looks like `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Copy the **Client ID** and **Client secret**.

## 3. Turn on Google in Supabase

1. In Supabase, open **Authentication → Sign In / Providers → Google**. Enable it and paste the Client ID and Client secret, then save. The secret stays inside Supabase and is never sent to the browser.
2. Open **Authentication → URL Configuration**:
   - **Site URL**: your Vercel URL.
   - **Redirect URLs**: add these:
     - `http://localhost:3000/auth/callback`
     - `https://<your-vercel-domain>/auth/callback`
     - optional, for preview deployments: `https://*-<your-vercel-team>.vercel.app/auth/callback`

## 4. Add the keys to the app

**On your computer:** copy `.env.example` to `.env.local` in the `cali-task` folder and fill in the two values. Restart `npm run dev`.

**On Vercel:** open **Project → Settings → Environment Variables** and add the same two variables for Production (and Preview if you use it). Then redeploy, because Next.js reads them at build time.

## 5. Try it

1. Open `/login` and click **Continue with Google**.
2. Choose your account. You land on `/dashboard` with your Google name, photo and email in the top-right menu.
3. In Supabase **Table Editor → profiles**, you'll see one row for you, with your Google ID, verification status and consent version.
4. Sign in again later, or on another device: you get the same profile and the same workspace. No duplicate is created.

## How it works

| Piece | Where |
|---|---|
| Google button, `OrDivider`, consent note | `src/components/auth/auth-ui.tsx` |
| Starting the redirect, finishing it, loading the profile | `src/lib/auth.ts` (`signInWithGoogle`, `completeGoogleSignIn`) |
| OAuth return page | `src/app/(auth)/auth/callback/page.tsx` |
| Supabase browser client (PKCE flow) | `src/lib/supabase.ts` |
| Workspace sync to Postgres | `src/lib/cloud-sync.ts`, `bindWorkspace` in `src/lib/store.ts` |
| Tables, Row Level Security, triggers | `supabase/migrations/` |

- **No duplicate accounts.** Supabase links a Google login to an existing Supabase user with the same verified email. `profiles.id` is the Supabase user id, so each user has exactly one profile, created by a database trigger rather than by the browser.
- **One workspace.** On the first Google sign-in, if this browser has an email/password account with the same email, its tasks are carried over to the cloud workspace instead of starting empty.
- **Privacy.** Row Level Security limits every query to the signed-in user's own rows. The browser can change only its own `display_name`, and record consent through `record_consent()`, which stamps the time on the server. Cali never sees a Google password.
- **Sessions.** Supabase keeps the session (a short-lived JWT access token plus a refresh token) and refreshes it automatically, so users stay signed in across visits until they log out.

## Troubleshooting

| You see | Fix |
|---|---|
| "Google sign-in isn't set up for this app yet" | The env variables are missing. Add them, then restart the dev server or redeploy. |
| Google says `redirect_uri_mismatch` | The Supabase callback URL (step 2.3) isn't in the Google client's Authorized redirect URIs. |
| You land on the Vercel home page instead of the dashboard | `…/auth/callback` for that domain isn't in Supabase's Redirect URLs (step 3.2). |
| "This sign-in link has expired" | The sign-in was started in a different browser or tab profile. Start again from the same browser. |
| Signed in, but your name and photo are missing | The SQL in step 1.2 wasn't run, so there's no `profiles` table. Run it and sign in again. |
