# God Mode July

A mobile-first React + TypeScript progressive web app for tracking daily discipline, fitness, and nutrition habits without a fixed end date.

## Current beta capabilities

- Vite + React + TypeScript
- Installable PWA manifest and service worker
- Responsive light/dark interface with customizable accent colors
- Daily rule checklist
- Detailed check-in form
- Configurable tracker title and start date
- Light, dark, or system appearance with five selectable accent colors
- Exercise, diet, mental, and miscellaneous scored rule categories
- Repeating 1-day, 7-day, and 30-day exercise patterns with scheduled training days, workout type, and minutes
- Weekday-aware 7-day plans with recovery-day and next-workout guidance
- Current-cycle exercise progress with completed, missed, and upcoming training dates
- Common and custom diet goals with minimum, maximum, or avoid scoring plus custom units
- Breakfast, lunch, dinner, and snack logging with user-created food entries, macros, and categories
- Automatic diet scoring from meal macros and food categories such as alcohol or dessert
- Home quick logging for meals and workouts, with full review and editing in Check-In
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
- Category-colored, numbered rule editors for easier scanning in larger goal sets
- Six-step onboarding for daily tracking, exercise patterns, diet goals, progress, and Social

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Project status

- Production beta: [god-mode-july.vercel.app](https://god-mode-july.vercel.app/)
- Current automated coverage: 24 tracker/service tests plus 6 passing desktop/mobile browser scenarios
- Production build uses feature-level code splitting and remains below Vite's chunk warning threshold
- Core daily tracking works offline; authentication, cross-device sync, and Social require Supabase
- The main remaining beta risk is end-to-end validation across real accounts, browsers, and installed iPhone PWAs

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

Vitest covers weighted tracker scoring, exercise pattern scheduling and cycle progress, meal-derived macro and food-category scoring, flexible diet goals, appearance normalization, privacy-safe publishing, challenge template overrides, daily challenge snapshots, Supabase row normalization, transient-error retry behavior, and mocked friend/squad/challenge mutations.

Run the desktop and mobile Chromium smoke suite:

```bash
npm run test:e2e
```

The smoke suite covers daily meal/workout logging, automatic rule scoring, finalization, reload persistence, appearance persistence, responsive overflow, and goal-editor structure. Playwright starts a production preview automatically and blocks service workers so each run tests the current build.

An optional existing-account Supabase check runs when credentials are provided explicitly:

```bash
E2E_USER_EMAIL="beta@example.com" E2E_USER_PASSWORD="your-password" npm run test:e2e
```

Credentials are read only by the local test process and should never be committed. A ready-to-enable workflow is included as `github-actions-test.yml.example`; move it to `.github/workflows/test.yml` after authenticating Git with a token that has GitHub's `workflow` scope.

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

Exercise rules use repeating cycles anchored to the tracker start date. A rule can run daily or on selected days within a 7-day or 30-day pattern. Seven-day patterns display weekdays, Home and Check-In identify recovery days, and Progress summarizes the current cycle. Diet rules can require at least a target, stay at or below a target, or avoid an item entirely. Meals carry macro values and optional food categories, allowing rules such as protein, calories, no alcohol, or no dessert to update automatically. Existing alcohol, calorie, protein, water, and workout data is normalized into the new model when local backups or cloud snapshots load.

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

### Priority 1: beta validation

1. Set up an isolated Supabase test project and seeded accounts for repeatable cloud-sync testing.
2. Add a seeded two-account test for friend requests, challenge acceptance, score publishing, comments, and reactions.
3. Run the existing smoke suite against iPhone Safari and an installed iPhone PWA in addition to Chromium.
4. Record reproducible beta failures with browser, device, app version, and sync state before expanding the feature set further.

### Priority 2: faster meal logging

1. Add a personal food library so commonly logged foods retain their macros and categories.
2. Add serving quantity with automatic macro scaling.
3. Add recent foods, favorites, duplicate meal, and copy-yesterday shortcuts.
4. Consider barcode lookup only after the manual food-library flow is fast and reliable.

### Priority 3: challenge lifecycle controls

1. Add direct challenge links or short join codes that open the relevant invite in the PWA.
2. Let owners cancel pending invites, remove participants, and end active challenges safely.
3. Let members leave challenges and squads with clear score-history behavior.
4. Add unread badges for new comments, reactions, and challenge updates.

### Priority 4: daily review polish

1. Add a clearer end-of-day review showing missing inputs before finalization.
2. Add weekly summaries that explain which rules helped or hurt the score most.
3. Add optional notes to individual workouts and meals without exposing them socially.
4. Continue accessibility, empty-state, and slow-network testing as each workflow changes.

### Deliberately later

- Closed-app push notifications, public discovery, profile photos, achievement systems, and barcode-provider integrations should wait until private beta reliability and repeat daily use are proven.
