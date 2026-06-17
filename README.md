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

Friends, leaderboards, private squads, invite-only friend challenges, and the social activity feed use separate Supabase tables for profiles, friendships, challenge summaries, squad definitions, squad members, challenge definitions, challenge participants, and friend events. Friends can compare completion, streak, and logged-day stats according to each user's privacy settings, but raw entries, reflections, weight, and calories are not shared.

Current social beta coverage:

- Challenge detail panels with participants, pending invites, shared settings, publishing state, score notes, and reactions.
- Active challenge lists plus a completed challenge archive for friend-versus-friend history.
- Editable squads with roster changes after creation.
- Challenge invite management for adding accepted friends after a challenge starts.
- In-app badges for pending friend requests and challenge invites.
- Stored social events for a richer friend/squad activity feed.
- Challenge templates with preset target and scored-rule overrides.
- Friend profile panels with recent scores, shared squads, shared challenges, and head-to-head stats.

## Next recommended milestones

1. Add true per-day challenge history snapshots so detail pages can show daily timelines, not just latest published summaries.
2. Add challenge/squad removal flows for individual participants and pending invites.
3. Add direct challenge links or invite codes so friends can join from a shared URL.
4. Add comment threads or lightweight replies if score reactions become too limited.
5. Add push notifications later if you decide closed-app reminders are worth the setup.
6. Split the large `App.tsx` into feature modules and add route-level or feature-level code splitting if the bundle keeps growing.
7. Add automated tests around Supabase row normalization, challenge templates, invite flows, and privacy-safe summaries.
