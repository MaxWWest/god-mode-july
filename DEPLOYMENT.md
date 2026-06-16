# Deployment

## Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run `supabase-schema.sql`. This creates the cloud snapshot, profile, friendship, and leaderboard summary tables, plus the RLS policies for sync, friends, export, and cloud-data deletion.
   - If you already ran an older version, run the current file again. It uses `create table if not exists`, `add column if not exists`, and policy replacement so existing app data is preserved.
3. In Authentication > URL Configuration, add your local and hosted app URLs:
   - `http://localhost:5173`
   - your production URL, for example `https://your-app.vercel.app`
4. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` using the Supabase publishable/anon client key, not a secret key
   - `VITE_VAPID_PUBLIC_KEY` from `npm run push:keys`
   - `VAPID_PRIVATE_KEY` from `npm run push:keys`
   - `VAPID_SUBJECT`, usually `mailto:you@example.com`
   - `CRON_SECRET`, a long random string used to protect the reminder endpoint
   - `SUPABASE_SERVICE_ROLE_KEY` for Vercel Functions only; never expose it in client-side code

## Local cloud test

```bash
npm install
npm run dev
```

Open the app, go to Settings, send yourself a magic link, then use Push Local and Pull Cloud.

For friends, sign in on two accounts, publish a score from the Friends tab, send a request with the other account's invite code, then accept it from the receiving account.

## Vercel or Netlify

Use these build settings:

- Build command: `npm run build`
- Publish directory: `dist`

Add the same Supabase env vars in the host dashboard. After deploy, add the deployed URL to Supabase Authentication > URL Configuration.

For closed-app push reminders, also add the push env vars from `.env.example` in Vercel. Vercel Cron uses `vercel.json` to call `/api/send-reminders` every 15 minutes. The endpoint checks `CRON_SECRET`, loads enabled push subscriptions from Supabase, and sends each device at most once per local day.

## Reminder limits

Local browser notifications run while the app is open. Closed-app push reminders require a deployed HTTPS PWA, a signed-in user, notification permission, Vercel Cron, and a browser/device that supports Web Push. On iPhone, install the PWA to the Home Screen before enabling push reminders.
