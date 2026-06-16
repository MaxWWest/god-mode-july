# Deployment

## Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run `supabase-schema.sql`. This creates the cloud snapshot, profile, friendship, and leaderboard summary tables.
3. In Authentication > URL Configuration, add your local and hosted app URLs:
   - `http://localhost:5173`
   - your production URL, for example `https://your-app.vercel.app`
4. Copy `.env.example` to `.env.local` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` using the Supabase publishable/anon client key, not a secret key

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

## Reminder limits

Browser notifications work only after the user grants permission. The in-app reminder scheduler runs while the PWA/app is open; true server-side or push reminders would require a later push-notification backend.
