# God Mode July

A mobile-first React + TypeScript progressive web app for tracking daily discipline, fitness, and nutrition habits without a fixed end date.

## Included in this starter

- Vite + React + TypeScript
- Installable PWA manifest and service worker
- Responsive dark/purple interface
- Daily rule checklist
- Detailed check-in form
- Configurable tracker title and start date
- Exercise, diet, mental, and miscellaneous scored rule categories
- Repeating 1-day, 7-day, and 30-day exercise patterns with scheduled training days, workout type, and minutes
- Weekday-aware 7-day plans with recovery-day and next-workout guidance
- Current-cycle exercise progress with completed, missed, and upcoming training dates
- Common and custom diet goals with minimum, maximum, or avoid scoring plus custom units
- Editable rules, goals, categories, and rule weights
- Monthly calendar heatmap inside Progress
- Rule completion analytics
- Last-7-day and last-30-day progress reviews
- Weight, sleep, calorie, and mood trend charts
- JSON backup and restore
- CSV entry export
- Supabase email/password auth and cloud sync
- Multi-device conflict detection and resolution
- Offline status with retryable cloud and social errors
- Account data JSON export and cloud data deletion controls
- Friends list with invite-code requests
- Friend request accept/decline flow
- Share-safe leaderboard competition
- Friend privacy controls for published stats
- Better invite sharing with copy/share text
- Invite-only custom friend challenges
- Published per-day friend challenge score history
- Challenge templates for common competition formats
- Private challenge squads
- Squad-specific leaderboards
- Friend and squad activity feed
- Tabbed Friends dashboard
- Password reset flow
- Local daily notification reminders
- Automatic localStorage persistence
- PWA icons
- Five-tab navigation: Home, Check-In, Progress, Social, and Settings
- Separate Rules + Goals and App + Account settings views
- Six-step onboarding for daily tracking, exercise patterns, diet goals, progress, and Social

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

## Run automated tests

```bash
npm test
```

Vitest covers weighted tracker scoring, exercise pattern scheduling and cycle progress, next-workout lookup, flexible diet goals, settings normalization, privacy-safe publishing, challenge template overrides, daily challenge snapshots, Supabase row normalization, transient-error retry behavior, and mocked friend/squad/challenge mutations.

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

Friends, leaderboards, private squads, invite-only friend challenges, daily challenge score history, and the social activity feed use separate Supabase tables. Feed comments and reactions inherit the visibility of their parent event. Friends can compare completion, streak, logged-day stats, and explicitly published per-day challenge percentages, but raw entries, reflections, weight, and calories are not shared.

Exercise rules use repeating cycles anchored to the tracker start date. A rule can run daily or on selected days within a 7-day or 30-day pattern. Seven-day patterns display weekdays, Home and Check-In identify recovery days, and Progress summarizes the current cycle. Diet rules can require at least a target, stay at or below a target, or avoid an item entirely. Existing alcohol, calorie, protein, water, and workout data is normalized into the new model when local backups or cloud snapshots load.

## Code organization

- `src/types.ts` holds shared tracker, cloud sync, friends, squads, challenge, and feed types.
- `src/ui.tsx` holds reusable field controls, section headers, app notices, icons, and bottom-nav buttons.
- `src/social.ts` holds shared friend challenge templates, reactions, tabs, and social labels.
- `src/socialData.ts` holds social score calculations, challenge settings, row normalizers, and Supabase schema compatibility checks.
- `src/tracker.ts` holds shared tracker defaults, rule scoring, date helpers, backup/import/export helpers, and data normalizers.
- `src/services/socialApi.ts` owns profile, friendship, squad, challenge, leaderboard, and activity-feed database operations.
- `src/services/cloudApi.ts` owns cloud snapshots, account export, and cloud account deletion operations.
- `src/services/reliability.ts` classifies transient failures and retries safe cloud/social operations.
- Tracker, social-data, reliability, and mocked social-service tests cover the highest-risk scoring, privacy, history, normalization, retry, and mutation behavior.
- `src/features/CheckInView.tsx`, `src/features/SettingsView.tsx`, `src/features/FriendsView.tsx`, and `src/features/ProgressView.tsx` are lazy-loaded feature chunks so the initial PWA bundle stays below Vite's warning threshold.
- `src/App.tsx` owns app state, user-facing validation and notices, auth/sync orchestration, Home, and navigation.

Current social beta coverage:

- Challenge detail panels with participants, pending invites, shared settings, publishing state, score notes, and reactions.
- Active challenge lists plus a completed challenge archive for friend-versus-friend history.
- Editable squads with roster changes after creation.
- Challenge invite management for adding accepted friends after a challenge starts.
- In-app badges for pending friend requests and challenge invites.
- Stored social events with comments, reactions, and device sharing for a richer friend/squad activity feed.
- Challenge templates with preset target and scored-rule overrides.
- Explicit challenge rule selection, including custom tracker rules; accepted challenges add missing controls to the participant's tracker.
- Friend profile panels with recent scores, shared squads, shared challenges, and head-to-head stats.
- Per-participant daily score timelines stored when challenge scores are published.

## Recommended roadmap

### Beta reliability completed

1. Consistent retryable error states now cover failed sync and social requests, with a clear offline banner and local-data reassurance.
2. Safe reads and upserts retry transient network, timeout, rate-limit, and server failures without replaying non-idempotent creation actions.
3. Service tests now cover friend-request, squad, and challenge mutations with a mocked Supabase client.

### Next: beta test automation

1. Add an automated browser smoke test for account sign-in, daily check-in, local persistence, and sign-out.
2. Add a seeded two-account browser test for friend requests and the challenge accept/publish flow.
3. Run a small real-device beta matrix across iPhone Safari, installed iPhone PWA, and desktop Chrome.

### Then: stronger competition

1. Add direct challenge links or short join codes so an accepted friend can open the app directly to an invite.
2. Add owner controls for removing participants, canceling pending invites, leaving challenges, and removing squad members safely.
3. Add challenge lifecycle controls for editing upcoming challenges, ending active challenges early, and archiving or deleting completed challenges.
4. Add notification badges for new comments and reactions since the feed was last opened.

### Later: engagement

1. Add lightweight replies or comments only if score reactions prove too limited during friend testing.
2. Add optional closed-app push notifications only if the extra backend and delivery setup becomes worthwhile; local open-app reminders remain the current default.
3. Consider custom profile photos, achievement badges, and broader discovery only after private friend competition feels reliable.
