# God Mode July

A mobile-first React + TypeScript progressive web app for tracking daily discipline, fitness, and nutrition habits without a fixed end date.

## Included in this starter

- Vite + React + TypeScript
- Installable PWA manifest and service worker
- Responsive dark/purple interface
- Daily rule checklist
- Detailed check-in form
- Configurable tracker title and start date
- Editable rules, targets, and rule weights
- Monthly calendar heatmap
- Rule completion analytics
- Last-7-day and last-30-day progress reviews
- Weight, sleep, calorie, and mood trend charts
- JSON backup and restore
- CSV entry export
- Supabase magic-link auth and cloud sync
- Multi-device conflict detection and resolution
- Account data JSON export and cloud data deletion controls
- Friends list with invite-code requests
- Friend request accept/decline flow
- Share-safe leaderboard competition
- Local daily notification reminders
- Closed-app push reminders through Vercel Cron and Web Push
- Automatic localStorage persistence
- PWA icons

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Test the production PWA

```bash
npm run build
npm run preview
```

Install prompts and service-worker behavior are most reliable from the production preview or a deployed HTTPS site.

## Current data model

Entries are stored under this browser key:

```text
god-mode-july-entries-v1
```

Tracker settings are stored under this browser key:

```text
god-mode-july-settings-v1
```

The app still works locally when cloud sync is not configured. Once Supabase env vars are present, Settings exposes magic-link sign-in, Push Local and Pull Cloud sync controls, account data export, and cloud data deletion. If this device and the cloud both changed, the app offers options to use cloud, keep local, or merge cloud-only daily entries.

Cloud sync uses the Supabase table in `supabase-schema.sql` when these Vite env vars are configured:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

See `DEPLOYMENT.md` for Supabase and hosting setup.

Friends and leaderboards use separate Supabase tables for profiles, friendships, and challenge summaries. Friends can compare completion, streak, and logged-day stats, but raw entries, reflections, weight, and calories are not shared.

Closed-app reminders use Web Push. The browser stores a device subscription, Supabase stores that subscription for the signed-in user, and Vercel Cron calls `/api/send-reminders` to send reminders when each device reaches its saved local time.

## Next recommended milestones

1. Challenge groups or small private squads
2. Friend-versus-friend weekly challenge history
