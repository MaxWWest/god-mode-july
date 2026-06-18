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

## Code organization

- `src/types.ts` holds shared tracker, cloud sync, friends, squads, challenge, and feed types.
- `src/ui.tsx` holds reusable field controls, section headers, app notices, icons, and bottom-nav buttons.
- `src/social.ts` holds shared friend challenge templates, reactions, tabs, and social labels.
- `src/socialData.ts` holds social score calculations, challenge settings, row normalizers, and Supabase schema compatibility checks.
- `src/tracker.ts` holds shared tracker defaults, rule scoring, date helpers, backup/import/export helpers, and data normalizers.
- `src/services/socialApi.ts` owns profile, friendship, squad, challenge, leaderboard, and activity-feed database operations.
- `src/features/CheckInView.tsx`, `src/features/SettingsView.tsx`, `src/features/FriendsView.tsx`, and `src/features/ProgressView.tsx` are lazy-loaded feature chunks so the initial PWA bundle stays below Vite's warning threshold.
- `src/App.tsx` owns app state, user-facing validation and notices, auth/sync orchestration, Home, Calendar, and navigation. The next cleanup step is to extract cloud account export, deletion, and snapshot sync into a dedicated service.

Current social beta coverage:

- Challenge detail panels with participants, pending invites, shared settings, publishing state, score notes, and reactions.
- Active challenge lists plus a completed challenge archive for friend-versus-friend history.
- Editable squads with roster changes after creation.
- Challenge invite management for adding accepted friends after a challenge starts.
- In-app badges for pending friend requests and challenge invites.
- Stored social events for a richer friend/squad activity feed.
- Challenge templates with preset target and scored-rule overrides.
- Friend profile panels with recent scores, shared squads, shared challenges, and head-to-head stats.

## Recommended roadmap

### Next: beta reliability

1. Add Vitest and focused automated coverage for tracker scoring, challenge templates, Supabase row normalization, privacy-safe summaries, friend requests, and challenge invite state changes.
2. Extract cloud snapshots, conflict resolution, account export, and account deletion from `App.tsx` into a dedicated cloud service.
3. Add consistent retryable error states for failed sync and social requests, plus clearer offline status when Supabase cannot be reached.

This should be the next sprint. Auth, cloud sync, privacy, squads, and challenges now share enough behavior that regression protection is more valuable than adding another large feature immediately.

### Then: stronger competition

1. Store per-day challenge score snapshots so challenge detail pages can show real daily timelines instead of only the latest published summary.
2. Add direct challenge links or short join codes so an accepted friend can open the app directly to an invite.
3. Add owner controls for removing participants, canceling pending invites, leaving challenges, and removing squad members safely.
4. Add challenge lifecycle controls for editing upcoming challenges, ending active challenges early, and archiving or deleting completed challenges.

### Later: engagement

1. Add lightweight replies or comments only if score reactions prove too limited during friend testing.
2. Add optional closed-app push notifications only if the extra backend and delivery setup becomes worthwhile; local open-app reminders remain the current default.
3. Consider custom profile photos, achievement badges, and broader discovery only after private friend competition feels reliable.
