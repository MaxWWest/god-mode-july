# God Mode July

A mobile-first React + TypeScript progressive web app for tracking daily discipline, fitness, and nutrition habits without a fixed end date.

## Included in this starter

- Vite + React + TypeScript
- Installable PWA manifest and service worker
- Responsive dark/purple interface
- Daily rule checklist
- Detailed check-in form
- Configurable tracker title and start date
- Activity, exercise, mental, and custom scored rule categories
- Editable rules, targets, and rule weights
- Monthly calendar heatmap
- Rule completion analytics
- Last-7-day and last-30-day progress reviews
- Weight, sleep, calorie, and mood trend charts
- JSON backup and restore
- CSV entry export
- Supabase email/password auth and cloud sync
- Multi-device conflict detection and resolution
- Account data JSON export and cloud data deletion controls
- Friends list with invite-code requests
- Friend request accept/decline flow
- Share-safe leaderboard competition
- Friend privacy controls for published stats
- Better invite sharing with copy/share text
- Invite-only custom friend challenges
- Challenge templates for common competition formats
- Private challenge squads
- Squad-specific leaderboards
- Friend and squad activity feed
- Tabbed Friends dashboard
- Password reset flow
- Local daily notification reminders
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

The app still works locally when cloud sync is not configured. Once Supabase env vars are present, Settings exposes email/password sign-in with magic-link backup, Push Local and Pull Cloud sync controls, account data export, and cloud data deletion. If this device and the cloud both changed, the app offers options to use cloud, keep local, or merge cloud-only daily entries.

Cloud sync uses the Supabase table in `supabase-schema.sql` when these Vite env vars are configured:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

See `DEPLOYMENT.md` for Supabase and hosting setup.

Friends, leaderboards, private squads, and invite-only friend challenges use separate Supabase tables for profiles, friendships, challenge summaries, squad definitions, squad members, challenge definitions, and challenge participants. Friends can compare completion, streak, and logged-day stats according to each user's privacy settings, but raw entries, reflections, weight, and calories are not shared.

## Next recommended milestones

1. Challenge detail view with full participant history, settings, pending invites, and score publishing state.
2. Friend-versus-friend weekly challenge history and completed challenge archive.
3. Editable squads so members can be added or removed after creation.
4. Challenge invite management for adding friends after a challenge starts.
5. Notification-style in-app badges for pending friend and challenge requests.
6. Richer activity feed backed by stored events instead of derived current data.
7. Full challenge templates with preset rule/target overrides, not just name, dates, and scoring mode.
8. Friend profile pages with recent scores, shared squads, and head-to-head stats.
9. Optional comments/reactions on published challenge scores.
10. Performance cleanup with route-level or feature-level code splitting if the bundle keeps growing.
