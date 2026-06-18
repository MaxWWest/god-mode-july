# God Mode July build plan

## Milestone 1 — Working local PWA (complete)

- React + TypeScript + Vite foundation
- Mobile-first dashboard
- Daily check-in form
- Monthly calendar inside Progress
- Rule completion analytics
- Local browser persistence
- Installable PWA manifest and service worker

## Milestone 2 — Make the rules yours (complete)

- Editable rules
- Exercise, diet, mental, and miscellaneous rule categories
- Repeating 1-day, 7-day, and 30-day exercise patterns
- Weekday-aware 7-day plans, visible recovery days, and next-workout guidance
- Current-cycle exercise progress with completed, missed, and upcoming training dates
- Minimum, maximum, and avoid diet goals with common presets and custom names/units
- Editable diet, exercise, and sleep targets
- Non-negotiable versus supporting-rule weights
- Custom tracker title and start date
- Five-tab navigation with separate Rules + Goals and App + Account settings views
- Updated six-step onboarding for the exercise/diet tracker model

## Milestone 3 — Better data ownership (complete)

- JSON and CSV export (complete)
- Import and backup recovery (complete)
- Account data export and cloud data deletion controls (complete)
- Last-7-day and last-30-day progress reviews (complete)
- Weight, sleep, calorie, and mood trend charts (complete)

## Milestone 4 — Cloud version (complete)

- Supabase login (complete)
- Multi-device synchronization (complete)
- Conflict detection for simultaneous multi-device edits (complete)
- Hosted deployment docs and env template (complete)
- Optional reminders (complete)

## Social v1 — Friends and competition (complete)

- Friend profiles with display names and invite codes
- Invite-code friend requests with accept and decline actions
- Accepted friendships only appear in the leaderboard
- Share-safe challenge summaries
- Friends leaderboard for last-7-day completion, average completion, streaks, and logged days
- Invite-only custom friend challenges with personal-target or shared-rule scoring
- Challenge accept/decline flow and per-challenge score publishing
- Private squads, challenge templates, stored activity events, and friend profiles
- Per-day published challenge score history

## Reliability and architecture (beta-ready)

- Vitest coverage for tracker scoring, privacy, challenge templates, history snapshots, row normalization, transient retries, and mocked social mutations
- Dedicated social and cloud Supabase service modules
- Shared transient-error classification and safe-operation retry service
- Clear offline status and retry controls for cloud and social features
- Next: automated single-account and seeded two-account browser smoke tests

## Ongoing tracker pivot (complete)

- Removed fixed July 1-31 timeframe from the main experience
- Current-date daily tracking with no visible end date
- Replaced Done Eating as a scored rule with finalizing/locking a day
- Replaced Week 1-5 progress recaps with Last 7 and Last 30 reviews
