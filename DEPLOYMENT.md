# Deployment — Supabase + Vercel + PWA

This is the exact path from this repository to a production URL. The steps marked **(you)** need your accounts. Nothing here has been deployed yet, and no credentials exist in the repo.

## 0. What you need

- A Supabase account (the free tier is enough) and a Vercel account, both signing in with GitHub.
- The GitHub repo `Axora3/english_words` (already set as `origin`). It is currently empty.
- Node.js 20+ locally (`npm ci`, `npm test`, `npm run build`).

## 1. Create the Supabase project **(you)**

1. At https://supabase.com/dashboard, click **New project**. Name it `english-words`, choose a region close to your users, and set a strong database password. Store that password in your password manager; the app never needs it.
2. Open **SQL Editor → New query**. Paste the whole of `supabase/migrations/20261117000100_initial_schema.sql` and click **Run**. The migration only creates objects; it never drops or alters existing data. It creates:
   - the tables `profiles`, `learning_states` and `cloud_backups`, with Row Level Security enabled on all three;
   - the functions `push_learning_state` and `delete_my_account`;
   - the triggers that create a profile for each new user and keep at most 30 backups per user.
   If you later install the Supabase CLI, `supabase db push` applies the same file.
3. **Authentication → URL Configuration:**
   - **Site URL:** your production URL, e.g. `https://english-words.vercel.app`.
   - **Redirect URLs:** add `https://english-words.vercel.app/**`, `https://*-<your-vercel-team>.vercel.app/**` (Vercel preview builds) and `http://localhost:5173/**`.
4. **Authentication → Providers → Email:** keep it enabled with **Confirm email** turned on. Magic links and password recovery use the same provider. The built-in mailer has low rate limits; configure your own SMTP under **Authentication → Emails** before real launch.
5. **Project Settings → API:** copy the **Project URL** and the **anon public** (or **publishable**) key. Do **not** copy `service_role` or any `sb_secret_…` key. The build refuses to ship them.

## 2. Local configuration **(you)**

```sh
cp .env.example .env.local     # .env.local is git-ignored
# edit .env.local:
# SUPABASE_URL=https://<project-ref>.supabase.co
# SUPABASE_ANON_KEY=<anon or publishable key>
npm ci
npm run dev                    # http://localhost:5173 — Settings → Account & sync
```

Check the setup locally:
1. Create an account and confirm the email.
2. Sign in and choose how to handle this device's progress.
3. Press **Sync now**.
4. In the Supabase **Table Editor**, `learning_states` should now have one row for your user. With RLS on, other users can't see it.

## 3. Push the code **(you, or ask me to, after reviewing)**

The work is on local branches: `chore/codebase-audit` and `feat/supabase-pwa`. Pushing publishes the code to GitHub, so it waits for your OK. A typical sequence (no force pushes):

```sh
git push -u origin feat/supabase-pwa
```

Then open a pull request into `main` on GitHub. `main` currently only has the pre-audit checkpoint.

## 4. Vercel project **(you)**

1. At https://vercel.com/new, choose **Import Git Repository** and select `Axora3/english_words`.
2. The framework preset is **Other**. The build settings come from `vercel.json`:
   - install `npm ci`;
   - build `npm run build`;
   - output `dist`.
3. Under **Environment Variables** (Production and Preview), set:

   | Name | Value | Notes |
   | --- | --- | --- |
   | `SUPABASE_URL` | `https://<project-ref>.supabase.co` | public |
   | `SUPABASE_ANON_KEY` | anon / publishable key | public, protected by RLS |

   Without them, the build still succeeds and the app runs in local-only mode.
4. **Deploy.** Vercel serves HTTPS automatically. `vercel.json` adds security headers and `no-cache` for `sw.js`, `config.js`, `index.html` and the manifest. The app uses `#hash` routes, so no SPA rewrite is needed.
5. Optional: add a custom domain under **Settings → Domains**. That involves DNS changes at your registrar, which are yours to make. Then add the domain to the Supabase redirect URLs.

## 5. Production checklist

| Item | How to verify | Status |
| --- | --- | --- |
| Production build passes | `npm run build` (CI on Vercel) | ✅ locally |
| Unit / integration tests | `npm test`: 84 tests, including migrations and RLS on real PostgreSQL (PGlite) | ✅ locally |
| Env vars configured | Vercel → Settings → Environment Variables | ⏳ you |
| Migration applied | Supabase → Table Editor shows 3 tables, all marked "RLS enabled" | ⏳ you |
| RLS verified on the real project | Sign in as two different test users; each sees only their own row | ⏳ after setup |
| Auth flows | Sign up + confirm, sign in, magic link, reset password, sign out | ⏳ after setup |
| Sync | Two browsers on one account: edit offline in both, reconnect, both changes present | ⏳ after setup |
| Manifest / icons | Chrome DevTools → Application → Manifest shows no errors and installability passes | ⏳ on HTTPS URL |
| Service worker | DevTools → Application → Service Workers: active, cache `english-words-shell-<hash>` | ✅ locally |
| Offline | DevTools "Offline", reload: learn, review, grammar work | ✅ locally (server stopped) |
| HTTPS | Automatic on Vercel | ⏳ |
| Install on Android / iPhone / desktop | See README "Install the app" | ⏳ needs devices |
| Production URL | Opens, no console errors | ⏳ |

## 6. Recovery and backups

- **On the device:** Settings → Backup & restore → Export downloads a complete JSON backup. Import restores it after confirmation; invalid files are rejected and the data is left unchanged.
- **In the cloud:** Account & sync → Cloud backups → **Back up now**.
  - Restoring a backup first saves the current progress as a "Before restore" backup.
  - Choosing "Use this device's progress" on first sync first saves the cloud copy as a "Before replace" backup.
  - The newest 30 backups are kept.
- **First sync:** the device's pre-sync copy stays on the device until you discard it, and can be downloaded as JSON.
- **Database:** Supabase daily backups depend on your plan. For a manual snapshot, use **Database → Backups** in the Supabase dashboard, or `pg_dump` with the database password (never put it in this repo).
- **Rollback:** Vercel → Deployments → previous deployment → **Promote to Production**. Installed apps pick up the rollback as an update, because the service-worker version is a hash of the deployed files.
