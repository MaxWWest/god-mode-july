import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { loadFromStorage, saveToStorage } from './storage'
import {
  SUPABASE_FRIEND_EVENT_TABLE,
  SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE,
  SUPABASE_FRIEND_CHALLENGE_TABLE,
  SUPABASE_FRIENDSHIP_TABLE,
  SUPABASE_PROFILE_TABLE,
  SUPABASE_SQUAD_MEMBER_TABLE,
  SUPABASE_SQUAD_TABLE,
  SUPABASE_SUMMARY_TABLE,
  SUPABASE_TABLE,
  isSupabaseConfigured,
  supabase,
} from './supabase'

type View = 'home' | 'check-in' | 'calendar' | 'progress' | 'friends' | 'settings'
type BuiltInRuleKey = 'exercise' | 'sober' | 'foodLogged' | 'calories' | 'protein' | 'water' | 'sleep' | 'reading' | 'journal'
type CustomRuleKey = `custom-${string}`
type RuleKey = BuiltInRuleKey | CustomRuleKey
type RuleWeight = 'nonNegotiable' | 'supporting'
type RuleCategoryKey = string

type RuleCategoryConfig = {
  key: RuleCategoryKey
  label: string
}

type RuleConfig = {
  key: RuleKey
  label: string
  icon: string
  enabled: boolean
  weight: RuleWeight
  category: RuleCategoryKey
  deleted?: boolean
}

type ChallengeTargets = {
  exerciseMinutes: number
  calories: number
  proteinGrams: number
  waterLiters: number
  sleepHours: number
}

type ChallengeSettings = {
  title: string
  startDate: string
  endDate: string
  targets: ChallengeTargets
  categories: RuleCategoryConfig[]
  rules: RuleConfig[]
}

type DailyEntry = {
  date: string
  exerciseMinutes: number
  workouts: WorkoutLog[]
  sober: boolean
  foodLogged: boolean
  finalizedAt: string | null
  calories: number | null
  proteinGrams: number | null
  waterLiters: number | null
  weightPounds: number | null
  readTenPages: boolean
  journaled: boolean
  ruleCompletions: Record<string, boolean>
  mood: number
  energy: number
  hunger: number
  sleepHours: number | null
  wentWell: string
  difficult: string
}

type WorkoutLog = {
  id: string
  type: string
  minutes: number
}

type EntryMap = Record<string, DailyEntry>

type BackupPayload = {
  app: 'god-mode-july'
  version: 1
  exportedAt: string
  settings: ChallengeSettings
  entries: EntryMap
}

type SyncMeta = {
  lastCloudUpdatedAt: string | null
  lastLocalChangeAt: string | null
}

type CloudSnapshot = {
  settings: ChallengeSettings
  entries: EntryMap
  updatedAt: string | null
}

type SyncConflict = {
  cloud: CloudSnapshot
  localChangedAt: string | null
  message: string
}

type AccountDataExport = {
  app: 'god-mode-july'
  exportType: 'account-data'
  exportedAt: string
  user: {
    id: string
    email: string | null
  }
  local: {
    settings: ChallengeSettings
    entries: EntryMap
    privacy: PrivacySettings
  }
  cloud: {
    snapshot: CloudSnapshot | null
    profile: FriendProfile | null
    friendships: FriendshipRow[]
    summary: ChallengeSummary | null
    friendChallenges: FriendChallenge[]
    friendChallengeParticipants: FriendChallengeParticipant[]
    friendSquads: FriendSquad[]
    friendSquadMembers: FriendSquadMember[]
    friendEvents: FriendEvent[]
  }
}

type DataStatus = {
  tone: 'success' | 'error' | 'neutral'
  message: string
}

type AppNotice = {
  id: number
  tone: 'success' | 'error' | 'neutral'
  message: string
}

type PrivacySettings = {
  showWeeklyCompletion: boolean
  showAverageCompletion: boolean
  showStreak: boolean
  showLoggedDays: boolean
}

type RuleRate = RuleConfig & {
  rate: number
}

type ProgressPeriod = 'week' | 'month'

type PeriodRecap = {
  label: string
  startDate: string
  endDate: string
  totalDays: number
  loggedDays: number
  averageCompletion: number
  bestRule: RuleRate | null
  weakestRule: RuleRate | null
  averageSleep: number | null
  averageCalories: number | null
  averageMood: number | null
  weightChange: number | null
  reflectionCount: number
}

type TrendMetricKey = 'weight' | 'sleep' | 'calories' | 'mood'

type TrendMetric = {
  key: TrendMetricKey
  label: string
  unit: string
  color: string
  emptyLabel: string
  format: (value: number) => string
  getValue: (entry: DailyEntry) => number | null
}

type TrendPoint = {
  date: string
  value: number
}

type ReminderSettings = {
  enabled: boolean
  time: string
  message: string
}

type FriendProfile = {
  userId: string
  displayName: string
  inviteCode: string
}

type ChallengeSummary = {
  userId: string
  challengeTitle: string
  startDate: string
  endDate: string
  loggedDays: number
  totalDays: number
  averageCompletion: number
  weeklyCompletion: number
  currentStreak: number
  longestStreak: number
  lastLoggedDate: string | null
  updatedAt: string
  privacy: PrivacySettings
  note?: string
  reaction?: ScoreReaction | null
}

type LeaderboardRow = FriendProfile & {
  summary: ChallengeSummary | null
  isCurrentUser: boolean
}

type FriendshipStatus = 'pending' | 'accepted' | 'declined'

type FriendshipRow = {
  userA: string
  userB: string
  createdBy: string
  requestedBy: string
  status: FriendshipStatus
  createdAt: string
  respondedAt: string | null
}

type FriendRequest = FriendProfile & {
  userA: string
  userB: string
  requestedBy: string
  direction: 'incoming' | 'outgoing'
  createdAt: string
}

type FriendChallengeScoringMode = 'personal' | 'shared'
type FriendChallengeParticipantStatus = 'pending' | 'accepted' | 'declined'
type ScoreReaction = 'locked-in' | 'comeback' | 'streak' | 'respect'

type FriendChallenge = {
  id: string
  creatorId: string
  name: string
  startDate: string
  endDate: string
  scoringMode: FriendChallengeScoringMode
  settings: ChallengeSettings
  createdAt: string
  updatedAt: string
}

type FriendChallengeParticipant = {
  challengeId: string
  userId: string
  invitedBy: string
  status: FriendChallengeParticipantStatus
  summary: ChallengeSummary | null
  createdAt: string
  respondedAt: string | null
}

type FriendChallengeParticipantView = FriendProfile & {
  invitedBy: string
  status: FriendChallengeParticipantStatus
  summary: ChallengeSummary | null
  createdAt: string
  respondedAt: string | null
  isCurrentUser: boolean
}

type FriendChallengeView = FriendChallenge & {
  currentUserStatus: FriendChallengeParticipantStatus
  isCreator: boolean
  participants: FriendChallengeParticipantView[]
}

type FriendSquad = {
  id: string
  ownerId: string
  name: string
  createdAt: string
  updatedAt: string
}

type FriendSquadMember = {
  squadId: string
  userId: string
  addedBy: string
  createdAt: string
}

type FriendSquadView = FriendSquad & {
  members: FriendProfile[]
}

type CreateFriendChallengeInput = {
  name: string
  startDate: string
  endDate: string
  scoringMode: FriendChallengeScoringMode
  inviteeIds: string[]
  templateId?: string
}

type CreateFriendSquadInput = {
  name: string
  memberIds: string[]
}

type UpdateFriendSquadInput = CreateFriendSquadInput & {
  squadId: string
}

type InviteFriendChallengeInput = {
  challengeId: string
  inviteeIds: string[]
}

type ChallengeTemplate = {
  id: string
  name: string
  durationDays: number
  scoringMode: FriendChallengeScoringMode
  note: string
  targetOverrides?: Partial<ChallengeTargets>
  ruleOverrides?: Partial<Record<BuiltInRuleKey, Partial<Pick<RuleConfig, 'enabled' | 'weight' | 'category'>>>>
}

type FriendsTab = 'overview' | 'network' | 'squads' | 'challenges' | 'leaderboard'

type FriendEventType =
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_request_declined'
  | 'squad_created'
  | 'squad_updated'
  | 'squad_deleted'
  | 'challenge_created'
  | 'challenge_invites_sent'
  | 'challenge_invite_accepted'
  | 'challenge_invite_declined'
  | 'challenge_score_published'
  | 'leaderboard_score_published'

type FriendEvent = {
  id: string
  actorId: string
  targetUserId: string | null
  challengeId: string | null
  squadId: string | null
  eventType: FriendEventType
  metadata: Record<string, unknown>
  createdAt: string
}

type FriendActivityFeedItem = {
  id: string
  title: string
  detail: string
  meta: string
  tone: 'success' | 'pending' | 'neutral'
  sortAt: string
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ENTRIES_STORAGE_KEY = 'god-mode-july-entries-v1'
const SETTINGS_STORAGE_KEY = 'god-mode-july-settings-v1'
const REMINDER_STORAGE_KEY = 'god-mode-july-reminder-v1'
const SYNC_META_STORAGE_KEY = 'god-mode-july-sync-meta-v1'
const TUTORIAL_STORAGE_KEY = 'god-mode-july-tutorial-seen-v1'
const PRIVACY_STORAGE_KEY = 'god-mode-july-privacy-v1'
const DAY_IN_MS = 86_400_000
const MAX_TRACKING_DAYS = 3650
const MAX_WORKOUT_LOGS = 12
const MAX_WORKOUT_MINUTES = 300
const MAX_DAILY_EXERCISE_MINUTES = 600
const LEGACY_DEFAULT_START_DATE = '2026-07-01'
const LEGACY_DEFAULT_END_DATE = '2026-07-31'
const WORKOUT_TYPES = ['Strength', 'Cardio', 'Walking', 'Running', 'Cycling', 'Mobility', 'Sports', 'Workout', 'Other']
const DEFAULT_WORKOUT_TYPE = WORKOUT_TYPES[0]
const BUILT_IN_RULE_KEYS: BuiltInRuleKey[] = ['exercise', 'sober', 'foodLogged', 'calories', 'protein', 'water', 'sleep', 'reading', 'journal']
const DEFAULT_RULE_CATEGORIES: RuleCategoryConfig[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'mental', label: 'Mental' },
]

const DEFAULT_TARGETS: ChallengeTargets = {
  exerciseMinutes: 90,
  calories: 2200,
  proteinGrams: 140,
  waterLiters: 3,
  sleepHours: 7.5,
}

const DEFAULT_RULES: RuleConfig[] = [
  { key: 'exercise', label: 'Exercise', icon: '◆', enabled: true, weight: 'nonNegotiable', category: 'exercise' },
  { key: 'sober', label: 'No Alcohol', icon: '◈', enabled: true, weight: 'nonNegotiable', category: 'activity' },
  { key: 'calories', label: 'Calories', icon: '◌', enabled: false, weight: 'supporting', category: 'activity' },
  { key: 'protein', label: 'Protein', icon: '▲', enabled: true, weight: 'nonNegotiable', category: 'activity' },
  { key: 'water', label: 'Water', icon: '≈', enabled: false, weight: 'supporting', category: 'activity' },
  { key: 'sleep', label: 'Sleep', icon: '◒', enabled: false, weight: 'supporting', category: 'activity' },
  { key: 'reading', label: 'Read 10 Pages', icon: '▣', enabled: true, weight: 'supporting', category: 'mental' },
  { key: 'journal', label: 'Journal', icon: '✦', enabled: true, weight: 'supporting', category: 'mental' },
]

const DEFAULT_SETTINGS: ChallengeSettings = {
  title: 'God Mode July',
  startDate: todayIso(),
  endDate: addDays(todayIso(), 365),
  targets: DEFAULT_TARGETS,
  categories: DEFAULT_RULE_CATEGORIES,
  rules: DEFAULT_RULES,
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  time: '20:30',
  message: 'Log today before the day gets away from you.',
}

const DEFAULT_SYNC_META: SyncMeta = {
  lastCloudUpdatedAt: null,
  lastLocalChangeAt: null,
}

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showWeeklyCompletion: true,
  showAverageCompletion: true,
  showStreak: true,
  showLoggedDays: true,
}

const SCORE_REACTIONS: { key: ScoreReaction; label: string }[] = [
  { key: 'locked-in', label: 'Locked in' },
  { key: 'comeback', label: 'Comeback' },
  { key: 'streak', label: 'Streak' },
  { key: 'respect', label: 'Respect' },
]

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'custom',
    name: 'Custom',
    durationDays: 7,
    scoringMode: 'personal',
    note: 'Start from a blank challenge.',
  },
  {
    id: 'no-zero-days',
    name: 'No Zero Days',
    durationDays: 7,
    scoringMode: 'personal',
    note: 'One-week push using everyone’s own targets.',
    ruleOverrides: {
      exercise: { enabled: true, weight: 'nonNegotiable' },
      protein: { enabled: true, weight: 'nonNegotiable' },
      reading: { enabled: true, weight: 'supporting' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
  {
    id: 'lock-in-week',
    name: 'Lock-In Week',
    durationDays: 7,
    scoringMode: 'shared',
    note: 'Shared rules for a clean head-to-head week.',
    targetOverrides: {
      exerciseMinutes: 90,
      proteinGrams: 140,
      waterLiters: 3,
      sleepHours: 7.5,
    },
    ruleOverrides: {
      exercise: { enabled: true, weight: 'nonNegotiable' },
      sober: { enabled: true, weight: 'nonNegotiable' },
      protein: { enabled: true, weight: 'nonNegotiable' },
      water: { enabled: true, weight: 'supporting' },
      sleep: { enabled: true, weight: 'supporting' },
      reading: { enabled: true, weight: 'supporting' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
  {
    id: 'month-sprint',
    name: '30-Day Sprint',
    durationDays: 30,
    scoringMode: 'personal',
    note: 'Longer personal-target challenge.',
    ruleOverrides: {
      exercise: { enabled: true, weight: 'nonNegotiable' },
      protein: { enabled: true, weight: 'nonNegotiable' },
      water: { enabled: true, weight: 'supporting' },
      sleep: { enabled: true, weight: 'supporting' },
      reading: { enabled: true, weight: 'supporting' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
  {
    id: 'sleep-reset',
    name: 'Sleep Reset',
    durationDays: 10,
    scoringMode: 'shared',
    note: 'Short shared-rule reset challenge.',
    targetOverrides: {
      exerciseMinutes: 45,
      waterLiters: 3,
      sleepHours: 8,
    },
    ruleOverrides: {
      exercise: { enabled: true, weight: 'supporting' },
      sober: { enabled: true, weight: 'supporting' },
      water: { enabled: true, weight: 'supporting' },
      sleep: { enabled: true, weight: 'nonNegotiable' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
]

const FRIENDS_TABS: { key: FriendsTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'network', label: 'Network' },
  { key: 'squads', label: 'Squads' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'leaderboard', label: 'Leaderboard' },
]

const TUTORIAL_STEPS = [
  {
    eyebrow: 'Step 1',
    title: 'Build today from the Home tab.',
    body: 'Tap daily rules as you complete them. Your percent is weighted by non-negotiable and supporting rules.',
  },
  {
    eyebrow: 'Step 2',
    title: 'Use Check-In for the details.',
    body: 'Log workouts, food targets, water, sleep, mood, and short reflections before you finalize the day.',
  },
  {
    eyebrow: 'Step 3',
    title: 'Finalize when the day is done.',
    body: 'Finalizing locks the day so your score feels published. You can still unlock it if you need to fix something.',
  },
  {
    eyebrow: 'Step 4',
    title: 'Tune the tracker in Settings.',
    body: 'Change targets, scored rule categories, active rules, account sync, reminders, exports, and cloud data controls.',
  },
  {
    eyebrow: 'Step 5',
    title: 'Compete from Friends.',
    body: 'Copy your invite code, accept requests, save private squads, publish scores, and create friend challenges.',
  },
]

const TREND_METRICS: TrendMetric[] = [
  {
    key: 'weight',
    label: 'Weight',
    unit: 'lb',
    color: '#57d979',
    emptyLabel: 'Log weight to see the scale trend.',
    format: (value) => `${value.toFixed(1)} lb`,
    getValue: (entry) => entry.weightPounds,
  },
  {
    key: 'sleep',
    label: 'Sleep',
    unit: 'hr',
    color: '#e6bd4b',
    emptyLabel: 'Log sleep hours to see recovery patterns.',
    format: (value) => `${value.toFixed(1)} hr`,
    getValue: (entry) => entry.sleepHours,
  },
  {
    key: 'calories',
    label: 'Calories',
    unit: 'kcal',
    color: '#62c7ff',
    emptyLabel: 'Log calories to see intake consistency.',
    format: (value) => `${Math.round(value)} kcal`,
    getValue: (entry) => entry.calories,
  },
  {
    key: 'mood',
    label: 'Mood',
    unit: '/5',
    color: '#ed6b72',
    emptyLabel: 'Log daily check-ins to see mood movement.',
    format: (value) => `${value.toFixed(1)}/5`,
    getValue: (entry) => entry.mood,
  },
]

function addDays(date: string, amount: number): string {
  const parsed = new Date(`${date}T12:00:00`)
  parsed.setDate(parsed.getDate() + amount)
  return parsed.toISOString().slice(0, 10)
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`).getTime()
  const end = new Date(`${endDate}T12:00:00`).getTime()
  return Math.floor((end - start) / DAY_IN_MS)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
}

function isBuiltInRuleKey(value: unknown): value is BuiltInRuleKey {
  return typeof value === 'string' && BUILT_IN_RULE_KEYS.includes(value as BuiltInRuleKey)
}

function isCustomRuleKey(value: unknown): value is CustomRuleKey {
  return typeof value === 'string' && /^custom-[a-z0-9-]{6,80}$/.test(value)
}

function normalizeRuleKey(value: unknown): RuleKey | null {
  if (isBuiltInRuleKey(value) || isCustomRuleKey(value)) return value
  return null
}

function normalizeCategoryKey(value: unknown, fallback: RuleCategoryKey): RuleCategoryKey {
  if (value === 'physical') return fallback
  if (typeof value !== 'string') return fallback
  const key = value.trim().toLowerCase()
  return /^[a-z0-9-]{2,80}$/.test(key) ? key : fallback
}

function normalizeCategoryLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed ? trimmed.slice(0, 32) : fallback
}

function slugifyCategoryLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function makeCategoryKey(label: string, existingKeys: Set<string>): RuleCategoryKey {
  const base = slugifyCategoryLabel(label) || 'custom'
  let key = base
  let suffix = 2
  while (existingKeys.has(key)) {
    key = `${base}-${suffix}`
    suffix += 1
  }
  return key
}

function categoryLabelFromKey(key: RuleCategoryKey): string {
  return key
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Custom'
}

function normalizeRuleWeight(value: unknown, fallback: RuleWeight): RuleWeight {
  return value === 'nonNegotiable' || value === 'supporting' ? value : fallback
}

function makeCustomRuleKey(): CustomRuleKey {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeCustomRule(category: RuleCategoryConfig): RuleConfig {
  return {
    key: makeCustomRuleKey(),
    label: `New ${category.label} Rule`,
    icon: category.key === 'mental' ? '✦' : category.key === 'exercise' ? '◆' : '◈',
    enabled: true,
    weight: 'supporting',
    category: category.key,
  }
}

function normalizeTarget(value: unknown, fallback: number, min: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < min) return fallback
  return parsed
}

function normalizeOptionalNumber(value: unknown, min: number, max = Number.POSITIVE_INFINITY): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(max, Math.max(min, parsed))
}

function normalizeBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeWorkoutType(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_WORKOUT_TYPE
  const trimmed = value.trim()
  return trimmed || DEFAULT_WORKOUT_TYPE
}

function makeWorkoutId(): string {
  return `workout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeWorkoutLog(value: unknown, index: number): WorkoutLog | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<WorkoutLog>
  const id = typeof candidate.id === 'string' && candidate.id.trim()
    ? candidate.id.trim()
    : `workout-${index + 1}`
  const type = normalizeWorkoutType(candidate.type)
  const minutes = normalizeBoundedNumber(candidate.minutes, 0, 0, MAX_WORKOUT_MINUTES)

  return { id, type, minutes }
}

function normalizeWorkoutLogs(value: unknown): WorkoutLog[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => normalizeWorkoutLog(item, index))
    .filter((item): item is WorkoutLog => item !== null)
    .slice(0, MAX_WORKOUT_LOGS)
}

function normalizeRuleCompletionMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, complete]) => isCustomRuleKey(key) && typeof complete === 'boolean'),
  )
}

function workoutMinutesTotal(workouts: WorkoutLog[]): number {
  return Math.min(
    MAX_DAILY_EXERCISE_MINUTES,
    workouts.reduce((sum, workout) => sum + workout.minutes, 0),
  )
}

function getExerciseMinutes(entry: DailyEntry): number {
  const workouts = Array.isArray(entry.workouts) ? entry.workouts : []
  return workouts.length > 0 ? workoutMinutesTotal(workouts) : entry.exerciseMinutes
}

function makeLegacyWorkout(minutes: number): WorkoutLog {
  return {
    id: 'legacy-exercise-total',
    type: 'Workout',
    minutes,
  }
}

function makeEmptyWorkout(): WorkoutLog {
  return {
    id: makeWorkoutId(),
    type: DEFAULT_WORKOUT_TYPE,
    minutes: 0,
  }
}

function formatWorkoutSummary(workouts: WorkoutLog[] = []): string {
  const completedWorkouts = workouts.filter((workout) => workout.minutes > 0)
  if (completedWorkouts.length === 0) return ''
  return completedWorkouts
    .map((workout) => `${workout.type} ${workout.minutes} min`)
    .join('; ')
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

function normalizeSyncMeta(value: unknown): SyncMeta {
  const candidate = value && typeof value === 'object' ? value as Partial<SyncMeta> : {}
  return {
    lastCloudUpdatedAt: normalizeTimestamp(candidate.lastCloudUpdatedAt),
    lastLocalChangeAt: normalizeTimestamp(candidate.lastLocalChangeAt),
  }
}

function normalizePrivacySettings(value: unknown): PrivacySettings {
  const candidate = value && typeof value === 'object' ? value as Partial<PrivacySettings> : {}
  return {
    showWeeklyCompletion: typeof candidate.showWeeklyCompletion === 'boolean' ? candidate.showWeeklyCompletion : DEFAULT_PRIVACY_SETTINGS.showWeeklyCompletion,
    showAverageCompletion: typeof candidate.showAverageCompletion === 'boolean' ? candidate.showAverageCompletion : DEFAULT_PRIVACY_SETTINGS.showAverageCompletion,
    showStreak: typeof candidate.showStreak === 'boolean' ? candidate.showStreak : DEFAULT_PRIVACY_SETTINGS.showStreak,
    showLoggedDays: typeof candidate.showLoggedDays === 'boolean' ? candidate.showLoggedDays : DEFAULT_PRIVACY_SETTINGS.showLoggedDays,
  }
}

function timestampIsAfter(value: string | null, baseline: string | null): boolean {
  if (!value) return false
  if (!baseline) return true
  return new Date(value).getTime() > new Date(baseline).getTime()
}

function normalizeRuleLabel(defaultRule: RuleConfig, storedLabel: string): string {
  const legacyLabels: Partial<Record<BuiltInRuleKey, string[]>> = {
    exercise: ['90 min Exercise'],
    foodLogged: ['Log Food Honestly', 'Food honestly logged', 'Done Eating for the Day'],
    calories: ['Calories On Target'],
    protein: ['Protein Goal'],
    water: ['Water Goal'],
    sleep: ['Sleep Goal'],
  }

  if (isBuiltInRuleKey(defaultRule.key) && legacyLabels[defaultRule.key]?.includes(storedLabel)) return defaultRule.label
  return storedLabel || defaultRule.label
}

function normalizeRuleCategories(value: unknown, rules: RuleConfig[]): RuleCategoryConfig[] {
  const categoriesByKey = new Map<string, RuleCategoryConfig>()

  for (const category of DEFAULT_RULE_CATEGORIES) {
    categoriesByKey.set(category.key, category)
  }

  if (Array.isArray(value)) {
    for (const rawCategory of value) {
      if (!rawCategory || typeof rawCategory !== 'object') continue
      const category = rawCategory as Partial<RuleCategoryConfig>
      const labelFallback = typeof category.key === 'string' ? categoryLabelFromKey(category.key) : 'Custom'
      const label = normalizeCategoryLabel(category.label, labelFallback)
      const keyFallback = makeCategoryKey(label, new Set(categoriesByKey.keys()))
      const key = normalizeCategoryKey(category.key, keyFallback)
      categoriesByKey.set(key, { key, label })
    }
  }

  for (const rule of rules) {
    const key = normalizeCategoryKey(rule.category, 'activity')
    if (!categoriesByKey.has(key)) {
      categoriesByKey.set(key, { key, label: categoryLabelFromKey(key) })
    }
  }

  return Array.from(categoriesByKey.values())
}

function normalizeSettings(value: unknown): ChallengeSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<ChallengeSettings> : {}
  const targetsCandidate = candidate.targets && typeof candidate.targets === 'object'
    ? candidate.targets as Partial<ChallengeTargets>
    : {}

  const targets: ChallengeTargets = {
    exerciseMinutes: normalizeTarget(targetsCandidate.exerciseMinutes, DEFAULT_TARGETS.exerciseMinutes, 1),
    calories: normalizeTarget(targetsCandidate.calories, DEFAULT_TARGETS.calories, 1),
    proteinGrams: normalizeTarget(targetsCandidate.proteinGrams, DEFAULT_TARGETS.proteinGrams, 1),
    waterLiters: normalizeTarget(targetsCandidate.waterLiters, DEFAULT_TARGETS.waterLiters, 0.1),
    sleepHours: normalizeTarget(targetsCandidate.sleepHours, DEFAULT_TARGETS.sleepHours, 0.25),
  }

  const storedRules = Array.isArray(candidate.rules) ? candidate.rules : []
  const storedRuleByKey = new Map<RuleKey, Partial<RuleConfig>>()

  for (const storedRule of storedRules) {
    if (storedRule && typeof storedRule === 'object') {
      const rule = storedRule as Partial<RuleConfig>
      const key = normalizeRuleKey(rule.key)
      if (key) storedRuleByKey.set(key, rule)
    }
  }

  const rules = DEFAULT_RULES.map((defaultRule) => {
    const storedRule = storedRuleByKey.get(defaultRule.key)
    const storedLabel = typeof storedRule?.label === 'string' && storedRule.label.trim()
      ? storedRule.label.trim()
      : ''
    const label = normalizeRuleLabel(defaultRule, storedLabel)
    const icon = typeof storedRule?.icon === 'string' && storedRule.icon.trim()
      ? storedRule.icon.trim().slice(0, 2)
      : defaultRule.icon

    return {
      key: defaultRule.key,
      label,
      icon,
      enabled: typeof storedRule?.enabled === 'boolean' ? storedRule.enabled : defaultRule.enabled,
      weight: normalizeRuleWeight(storedRule?.weight, defaultRule.weight),
      category: normalizeCategoryKey(storedRule?.category, defaultRule.category),
      deleted: storedRule?.deleted === true,
    }
  })
  const customRules = storedRules.reduce<RuleConfig[]>((normalizedRules, storedRule) => {
    if (!storedRule || typeof storedRule !== 'object') return normalizedRules
    const rule = storedRule as Partial<RuleConfig>
    const key = normalizeRuleKey(rule.key)
    if (!key || !isCustomRuleKey(key)) return normalizedRules
    const label = typeof rule.label === 'string' && rule.label.trim()
      ? rule.label.trim()
      : 'Custom Rule'
    const icon = typeof rule.icon === 'string' && rule.icon.trim()
      ? rule.icon.trim().slice(0, 2)
      : '◆'

    normalizedRules.push({
      key,
      label,
      icon,
      enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
      weight: normalizeRuleWeight(rule.weight, 'supporting'),
      category: normalizeCategoryKey(rule.category, 'activity'),
      deleted: rule.deleted === true,
    })
    return normalizedRules
  }, [])
  const allRules = [...rules, ...customRules]
  const categories = normalizeRuleCategories(candidate.categories, allRules)

  const today = todayIso()
  const hasLegacyDefaultDates = candidate.startDate === LEGACY_DEFAULT_START_DATE && candidate.endDate === LEGACY_DEFAULT_END_DATE
  let startDate = hasLegacyDefaultDates
    ? today
    : isIsoDate(candidate.startDate) ? candidate.startDate : today
  let endDate = isIsoDate(candidate.endDate) && !hasLegacyDefaultDates ? candidate.endDate : addDays(startDate, 365)
  if (endDate < startDate) endDate = startDate
  if (daysBetween(startDate, endDate) >= MAX_TRACKING_DAYS) endDate = addDays(startDate, MAX_TRACKING_DAYS - 1)

  return {
    title: typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim()
      : DEFAULT_SETTINGS.title,
    startDate,
    endDate,
    targets,
    categories,
    rules: allRules,
  }
}

function normalizeReminderSettings(value: unknown): ReminderSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<ReminderSettings> : {}
  const time = typeof candidate.time === 'string' && /^\d{2}:\d{2}$/.test(candidate.time)
    ? candidate.time
    : DEFAULT_REMINDER_SETTINGS.time

  return {
    enabled: candidate.enabled === true,
    time,
    message: typeof candidate.message === 'string' && candidate.message.trim()
      ? candidate.message.trim()
      : DEFAULT_REMINDER_SETTINGS.message,
  }
}

function normalizeEntry(value: unknown, fallbackDate: string): DailyEntry | null {
  const candidate = value && typeof value === 'object' ? value as Partial<DailyEntry> : {}
  const date = isIsoDate(candidate.date) ? candidate.date : fallbackDate
  if (!isIsoDate(date)) return null
  const legacyExerciseMinutes = normalizeBoundedNumber(candidate.exerciseMinutes, 0, 0, MAX_DAILY_EXERCISE_MINUTES)
  const workouts = normalizeWorkoutLogs(candidate.workouts)
  const exerciseMinutes = workouts.length > 0 ? workoutMinutesTotal(workouts) : legacyExerciseMinutes

  return {
    date,
    exerciseMinutes,
    workouts: workouts.length > 0 ? workouts : legacyExerciseMinutes > 0 ? [makeLegacyWorkout(legacyExerciseMinutes)] : [],
    sober: candidate.sober === true,
    foodLogged: candidate.foodLogged === true,
    finalizedAt: normalizeTimestamp(candidate.finalizedAt),
    calories: normalizeOptionalNumber(candidate.calories, 0, 10000),
    proteinGrams: normalizeOptionalNumber(candidate.proteinGrams, 0, 500),
    waterLiters: normalizeOptionalNumber(candidate.waterLiters, 0, 15),
    weightPounds: normalizeOptionalNumber(candidate.weightPounds, 50, 700),
    readTenPages: candidate.readTenPages === true,
    journaled: candidate.journaled === true,
    ruleCompletions: normalizeRuleCompletionMap(candidate.ruleCompletions),
    mood: normalizeBoundedNumber(candidate.mood, 3, 1, 5),
    energy: normalizeBoundedNumber(candidate.energy, 3, 1, 5),
    hunger: normalizeBoundedNumber(candidate.hunger, 3, 1, 5),
    sleepHours: normalizeOptionalNumber(candidate.sleepHours, 0, 24),
    wentWell: normalizeText(candidate.wentWell),
    difficult: normalizeText(candidate.difficult),
  }
}

function normalizeEntries(value: unknown): EntryMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries: EntryMap = {}
  for (const [date, rawEntry] of Object.entries(value)) {
    const entry = normalizeEntry(rawEntry, date)
    if (entry) entries[entry.date] = entry
  }

  return entries
}

function normalizeCloudSnapshot(row: unknown): CloudSnapshot | null {
  const candidate = row && typeof row === 'object'
    ? row as { settings?: unknown; entries?: unknown; updated_at?: unknown }
    : null
  if (!candidate) return null

  return {
    settings: normalizeSettings(candidate.settings),
    entries: normalizeEntries(candidate.entries),
    updatedAt: normalizeTimestamp(candidate.updated_at),
  }
}

function mergeCloudOnlyEntries(localEntries: EntryMap, cloudEntries: EntryMap): EntryMap {
  return normalizeEntries({
    ...cloudEntries,
    ...localEntries,
  })
}

function countCloudOnlyEntries(localEntries: EntryMap, cloudEntries: EntryMap): number {
  return Object.keys(cloudEntries).filter((date) => !localEntries[date]).length
}

function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function selectableEndDate(settings: ChallengeSettings): string {
  const today = todayIso()
  return today < settings.startDate ? settings.startDate : today
}

function clampDate(date: string, settings: ChallengeSettings): string {
  if (date < settings.startDate) return settings.startDate
  const endDate = selectableEndDate(settings)
  if (date > endDate) return endDate
  return date
}

function makeEmptyEntry(date: string): DailyEntry {
  return {
    date,
    exerciseMinutes: 0,
    workouts: [],
    sober: false,
    foodLogged: false,
    finalizedAt: null,
    calories: null,
    proteinGrams: null,
    waterLiters: null,
    weightPounds: null,
    readTenPages: false,
    journaled: false,
    ruleCompletions: {},
    mood: 3,
    energy: 3,
    hunger: 3,
    sleepHours: null,
    wentWell: '',
    difficult: '',
  }
}

function isEntryFinalized(entry: DailyEntry): boolean {
  return typeof entry.finalizedAt === 'string' && entry.finalizedAt.length > 0
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function formatMonthLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function dayNumber(date: string, settings: ChallengeSettings): number {
  return daysBetween(settings.startDate, date) + 1
}

function trackingLength(settings: ChallengeSettings, throughDate = selectableEndDate(settings)): number {
  return daysBetween(settings.startDate, throughDate) + 1
}

function getTrackingDates(settings: ChallengeSettings, throughDate = selectableEndDate(settings)): string[] {
  return Array.from({ length: trackingLength(settings, throughDate) }, (_, index) => addDays(settings.startDate, index))
}

function getScoredRules(settings: ChallengeSettings): RuleConfig[] {
  return settings.rules.filter((rule) => rule.deleted !== true)
}

function getEnabledRules(settings: ChallengeSettings): RuleConfig[] {
  return getScoredRules(settings).filter((rule) => rule.enabled)
}

function ruleWeightValue(rule: RuleConfig): number {
  return rule.weight === 'nonNegotiable' ? 2 : 1
}

function ruleComplete(entry: DailyEntry, rule: RuleKey, settings: ChallengeSettings): boolean {
  switch (rule) {
    case 'exercise':
      return getExerciseMinutes(entry) >= settings.targets.exerciseMinutes
    case 'sober':
      return entry.sober
    case 'foodLogged':
      return entry.foodLogged
    case 'calories':
      return typeof entry.calories === 'number' && entry.calories > 0 && entry.calories <= settings.targets.calories
    case 'protein':
      return (entry.proteinGrams ?? 0) >= settings.targets.proteinGrams
    case 'water':
      return (entry.waterLiters ?? 0) >= settings.targets.waterLiters
    case 'sleep':
      return (entry.sleepHours ?? 0) >= settings.targets.sleepHours
    case 'reading':
      return entry.readTenPages
    case 'journal':
      return entry.journaled
    default:
      return entry.ruleCompletions?.[rule] === true
  }
}

function completionStats(entry: DailyEntry, settings: ChallengeSettings) {
  const activeRules = getEnabledRules(settings)
  const totalWeight = activeRules.reduce((sum, rule) => sum + ruleWeightValue(rule), 0)
  const completedRules = activeRules.filter((rule) => ruleComplete(entry, rule.key, settings))
  const completedWeight = completedRules.reduce((sum, rule) => sum + ruleWeightValue(rule), 0)

  return {
    completed: completedRules.length,
    total: activeRules.length,
    percent: totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100),
  }
}

function getLoggedDates(entries: EntryMap, settings: ChallengeSettings): string[] {
  const endDate = selectableEndDate(settings)
  return Object.keys(entries)
    .filter((date) => date >= settings.startDate && date <= endDate)
    .sort()
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundTo(value: number, decimals = 1): number {
  return Number(value.toFixed(decimals))
}

function formatSigned(value: number, unit: string): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${roundTo(value)} ${unit}`
}

function getRuleRatesForDates(dates: string[], entries: EntryMap, settings: ChallengeSettings): RuleRate[] {
  const activeRules = getEnabledRules(settings)
  return activeRules.map((rule) => {
    if (dates.length === 0) return { ...rule, rate: 0 }
    const completeDays = dates.filter((date) => ruleComplete(entries[date], rule.key, settings)).length
    return { ...rule, rate: Math.round((completeDays / dates.length) * 100) }
  })
}

function getTrendPoints(entries: EntryMap, settings: ChallengeSettings, metric: TrendMetric): TrendPoint[] {
  return getLoggedDates(entries, settings)
    .map((date) => {
      const value = metric.getValue(entries[date])
      return typeof value === 'number' ? { date, value } : null
    })
    .filter((point): point is TrendPoint => point !== null)
}

function buildPeriodRecap(entries: EntryMap, settings: ChallengeSettings, period: ProgressPeriod): PeriodRecap {
  const throughDate = selectableEndDate(settings)
  const days = period === 'week' ? 7 : 30
  const rangeStart = addDays(throughDate, -(days - 1))
  const startDate = rangeStart < settings.startDate ? settings.startDate : rangeStart
  const periodDates = getTrackingDates(settings, throughDate).filter((date) => date >= startDate && date <= throughDate)
  const loggedDates = periodDates.filter((date) => Boolean(entries[date]))
  const loggedEntries = loggedDates.map((date) => entries[date])
  const ruleRates = getRuleRatesForDates(loggedDates, entries, settings)
  const sortedRates = [...ruleRates].sort((a, b) => a.rate - b.rate)
  const completionAverage = average(loggedEntries.map((entry) => completionStats(entry, settings).percent))
  const weights = loggedEntries
    .map((entry) => entry.weightPounds)
    .filter((value): value is number => typeof value === 'number')

  return {
    label: period === 'week' ? 'Last 7 days' : 'Last 30 days',
    startDate,
    endDate: throughDate,
    totalDays: periodDates.length,
    loggedDays: loggedDates.length,
    averageCompletion: completionAverage === null ? 0 : Math.round(completionAverage),
    bestRule: loggedDates.length > 0 && ruleRates.length > 0 ? [...ruleRates].sort((a, b) => b.rate - a.rate)[0] : null,
    weakestRule: loggedDates.length > 0 ? sortedRates[0] ?? null : null,
    averageSleep: average(loggedEntries.map((entry) => entry.sleepHours).filter((value): value is number => typeof value === 'number')),
    averageCalories: average(loggedEntries.map((entry) => entry.calories).filter((value): value is number => typeof value === 'number')),
    averageMood: average(loggedEntries.map((entry) => entry.mood)),
    weightChange: weights.length >= 2 ? weights[weights.length - 1] - weights[0] : null,
    reflectionCount: loggedEntries.filter((entry) => entry.wentWell.trim() || entry.difficult.trim()).length,
  }
}

function leaderboardThroughDate(entries: EntryMap, settings: ChallengeSettings): string {
  const today = todayIso()
  if (today >= settings.startDate) return today

  const loggedDates = getLoggedDates(entries, settings)
  return loggedDates[loggedDates.length - 1] ?? settings.startDate
}

function buildChallengeSummary(userId: string, entries: EntryMap, settings: ChallengeSettings, privacySettings = DEFAULT_PRIVACY_SETTINGS): ChallengeSummary {
  const privacy = normalizePrivacySettings(privacySettings)
  const loggedDates = getLoggedDates(entries, settings)
  const throughDate = leaderboardThroughDate(entries, settings)
  const weekStart = addDays(throughDate, -6) < settings.startDate ? settings.startDate : addDays(throughDate, -6)
  const weekDates = loggedDates.filter((date) => date >= weekStart && date <= throughDate)
  const averageCompletion = loggedDates.length === 0
    ? 0
    : Math.round(loggedDates.reduce((sum, date) => sum + completionStats(entries[date], settings).percent, 0) / loggedDates.length)
  const weeklyCompletion = weekDates.length === 0
    ? 0
    : Math.round(weekDates.reduce((sum, date) => sum + completionStats(entries[date], settings).percent, 0) / weekDates.length)

  return {
    userId,
    challengeTitle: settings.title,
    startDate: settings.startDate,
    endDate: throughDate,
    loggedDays: privacy.showLoggedDays ? loggedDates.length : 0,
    totalDays: trackingLength(settings, throughDate),
    averageCompletion: privacy.showAverageCompletion ? averageCompletion : 0,
    weeklyCompletion: privacy.showWeeklyCompletion ? weeklyCompletion : 0,
    currentStreak: privacy.showStreak ? currentStreak(entries, throughDate, settings) : 0,
    longestStreak: privacy.showStreak ? longestStreak(entries, settings) : 0,
    lastLoggedDate: privacy.showLoggedDays ? loggedDates[loggedDates.length - 1] ?? null : null,
    updatedAt: new Date().toISOString(),
    privacy,
  }
}

function getChallengeElapsedDates(challenge: Pick<FriendChallenge, 'startDate' | 'endDate'>): string[] {
  const today = todayIso()
  if (today < challenge.startDate) return []
  const throughDate = today > challenge.endDate ? challenge.endDate : today
  if (throughDate < challenge.startDate) return []
  return Array.from({ length: daysBetween(challenge.startDate, throughDate) + 1 }, (_, index) => addDays(challenge.startDate, index))
}

function settingsForFriendChallenge(
  challenge: FriendChallenge,
  personalSettings: ChallengeSettings,
): ChallengeSettings {
  const sourceSettings = challenge.scoringMode === 'shared' ? challenge.settings : personalSettings
  return normalizeSettings({
    ...sourceSettings,
    title: challenge.name,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
  })
}

function streakForChallengeDates(dates: string[], entries: EntryMap, settings: ChallengeSettings): { current: number; longest: number } {
  let current = 0
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const entry = entries[dates[index]]
    if (!entry || completionStats(entry, settings).percent < 100) break
    current += 1
  }

  let running = 0
  let longest = 0
  for (const date of dates) {
    const entry = entries[date]
    if (entry && completionStats(entry, settings).percent === 100) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }

  return { current, longest }
}

function buildFriendChallengeSummary(
  userId: string,
  entries: EntryMap,
  challenge: FriendChallenge,
  personalSettings: ChallengeSettings,
  privacySettings = DEFAULT_PRIVACY_SETTINGS,
): ChallengeSummary {
  const privacy = normalizePrivacySettings(privacySettings)
  const challengeSettings = settingsForFriendChallenge(challenge, personalSettings)
  const elapsedDates = getChallengeElapsedDates(challenge)
  const loggedDates = elapsedDates.filter((date) => Boolean(entries[date]))
  const weekStart = elapsedDates.length === 0 ? challenge.startDate : addDays(elapsedDates[elapsedDates.length - 1], -6)
  const weekDates = loggedDates.filter((date) => date >= weekStart)
  const averageCompletion = loggedDates.length === 0
    ? 0
    : Math.round(loggedDates.reduce((sum, date) => sum + completionStats(entries[date], challengeSettings).percent, 0) / loggedDates.length)
  const weeklyCompletion = weekDates.length === 0
    ? 0
    : Math.round(weekDates.reduce((sum, date) => sum + completionStats(entries[date], challengeSettings).percent, 0) / weekDates.length)
  const streaks = streakForChallengeDates(elapsedDates, entries, challengeSettings)

  return {
    userId,
    challengeTitle: challenge.name,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    loggedDays: privacy.showLoggedDays ? loggedDates.length : 0,
    totalDays: elapsedDates.length,
    averageCompletion: privacy.showAverageCompletion ? averageCompletion : 0,
    weeklyCompletion: privacy.showWeeklyCompletion ? weeklyCompletion : 0,
    currentStreak: privacy.showStreak ? streaks.current : 0,
    longestStreak: privacy.showStreak ? streaks.longest : 0,
    lastLoggedDate: privacy.showLoggedDays ? loggedDates[loggedDates.length - 1] ?? null : null,
    updatedAt: new Date().toISOString(),
    privacy,
  }
}

function challengeTemplateById(templateId?: string): ChallengeTemplate {
  return CHALLENGE_TEMPLATES.find((template) => template.id === templateId) ?? CHALLENGE_TEMPLATES[0]
}

function buildChallengeSettingsForTemplate(
  baseSettings: ChallengeSettings,
  templateId: string | undefined,
  title: string,
  startDate: string,
  endDate: string,
): ChallengeSettings {
  const template = challengeTemplateById(templateId)
  const targets = {
    ...baseSettings.targets,
    ...(template.targetOverrides ?? {}),
  }
  const rules = baseSettings.rules.map((rule) => {
    const builtInKey = BUILT_IN_RULE_KEYS.includes(rule.key as BuiltInRuleKey) ? rule.key as BuiltInRuleKey : null
    const override = builtInKey ? template.ruleOverrides?.[builtInKey] : undefined
    return override ? { ...rule, ...override } : rule
  })

  return normalizeSettings({
    ...baseSettings,
    title,
    startDate,
    endDate,
    targets,
    rules,
  })
}

function describeTemplateOverrides(template: ChallengeTemplate): string {
  const targetCount = Object.keys(template.targetOverrides ?? {}).length
  const activeRuleCount = Object.values(template.ruleOverrides ?? {}).filter((override) => override?.enabled === true).length
  if (targetCount === 0 && activeRuleCount === 0) return template.note
  const pieces = [
    targetCount > 0 ? `${targetCount} target ${targetCount === 1 ? 'override' : 'overrides'}` : '',
    activeRuleCount > 0 ? `${activeRuleCount} rule ${activeRuleCount === 1 ? 'preset' : 'presets'}` : '',
  ].filter(Boolean)
  return `${template.note} ${pieces.join(' · ')}.`
}

function isChallengeCompleted(challenge: Pick<FriendChallenge, 'endDate'>): boolean {
  return challenge.endDate < todayIso()
}

function statusLabel(status: FriendChallengeParticipantStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function reactionLabel(reaction: ScoreReaction | null | undefined): string | null {
  return SCORE_REACTIONS.find((item) => item.key === reaction)?.label ?? null
}

function generateInviteCode(userId: string): string {
  return `GM-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

function sortedFriendshipPair(userId: string, friendId: string): [string, string] {
  return [userId, friendId].sort() as [string, string]
}

function defaultDisplayName(user: User): string {
  return user.email?.split('@')[0] || 'New challenger'
}

function normalizeFriendProfileRow(row: unknown): FriendProfile | null {
  const candidate = row && typeof row === 'object'
    ? row as { user_id?: unknown; display_name?: unknown; invite_code?: unknown }
    : null
  if (!candidate || typeof candidate.user_id !== 'string') return null

  return {
    userId: candidate.user_id,
    displayName: typeof candidate.display_name === 'string' && candidate.display_name.trim()
      ? candidate.display_name.trim()
      : 'Challenger',
    inviteCode: typeof candidate.invite_code === 'string' ? candidate.invite_code : '',
  }
}

function normalizeFriendshipStatus(value: unknown): FriendshipStatus {
  return value === 'pending' || value === 'accepted' || value === 'declined' ? value : 'accepted'
}

function normalizeFriendChallengeParticipantStatus(value: unknown): FriendChallengeParticipantStatus {
  return value === 'pending' || value === 'accepted' || value === 'declined' ? value : 'pending'
}

function normalizeFriendChallengeScoringMode(value: unknown): FriendChallengeScoringMode {
  return value === 'shared' || value === 'personal' ? value : 'personal'
}

function normalizeScoreReaction(value: unknown): ScoreReaction | null {
  return SCORE_REACTIONS.some((reaction) => reaction.key === value) ? value as ScoreReaction : null
}

function normalizeFriendEventType(value: unknown): FriendEventType {
  switch (value) {
    case 'friend_request_sent':
    case 'friend_request_accepted':
    case 'friend_request_declined':
    case 'squad_created':
    case 'squad_updated':
    case 'squad_deleted':
    case 'challenge_created':
    case 'challenge_invites_sent':
    case 'challenge_invite_accepted':
    case 'challenge_invite_declined':
    case 'challenge_score_published':
    case 'leaderboard_score_published':
      return value
    default:
      return 'leaderboard_score_published'
  }
}

function normalizeFriendshipRow(row: unknown): FriendshipRow | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  if (!candidate || typeof candidate.user_a !== 'string' || typeof candidate.user_b !== 'string') return null

  const createdBy = typeof candidate.created_by === 'string' ? candidate.created_by : candidate.user_a
  const requestedBy = typeof candidate.requested_by === 'string' ? candidate.requested_by : createdBy

  return {
    userA: candidate.user_a,
    userB: candidate.user_b,
    createdBy,
    requestedBy,
    status: normalizeFriendshipStatus(candidate.status),
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    respondedAt: typeof candidate.responded_at === 'string' ? candidate.responded_at : null,
  }
}

function isFriendRequestSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('status')
    || message.includes('requested_by')
    || message.includes('responded_at')
    || message.includes('column')
}

function isFriendChallengeSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('god_mode_friend_challenges')
    || message.includes('god_mode_friend_challenge_participants')
    || message.includes('scoring_mode')
    || message.includes('summary')
    || message.includes('relation')
    || message.includes('column')
}

function isFriendSquadSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('god_mode_squads')
    || message.includes('god_mode_squad_members')
    || message.includes('relation')
    || message.includes('column')
}

function isFriendEventSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('god_mode_friend_events')
    || message.includes('event_type')
    || message.includes('metadata')
    || message.includes('relation')
    || message.includes('column')
}

function isSummarySchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('god_mode_challenge_summaries')
    || message.includes('privacy')
    || message.includes('column')
}

function normalizeSummaryRow(row: unknown): ChallengeSummary | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  const userId = typeof candidate?.user_id === 'string'
    ? candidate.user_id
    : typeof candidate?.userId === 'string' ? candidate.userId : null
  if (!candidate || !userId) return null

  return {
    userId,
    challengeTitle: normalizeText(candidate.challenge_title ?? candidate.challengeTitle) || DEFAULT_SETTINGS.title,
    startDate: isIsoDate(candidate.start_date) ? candidate.start_date : isIsoDate(candidate.startDate) ? candidate.startDate : DEFAULT_SETTINGS.startDate,
    endDate: isIsoDate(candidate.end_date) ? candidate.end_date : isIsoDate(candidate.endDate) ? candidate.endDate : DEFAULT_SETTINGS.endDate,
    loggedDays: normalizeBoundedNumber(candidate.logged_days ?? candidate.loggedDays, 0, 0, MAX_TRACKING_DAYS),
    totalDays: normalizeBoundedNumber(candidate.total_days ?? candidate.totalDays, 0, 0, MAX_TRACKING_DAYS),
    averageCompletion: normalizeBoundedNumber(candidate.average_completion ?? candidate.averageCompletion, 0, 0, 100),
    weeklyCompletion: normalizeBoundedNumber(candidate.weekly_completion ?? candidate.weeklyCompletion, 0, 0, 100),
    currentStreak: normalizeBoundedNumber(candidate.current_streak ?? candidate.currentStreak, 0, 0, MAX_TRACKING_DAYS),
    longestStreak: normalizeBoundedNumber(candidate.longest_streak ?? candidate.longestStreak, 0, 0, MAX_TRACKING_DAYS),
    lastLoggedDate: isIsoDate(candidate.last_logged_date) ? candidate.last_logged_date : isIsoDate(candidate.lastLoggedDate) ? candidate.lastLoggedDate : null,
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
    privacy: normalizePrivacySettings(candidate.privacy),
    note: normalizeText(candidate.note).slice(0, 180),
    reaction: normalizeScoreReaction(candidate.reaction),
  }
}

function normalizeFriendChallengeRow(row: unknown): FriendChallenge | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.creator_id !== 'string') return null

  const startDate = isIsoDate(candidate.start_date) ? candidate.start_date : todayIso()
  const endDate = isIsoDate(candidate.end_date) && candidate.end_date >= startDate
    ? candidate.end_date
    : addDays(startDate, 6)

  return {
    id: candidate.id,
    creatorId: candidate.creator_id,
    name: normalizeText(candidate.name).trim() || 'Friend Challenge',
    startDate,
    endDate,
    scoringMode: normalizeFriendChallengeScoringMode(candidate.scoring_mode),
    settings: normalizeSettings(candidate.settings),
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : new Date().toISOString(),
  }
}

function normalizeFriendChallengeParticipantRow(row: unknown): FriendChallengeParticipant | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  if (!candidate || typeof candidate.challenge_id !== 'string' || typeof candidate.user_id !== 'string') return null

  return {
    challengeId: candidate.challenge_id,
    userId: candidate.user_id,
    invitedBy: typeof candidate.invited_by === 'string' ? candidate.invited_by : candidate.user_id,
    status: normalizeFriendChallengeParticipantStatus(candidate.status),
    summary: normalizeSummaryRow(candidate.summary),
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    respondedAt: typeof candidate.responded_at === 'string' ? candidate.responded_at : null,
  }
}

function normalizeFriendSquadRow(row: unknown): FriendSquad | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.owner_id !== 'string') return null

  return {
    id: candidate.id,
    ownerId: candidate.owner_id,
    name: normalizeText(candidate.name).trim() || 'Challenge Squad',
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : new Date().toISOString(),
  }
}

function normalizeFriendSquadMemberRow(row: unknown): FriendSquadMember | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  if (!candidate || typeof candidate.squad_id !== 'string' || typeof candidate.user_id !== 'string') return null

  return {
    squadId: candidate.squad_id,
    userId: candidate.user_id,
    addedBy: typeof candidate.added_by === 'string' ? candidate.added_by : candidate.user_id,
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
  }
}

function normalizeFriendEventRow(row: unknown): FriendEvent | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.actor_id !== 'string') return null

  const metadata = candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata)
    ? candidate.metadata as Record<string, unknown>
    : {}

  return {
    id: candidate.id,
    actorId: candidate.actor_id,
    targetUserId: typeof candidate.target_user_id === 'string' ? candidate.target_user_id : null,
    challengeId: typeof candidate.challenge_id === 'string' ? candidate.challenge_id : null,
    squadId: typeof candidate.squad_id === 'string' ? candidate.squad_id : null,
    eventType: normalizeFriendEventType(candidate.event_type),
    metadata,
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
  }
}

function currentStreak(entries: EntryMap, throughDate: string, settings: ChallengeSettings): number {
  let streak = 0
  let cursor = clampDate(throughDate, settings)

  while (cursor >= settings.startDate) {
    const entry = entries[cursor]
    if (!entry || completionStats(entry, settings).percent < 100) break
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function longestStreak(entries: EntryMap, settings: ChallengeSettings): number {
  let longest = 0
  let running = 0

  for (const date of getTrackingDates(settings)) {
    const entry = entries[date]
    if (entry && completionStats(entry, settings).percent === 100) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }

  return longest
}

function ruleDetail(rule: RuleConfig, entry: DailyEntry, settings: ChallengeSettings): string | undefined {
  switch (rule.key) {
    case 'exercise':
      return `${getExerciseMinutes(entry)} / ${settings.targets.exerciseMinutes} min`
    case 'calories':
      return `${entry.calories ?? 0} / ${settings.targets.calories} kcal`
    case 'protein':
      return `${entry.proteinGrams ?? 0} / ${settings.targets.proteinGrams} g`
    case 'water':
      return `${entry.waterLiters ?? 0} / ${settings.targets.waterLiters} L`
    case 'sleep':
      return `${entry.sleepHours ?? 0} / ${settings.targets.sleepHours} hr`
    default:
      return undefined
  }
}

function calendarCellLabel(date: string, settings: ChallengeSettings): string {
  const parsed = new Date(`${date}T12:00:00`)
  const day = parsed.getDate()
  if (date === settings.startDate || day === 1) return formatShortDate(date)
  return String(day)
}

function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return cleaned || 'challenge'
}

function downloadTextFile(filename: string, mimeType: string, text: string): void {
  const blob = new Blob([text], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Clipboard copy is not available in this browser.')
}

function clearAuthRedirectUrl() {
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`)
}

async function consumeAuthRedirectSession(): Promise<User | null> {
  if (!supabase) return null

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const authError = searchParams.get('error_description') || hashParams.get('error_description')
  if (authError) throw new Error(authError)

  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
    clearAuthRedirectUrl()
    return data.user ?? data.session?.user ?? null
  }

  const authCode = searchParams.get('code')
  if (authCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode)
    if (error) throw error
    clearAuthRedirectUrl()
    return data.user ?? data.session?.user ?? null
  }

  return null
}

function makeBackupPayload(settings: ChallengeSettings, entries: EntryMap): BackupPayload {
  return {
    app: 'god-mode-july',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: normalizeSettings(settings),
    entries: normalizeEntries(entries),
  }
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function entriesToCsv(entries: EntryMap, settings: ChallengeSettings): string {
  const csvRules = getScoredRules(settings)
  const ruleColumns = csvRules.map((rule) => `rule_${rule.key}`)
  const headers = [
    'date',
    'tracking_day',
    'completion_percent',
    'completed_rules',
    'total_rules',
    ...ruleColumns,
    'finalized_at',
    'exercise_minutes',
    'workout_log',
    'sober',
    'calories',
    'protein_grams',
    'water_liters',
    'weight_pounds',
    'read_ten_pages',
    'journaled',
    'mood',
    'energy',
    'hunger',
    'sleep_hours',
    'went_well',
    'difficult',
  ]

  const rows = Object.keys(entries).sort().map((date) => {
    const entry = entries[date]
    const inChallenge = date >= settings.startDate && date <= selectableEndDate(settings)
    const stats = inChallenge ? completionStats(entry, settings) : null
    return [
      entry.date,
      inChallenge ? dayNumber(date, settings) : '',
      stats?.percent ?? '',
      stats?.completed ?? '',
      stats?.total ?? '',
      ...csvRules.map((rule) => inChallenge ? Number(ruleComplete(entry, rule.key, settings)) : ''),
      entry.finalizedAt,
      getExerciseMinutes(entry),
      formatWorkoutSummary(entry.workouts),
      Number(entry.sober),
      entry.calories,
      entry.proteinGrams,
      entry.waterLiters,
      entry.weightPounds,
      Number(entry.readTenPages),
      Number(entry.journaled),
      entry.mood,
      entry.energy,
      entry.hunger,
      entry.sleepHours,
      entry.wentWell,
      entry.difficult,
    ]
  })

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
}

async function readBackupFile(file: File): Promise<BackupPayload> {
  const text = await file.text()
  const parsed = JSON.parse(text) as unknown
  const candidate = parsed && typeof parsed === 'object' ? parsed as Partial<BackupPayload> : null
  if (!candidate || !('settings' in candidate) || !('entries' in candidate)) {
    throw new Error('Choose a JSON backup exported from this app.')
  }

  return {
    app: 'god-mode-july',
    version: 1,
    exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    settings: normalizeSettings(candidate.settings),
    entries: normalizeEntries(candidate.entries),
  }
}

function Icon({ name }: { name: 'home' | 'check' | 'calendar' | 'progress' | 'friends' | 'settings' }) {
  const paths = {
    home: <path d="M3 11.5 12 4l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5Z" />,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    progress: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    friends: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a5 5 0 0 1 10 0" /><path d="M13.5 20a4 4 0 0 1 7.5 0" /></>,
    settings: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="17" r="2" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function App() {
  const [settings, setSettings] = useState<ChallengeSettings>(() => normalizeSettings(loadFromStorage<unknown>(SETTINGS_STORAGE_KEY, null)))
  const [view, setView] = useState<View>('home')
  const [selectedDate, setSelectedDate] = useState(() => clampDate(todayIso(), settings))
  const [entries, setEntries] = useState<EntryMap>(() => normalizeEntries(loadFromStorage<unknown>(ENTRIES_STORAGE_KEY, {})))
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => normalizeReminderSettings(loadFromStorage<unknown>(REMINDER_STORAGE_KEY, null)))
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(() => normalizeSyncMeta(loadFromStorage<unknown>(SYNC_META_STORAGE_KEY, DEFAULT_SYNC_META)))
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => normalizePrivacySettings(loadFromStorage<unknown>(PRIVACY_STORAGE_KEY, null)))
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [savePulse, setSavePulse] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(() => normalizeSyncMeta(loadFromStorage<unknown>(SYNC_META_STORAGE_KEY, DEFAULT_SYNC_META)).lastCloudUpdatedAt)
  const [cloudStatus, setCloudStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: isSupabaseConfigured ? 'Sign in to sync across devices.' : 'Add Supabase env vars to enable cloud sync.',
  })
  const [reminderStatus, setReminderStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: 'Local reminders run while the app is open.',
  })
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [inviteCodeDraft, setInviteCodeDraft] = useState('')
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [friendChallenges, setFriendChallenges] = useState<FriendChallengeView[]>([])
  const [friendSquads, setFriendSquads] = useState<FriendSquadView[]>([])
  const [friendEvents, setFriendEvents] = useState<FriendEvent[]>([])
  const [friendsBusy, setFriendsBusy] = useState(false)
  const [friendsStatus, setFriendsStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: isSupabaseConfigured ? 'Sign in to compete with friends.' : 'Add Supabase env vars to enable friends.',
  })
  const [appNotice, setAppNotice] = useState<AppNotice | null>(null)
  const [showTutorial, setShowTutorial] = useState(() => {
    return loadFromStorage<unknown>(TUTORIAL_STORAGE_KEY, false) !== true && Object.keys(entries).length === 0
  })
  const [tutorialStep, setTutorialStep] = useState(0)

  const entry = entries[selectedDate] ?? makeEmptyEntry(selectedDate)
  const entryFinalized = isEntryFinalized(entry)
  const stats = completionStats(entry, settings)
  const trackerHasStarted = todayIso() >= settings.startDate
  const latestSelectableDate = selectableEndDate(settings)

  function showAppNotice(message: string, tone: AppNotice['tone'] = 'success') {
    setAppNotice({
      id: Date.now(),
      tone,
      message,
    })
  }

  function openTutorial() {
    setTutorialStep(0)
    setShowTutorial(true)
  }

  function closeTutorial(markSeen = true) {
    if (markSeen) saveToStorage(TUTORIAL_STORAGE_KEY, true)
    setShowTutorial(false)
  }

  useEffect(() => {
    saveToStorage(ENTRIES_STORAGE_KEY, entries)
    setSavePulse(true)
    const timer = window.setTimeout(() => setSavePulse(false), 700)
    return () => window.clearTimeout(timer)
  }, [entries])

  useEffect(() => {
    saveToStorage(SETTINGS_STORAGE_KEY, settings)
    setSelectedDate((date) => clampDate(date, settings))
  }, [settings])

  useEffect(() => {
    saveToStorage(REMINDER_STORAGE_KEY, reminderSettings)
  }, [reminderSettings])

  useEffect(() => {
    saveToStorage(SYNC_META_STORAGE_KEY, syncMeta)
  }, [syncMeta])

  useEffect(() => {
    saveToStorage(PRIVACY_STORAGE_KEY, privacySettings)
  }, [privacySettings])

  useEffect(() => {
    if (!appNotice) return
    const timer = window.setTimeout(() => setAppNotice(null), 3600)
    return () => window.clearTimeout(timer)
  }, [appNotice])

  useEffect(() => {
    if (!supabase) return
    const client = supabase

    let isMounted = true

    async function initializeAuthSession() {
      try {
        const redirectedUser = await consumeAuthRedirectSession()
        if (!isMounted) return

        if (redirectedUser) {
          setUser(redirectedUser)
          setCloudStatus({ tone: 'success', message: 'Signed in. Push local data or pull cloud data.' })
          return
        }

        const { data, error } = await client.auth.getSession()
        if (error) throw error
        if (!isMounted) return
        setUser(data.session?.user ?? null)
      } catch (error) {
        if (!isMounted) return
        setCloudStatus({
          tone: 'error',
          message: error instanceof Error ? `Magic link sign-in failed: ${error.message}` : 'Magic link sign-in failed.',
        })

        const { data } = await client.auth.getSession()
        if (isMounted) setUser(data.session?.user ?? null)
      }
    }

    void initializeAuthSession()

    const { data } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setCloudStatus({
        tone: event === 'PASSWORD_RECOVERY' ? 'success' : 'neutral',
        message: event === 'PASSWORD_RECOVERY'
          ? 'Password reset verified. Enter a new password below and tap Set Password.'
          : session?.user ? 'Signed in. Push local data or pull cloud data.' : 'Sign in to sync across devices.',
      })
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setFriendProfile(null)
      setDisplayNameDraft('')
      setInviteCodeDraft('')
      setLeaderboardRows([])
      setFriendRequests([])
      setFriendChallenges([])
      setFriendSquads([])
      setFriendEvents([])
      setFriendsStatus({
        tone: 'neutral',
        message: isSupabaseConfigured ? 'Sign in to compete with friends.' : 'Add Supabase env vars to enable friends.',
      })
      return
    }

    void refreshFriendsData()
  }, [user])

  useEffect(() => {
    if (!reminderSettings.enabled) return

    if (!('Notification' in window)) {
      setReminderStatus({ tone: 'error', message: 'This browser does not support notifications.' })
      return
    }

    if (Notification.permission !== 'granted') {
      setReminderStatus({ tone: 'neutral', message: 'Allow notifications to activate reminders.' })
      return
    }

    const [hours, minutes] = reminderSettings.time.split(':').map(Number)
    const nextReminder = new Date()
    nextReminder.setHours(hours, minutes, 0, 0)
    if (nextReminder.getTime() <= Date.now()) nextReminder.setDate(nextReminder.getDate() + 1)

    const showReminder = () => {
      new Notification(settings.title, {
        body: reminderSettings.message,
        icon: '/icons/pwa-192.png',
      })
    }

    let intervalId: number | undefined
    const timeoutId = window.setTimeout(() => {
      showReminder()
      intervalId = window.setInterval(showReminder, DAY_IN_MS)
    }, nextReminder.getTime() - Date.now())

    setReminderStatus({ tone: 'success', message: `Reminder scheduled for ${reminderSettings.time}.` })

    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [reminderSettings, settings.title])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const loggedDates = useMemo(() => getLoggedDates(entries, settings), [entries, settings])
  const latestWeight = useMemo(() => {
    return [...loggedDates]
      .reverse()
      .map((date) => entries[date]?.weightPounds)
      .find((weight): weight is number => typeof weight === 'number')
  }, [entries, loggedDates])

  function markLocalChanged() {
    const changedAt = new Date().toISOString()
    setSyncConflict(null)
    setSyncMeta((current) => ({
      ...current,
      lastLocalChangeAt: changedAt,
    }))
  }

  function updateEntry(patch: Partial<DailyEntry>) {
    markLocalChanged()
    setEntries((current) => ({
      ...current,
      [selectedDate]: {
        ...(current[selectedDate] ?? makeEmptyEntry(selectedDate)),
        ...patch,
        date: selectedDate,
      },
    }))
  }

  function updateEntryIfUnlocked(patch: Partial<DailyEntry>) {
    if (isEntryFinalized(entry)) return
    updateEntry(patch)
  }

  function finalizeSelectedDay() {
    markLocalChanged()
    const nextEntries = {
      ...entries,
      [selectedDate]: {
        ...entry,
        date: selectedDate,
        finalizedAt: new Date().toISOString(),
      },
    }

    setEntries(nextEntries)
    if (user) void publishFriendSummary(true, nextEntries, privacySettings)
  }

  function unlockSelectedDay() {
    markLocalChanged()
    const nextEntries = {
      ...entries,
      [selectedDate]: {
        ...entry,
        date: selectedDate,
        finalizedAt: null,
      },
    }

    setEntries(nextEntries)
  }

  function updateSettings(nextSettings: ChallengeSettings) {
    markLocalChanged()
    setSettings(normalizeSettings(nextSettings))
  }

  function replaceData(nextSettings: ChallengeSettings, nextEntries: EntryMap, markChanged = true) {
    if (markChanged) markLocalChanged()
    const normalizedSettings = normalizeSettings(nextSettings)
    setSettings(normalizedSettings)
    setEntries(normalizeEntries(nextEntries))
    setSelectedDate((date) => clampDate(date, normalizedSettings))
  }

  function updateReminder(nextReminderSettings: ReminderSettings) {
    setReminderSettings(normalizeReminderSettings(nextReminderSettings))
  }

  function updatePrivacy(nextPrivacySettings: PrivacySettings) {
    const normalizedPrivacySettings = normalizePrivacySettings(nextPrivacySettings)
    setPrivacySettings(normalizedPrivacySettings)
    if (user) void publishFriendSummary(true, entries, normalizedPrivacySettings)
  }

  function hasLocalUnsyncedChanges(): boolean {
    return timestampIsAfter(syncMeta.lastLocalChangeAt, syncMeta.lastCloudUpdatedAt)
      || (!syncMeta.lastCloudUpdatedAt && Object.keys(entries).length > 0)
  }

  function cloudChangedSinceLastSync(cloud: CloudSnapshot): boolean {
    return timestampIsAfter(cloud.updatedAt, syncMeta.lastCloudUpdatedAt)
  }

  function markSynced(updatedAt: string | null) {
    setCloudUpdatedAt(updatedAt)
    setSyncMeta({
      lastCloudUpdatedAt: updatedAt,
      lastLocalChangeAt: updatedAt,
    })
  }

  function openSyncConflict(cloud: CloudSnapshot, message: string) {
    setCloudUpdatedAt(cloud.updatedAt)
    setSyncConflict({
      cloud,
      localChangedAt: syncMeta.lastLocalChangeAt,
      message,
    })
    setCloudStatus({ tone: 'error', message })
  }

  async function fetchCloudSnapshot(): Promise<CloudSnapshot | null> {
    if (!supabase || !user) return null

    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select('settings, entries, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    return normalizeCloudSnapshot(data)
  }

  async function writeCloudSnapshot(nextSettings: ChallengeSettings, nextEntries: EntryMap): Promise<string> {
    if (!supabase || !user) throw new Error('Sign in before syncing.')

    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .upsert({
        user_id: user.id,
        settings: normalizeSettings(nextSettings),
        entries: normalizeEntries(nextEntries),
        updated_at: updatedAt,
      }, { onConflict: 'user_id' })

    if (error) throw error
    return updatedAt
  }

  async function buildAccountDataExport(): Promise<AccountDataExport> {
    if (!supabase || !user) throw new Error('Sign in before exporting account data.')

    const [
      snapshotResult,
      profileResult,
      friendshipResult,
      summaryResult,
    ] = await Promise.all([
      supabase
        .from(SUPABASE_TABLE)
        .select('settings, entries, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from(SUPABASE_PROFILE_TABLE)
        .select('user_id, display_name, invite_code')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from(SUPABASE_FRIENDSHIP_TABLE)
        .select('user_a, user_b, created_by, requested_by, status, created_at, responded_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      supabase
        .from(SUPABASE_SUMMARY_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (snapshotResult.error) throw snapshotResult.error
    if (profileResult.error) throw profileResult.error
    if (friendshipResult.error) throw friendshipResult.error
    if (summaryResult.error) throw summaryResult.error

    let friendChallenges: FriendChallenge[] = []
    let friendChallengeParticipants: FriendChallengeParticipant[] = []
    let friendSquads: FriendSquad[] = []
    let friendSquadMembers: FriendSquadMember[] = []
    let friendEvents: FriendEvent[] = []
    const [myChallengeParticipantsResult, createdChallengesResult] = await Promise.all([
      supabase
        .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
        .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
        .eq('user_id', user.id),
      supabase
        .from(SUPABASE_FRIEND_CHALLENGE_TABLE)
        .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
        .eq('creator_id', user.id),
    ])

    if (myChallengeParticipantsResult.error) {
      if (!isFriendChallengeSchemaError(myChallengeParticipantsResult.error)) throw myChallengeParticipantsResult.error
    } else if (createdChallengesResult.error) {
      if (!isFriendChallengeSchemaError(createdChallengesResult.error)) throw createdChallengesResult.error
    } else {
      const myChallengeParticipants = (myChallengeParticipantsResult.data ?? [])
        .map(normalizeFriendChallengeParticipantRow)
        .filter((row): row is FriendChallengeParticipant => row !== null)
      const createdChallenges = (createdChallengesResult.data ?? [])
        .map(normalizeFriendChallengeRow)
        .filter((row): row is FriendChallenge => row !== null)
      const challengeIds = Array.from(new Set([
        ...myChallengeParticipants.map((participant) => participant.challengeId),
        ...createdChallenges.map((challenge) => challenge.id),
      ]))

      if (challengeIds.length > 0) {
        const [challengeResult, participantResult] = await Promise.all([
          supabase
            .from(SUPABASE_FRIEND_CHALLENGE_TABLE)
            .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
            .in('id', challengeIds),
          supabase
            .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
            .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
            .in('challenge_id', challengeIds),
        ])

        if (challengeResult.error) {
          if (!isFriendChallengeSchemaError(challengeResult.error)) throw challengeResult.error
        } else {
          friendChallenges = (challengeResult.data ?? [])
            .map(normalizeFriendChallengeRow)
            .filter((row): row is FriendChallenge => row !== null)
        }

        if (participantResult.error) {
          if (!isFriendChallengeSchemaError(participantResult.error)) throw participantResult.error
        } else {
          friendChallengeParticipants = (participantResult.data ?? [])
            .map(normalizeFriendChallengeParticipantRow)
            .filter((row): row is FriendChallengeParticipant => row !== null)
        }
      }
    }

    const { data: squadRows, error: squadError } = await supabase
      .from(SUPABASE_SQUAD_TABLE)
      .select('id, owner_id, name, created_at, updated_at')
      .eq('owner_id', user.id)

    if (squadError) {
      if (!isFriendSquadSchemaError(squadError)) throw squadError
    } else {
      friendSquads = (squadRows ?? [])
        .map(normalizeFriendSquadRow)
        .filter((row): row is FriendSquad => row !== null)
      const squadIds = friendSquads.map((squad) => squad.id)
      if (squadIds.length > 0) {
        const { data: memberRows, error: memberError } = await supabase
          .from(SUPABASE_SQUAD_MEMBER_TABLE)
          .select('squad_id, user_id, added_by, created_at')
          .in('squad_id', squadIds)

        if (memberError) {
          if (!isFriendSquadSchemaError(memberError)) throw memberError
        } else {
          friendSquadMembers = (memberRows ?? [])
            .map(normalizeFriendSquadMemberRow)
            .filter((row): row is FriendSquadMember => row !== null)
        }
      }
    }

    const { data: eventRows, error: eventError } = await supabase
      .from(SUPABASE_FRIEND_EVENT_TABLE)
      .select('id, actor_id, target_user_id, challenge_id, squad_id, event_type, metadata, created_at')
      .or(`actor_id.eq.${user.id},target_user_id.eq.${user.id}`)

    if (eventError) {
      if (!isFriendEventSchemaError(eventError)) throw eventError
    } else {
      friendEvents = (eventRows ?? [])
        .map(normalizeFriendEventRow)
        .filter((row): row is FriendEvent => row !== null)
    }

    return {
      app: 'god-mode-july',
      exportType: 'account-data',
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      local: {
        settings: normalizeSettings(settings),
        entries: normalizeEntries(entries),
        privacy: normalizePrivacySettings(privacySettings),
      },
      cloud: {
        snapshot: normalizeCloudSnapshot(snapshotResult.data),
        profile: normalizeFriendProfileRow(profileResult.data),
        friendships: (friendshipResult.data ?? [])
          .map(normalizeFriendshipRow)
          .filter((row): row is FriendshipRow => row !== null),
        summary: normalizeSummaryRow(summaryResult.data),
        friendChallenges,
        friendChallengeParticipants,
        friendSquads,
        friendSquadMembers,
        friendEvents,
      },
    }
  }

  async function sendMagicLink() {
    if (!supabase) return
    const email = authEmail.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter an email address first.' })
      return
    }

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      setCloudStatus({ tone: 'success', message: 'Magic link sent. Password sign-in works better for the iPhone Home Screen app.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send the magic link.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function sendPasswordReset() {
    if (!supabase) return
    const email = authEmail.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter your email address first.' })
      return
    }

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setCloudStatus({ tone: 'success', message: 'Password reset email sent. Open the link, then set a new password here.' })
      showAppNotice('Password reset email sent.')
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send the password reset email.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function signInWithPassword() {
    if (!supabase) return
    const email = authEmail.trim()
    const password = authPassword.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter your email address first.' })
      return
    }

    if (!password) {
      setCloudStatus({ tone: 'error', message: 'Enter your password.' })
      return
    }

    setCloudBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      setUser(data.user ?? data.session?.user ?? null)
      setCloudStatus({ tone: 'success', message: 'Signed in. Push local data or pull cloud data.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not sign in with that email and password.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function createPasswordAccount() {
    if (!supabase) return
    const email = authEmail.trim()
    const password = authPassword.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter your email address first.' })
      return
    }

    if (password.length < 6) {
      setCloudStatus({ tone: 'error', message: 'Use a password with at least 6 characters.' })
      return
    }

    setCloudBusy(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error

      if (data.session?.user) {
        setUser(data.session.user)
        setCloudStatus({ tone: 'success', message: 'Account created and signed in.' })
        showAppNotice('Password set. Your account is ready.')
      } else {
        setCloudStatus({ tone: 'success', message: 'Account created. If Supabase asks for email confirmation, confirm it once, then sign in here with your password.' })
        showAppNotice('Password saved. Confirm your email if Supabase asks.')
      }
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not create account.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function setAccountPassword() {
    if (!supabase || !user) return
    const password = authPassword.trim()
    if (password.length < 6) {
      setCloudStatus({ tone: 'error', message: 'Use a password with at least 6 characters.' })
      return
    }

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setAuthPassword('')
      setCloudStatus({ tone: 'success', message: 'Password set. Next time, sign in with email and password.' })
      showAppNotice('Password set. You can use email/password next time.')
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not set the password.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function signOut() {
    if (!supabase) return

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setAuthPassword('')
      setCloudUpdatedAt(null)
      setCloudStatus({ tone: 'neutral', message: 'Signed out. Local data is still saved on this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not sign out.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function pushCloudData() {
    if (!supabase || !user) return

    setCloudBusy(true)
    try {
      const cloud = await fetchCloudSnapshot()
      if (cloud && cloudChangedSinceLastSync(cloud)) {
        openSyncConflict(cloud, 'Cloud has changed since this device last synced. Choose how to resolve before pushing.')
        return
      }

      const updatedAt = await writeCloudSnapshot(settings, entries)
      markSynced(updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Local data pushed to cloud.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not push data to cloud.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function pullCloudData() {
    if (!supabase || !user) return

    setCloudBusy(true)
    try {
      const cloud = await fetchCloudSnapshot()
      if (!cloud) {
        setCloudStatus({ tone: 'neutral', message: 'No cloud data found yet. Push this device first.' })
        return
      }

      if (cloudChangedSinceLastSync(cloud) && hasLocalUnsyncedChanges()) {
        openSyncConflict(cloud, 'Both this device and cloud changed since the last sync. Choose how to resolve.')
        return
      }

      const shouldReplace = window.confirm('Pull cloud data and replace local settings and entries on this device?')
      if (!shouldReplace) {
        setCloudStatus({ tone: 'neutral', message: 'Cloud pull canceled.' })
        return
      }

      replaceData(cloud.settings, cloud.entries, false)
      markSynced(cloud.updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Cloud data pulled onto this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not pull cloud data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function exportAccountData() {
    if (!supabase || !user) return

    setCloudBusy(true)
    try {
      const payload = await buildAccountDataExport()
      const filename = `${sanitizeFilenamePart(settings.title)}-${todayIso()}-account-data.json`
      downloadTextFile(filename, 'application/json;charset=utf-8', JSON.stringify(payload, null, 2))
      setCloudStatus({ tone: 'success', message: 'Account data export downloaded.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not export account data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function deleteCloudAccountData() {
    if (!supabase || !user) return

    const confirmed = window.confirm(
      'Delete your cloud sync snapshot, public friend profile, friend requests/friendships, squads, friend challenges, activity events, and leaderboard summaries from Supabase? Local data on this device will stay.',
    )
    if (!confirmed) {
      setCloudStatus({ tone: 'neutral', message: 'Cloud data deletion canceled.' })
      return
    }

    setCloudBusy(true)
    try {
      const friendEventDelete = await supabase
        .from(SUPABASE_FRIEND_EVENT_TABLE)
        .delete()
        .or(`actor_id.eq.${user.id},target_user_id.eq.${user.id}`)
      if (friendEventDelete.error && !isFriendEventSchemaError(friendEventDelete.error)) throw friendEventDelete.error

      const createdChallengeDelete = await supabase
        .from(SUPABASE_FRIEND_CHALLENGE_TABLE)
        .delete()
        .eq('creator_id', user.id)
      if (createdChallengeDelete.error && !isFriendChallengeSchemaError(createdChallengeDelete.error)) throw createdChallengeDelete.error

      const challengeParticipantDelete = await supabase
        .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
        .delete()
        .eq('user_id', user.id)
      if (challengeParticipantDelete.error && !isFriendChallengeSchemaError(challengeParticipantDelete.error)) throw challengeParticipantDelete.error

      const squadDelete = await supabase
        .from(SUPABASE_SQUAD_TABLE)
        .delete()
        .eq('owner_id', user.id)
      if (squadDelete.error && !isFriendSquadSchemaError(squadDelete.error)) throw squadDelete.error

      const squadMemberDelete = await supabase
        .from(SUPABASE_SQUAD_MEMBER_TABLE)
        .delete()
        .eq('user_id', user.id)
      if (squadMemberDelete.error && !isFriendSquadSchemaError(squadMemberDelete.error)) throw squadMemberDelete.error

      const friendshipDelete = await supabase
        .from(SUPABASE_FRIENDSHIP_TABLE)
        .delete()
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      if (friendshipDelete.error) throw friendshipDelete.error

      const summaryDelete = await supabase
        .from(SUPABASE_SUMMARY_TABLE)
        .delete()
        .eq('user_id', user.id)
      if (summaryDelete.error) throw summaryDelete.error

      const profileDelete = await supabase
        .from(SUPABASE_PROFILE_TABLE)
        .delete()
        .eq('user_id', user.id)
      if (profileDelete.error) throw profileDelete.error

      const snapshotDelete = await supabase
        .from(SUPABASE_TABLE)
        .delete()
        .eq('user_id', user.id)
      if (snapshotDelete.error) throw snapshotDelete.error

      setCloudUpdatedAt(null)
      setSyncConflict(null)
      setSyncMeta(DEFAULT_SYNC_META)
      setFriendProfile(null)
      setDisplayNameDraft('')
      setInviteCodeDraft('')
      setLeaderboardRows([])
      setFriendRequests([])
      setFriendChallenges([])
      setFriendSquads([])
      setFriendEvents([])
      setFriendsStatus({ tone: 'neutral', message: 'Cloud friend data deleted.' })
      setCloudStatus({ tone: 'success', message: 'Cloud account data deleted. Local data remains on this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not delete cloud account data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function useCloudConflictVersion() {
    if (!syncConflict) return

    setCloudBusy(true)
    try {
      replaceData(syncConflict.cloud.settings, syncConflict.cloud.entries, false)
      markSynced(syncConflict.cloud.updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Cloud version applied to this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not apply cloud version.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function keepLocalConflictVersion() {
    if (!syncConflict || !supabase || !user) return

    setCloudBusy(true)
    try {
      const updatedAt = await writeCloudSnapshot(settings, entries)
      markSynced(updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Local version kept and pushed to cloud.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not keep local version.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function mergeConflictEntries() {
    if (!syncConflict || !supabase || !user) return

    setCloudBusy(true)
    try {
      const mergedEntries = mergeCloudOnlyEntries(entries, syncConflict.cloud.entries)
      const addedCount = countCloudOnlyEntries(entries, syncConflict.cloud.entries)
      const updatedAt = await writeCloudSnapshot(settings, mergedEntries)
      replaceData(settings, mergedEntries, false)
      markSynced(updatedAt)
      setSyncConflict(null)
      setCloudStatus({
        tone: 'success',
        message: addedCount === 0
          ? 'Merged with no cloud-only days to add; local overlapping days were kept.'
          : `Merged ${addedCount} cloud-only ${addedCount === 1 ? 'day' : 'days'} and kept local overlapping days.`,
      })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not merge cloud and local data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  function dismissSyncConflict() {
    setSyncConflict(null)
    setCloudStatus({ tone: 'neutral', message: 'Sync conflict left unresolved.' })
  }

  async function requestReminderPermission() {
    if (!('Notification' in window)) {
      setReminderStatus({ tone: 'error', message: 'This browser does not support notifications.' })
      return
    }

    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      updateReminder({ ...reminderSettings, enabled: true })
      setReminderStatus({ tone: 'success', message: `Reminder scheduled for ${reminderSettings.time}.` })
    } else {
      setReminderStatus({ tone: 'error', message: 'Notifications were not allowed.' })
    }
  }

  async function ensureFriendProfile(): Promise<FriendProfile | null> {
    if (!supabase || !user) return null

    const { data: existingProfile, error: selectError } = await supabase
      .from(SUPABASE_PROFILE_TABLE)
      .select('user_id, display_name, invite_code')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError) throw selectError

    const normalizedExistingProfile = normalizeFriendProfileRow(existingProfile)
    if (normalizedExistingProfile) {
      setFriendProfile(normalizedExistingProfile)
      setDisplayNameDraft(normalizedExistingProfile.displayName)
      return normalizedExistingProfile
    }

    const nextProfile = {
      user_id: user.id,
      display_name: defaultDisplayName(user),
      invite_code: generateInviteCode(user.id),
    }
    const { data: createdProfile, error: createError } = await supabase
      .from(SUPABASE_PROFILE_TABLE)
      .upsert(nextProfile, { onConflict: 'user_id' })
      .select('user_id, display_name, invite_code')
      .single()

    if (createError) throw createError

    const normalizedCreatedProfile = normalizeFriendProfileRow(createdProfile)
    if (normalizedCreatedProfile) {
      setFriendProfile(normalizedCreatedProfile)
      setDisplayNameDraft(normalizedCreatedProfile.displayName)
    }
    return normalizedCreatedProfile
  }

  async function refreshFriendsData() {
    if (!supabase || !user) return

    setFriendsBusy(true)
    try {
      const profile = await ensureFriendProfile()
      if (!profile) throw new Error('Could not load your friend profile.')

      const { data: friendships, error: friendshipError } = await supabase
        .from(SUPABASE_FRIENDSHIP_TABLE)
        .select('user_a, user_b, created_by, requested_by, status, created_at, responded_at')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

      if (friendshipError) {
        if (isFriendRequestSchemaError(friendshipError)) {
          throw new Error('Run the updated Supabase schema to enable friend requests.')
        }
        throw friendshipError
      }

      const friendshipRows = (friendships ?? [])
        .map(normalizeFriendshipRow)
        .filter((row): row is FriendshipRow => row !== null)
      const acceptedFriendIds = friendshipRows
        .filter((friendship) => friendship.status === 'accepted')
        .map((friendship) => friendship.userA === user.id ? friendship.userB : friendship.userA)
        .filter((id): id is string => typeof id === 'string')
      const pendingFriendships = friendshipRows.filter((friendship) => friendship.status === 'pending')
      const pendingUserIds = pendingFriendships
        .map((friendship) => friendship.userA === user.id ? friendship.userB : friendship.userA)
        .filter((id): id is string => typeof id === 'string')
      const visibleUserIds = Array.from(new Set([user.id, ...acceptedFriendIds, ...pendingUserIds]))

      const { data: profileRows, error: profileError } = await supabase
        .from(SUPABASE_PROFILE_TABLE)
        .select('user_id, display_name, invite_code')
        .in('user_id', visibleUserIds)

      if (profileError) throw profileError

      const summaryUserIds = Array.from(new Set([user.id, ...acceptedFriendIds]))
      const { data: summaryRows, error: summaryError } = await supabase
        .from(SUPABASE_SUMMARY_TABLE)
        .select('*')
        .in('user_id', summaryUserIds)

      if (summaryError) throw summaryError

      const profiles = (profileRows ?? [])
        .map(normalizeFriendProfileRow)
        .filter((row): row is FriendProfile => row !== null)
      const profilesByUserId = new Map(profiles.map((profileRow) => [profileRow.userId, profileRow]))
      const summariesByUserId = new Map(
        (summaryRows ?? [])
          .map(normalizeSummaryRow)
          .filter((row): row is ChallengeSummary => row !== null)
          .map((summary) => [summary.userId, summary]),
      )

      if (!profiles.some((row) => row.userId === profile.userId)) profiles.push(profile)

      const rows = profiles
        .filter((profileRow) => profileRow.userId === user.id || acceptedFriendIds.includes(profileRow.userId))
        .map((profileRow) => ({
          ...profileRow,
          summary: summariesByUserId.get(profileRow.userId) ?? null,
          isCurrentUser: profileRow.userId === user.id,
        }))
        .sort((a, b) => {
          const aSummary = a.summary
          const bSummary = b.summary
          return (bSummary?.weeklyCompletion ?? 0) - (aSummary?.weeklyCompletion ?? 0)
            || (bSummary?.averageCompletion ?? 0) - (aSummary?.averageCompletion ?? 0)
            || (bSummary?.currentStreak ?? 0) - (aSummary?.currentStreak ?? 0)
            || a.displayName.localeCompare(b.displayName)
        })

      const requests = pendingFriendships
        .map((friendship) => {
          const otherUserId = friendship.userA === user.id ? friendship.userB : friendship.userA
          const requestProfile = profilesByUserId.get(otherUserId)
          if (!requestProfile) return null
          return {
            ...requestProfile,
            userA: friendship.userA,
            userB: friendship.userB,
            requestedBy: friendship.requestedBy,
            direction: friendship.requestedBy === user.id ? 'outgoing' : 'incoming',
            createdAt: friendship.createdAt,
          } satisfies FriendRequest
        })
        .filter((request): request is FriendRequest => request !== null)
        .sort((a, b) => a.direction.localeCompare(b.direction) || a.displayName.localeCompare(b.displayName))

      let challengeViews: FriendChallengeView[] = []
      let squadViews: FriendSquadView[] = []
      let eventRows: FriendEvent[] = []
      let squadSchemaReady = true
      const [myChallengeParticipantResult, createdChallengeResult] = await Promise.all([
        supabase
          .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
          .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
          .eq('user_id', user.id)
          .in('status', ['pending', 'accepted']),
        supabase
          .from(SUPABASE_FRIEND_CHALLENGE_TABLE)
          .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
          .eq('creator_id', user.id),
      ])

      if (myChallengeParticipantResult.error) {
        if (isFriendChallengeSchemaError(myChallengeParticipantResult.error)) {
          throw new Error('Run the updated Supabase schema to enable friend challenges.')
        }
        throw myChallengeParticipantResult.error
      }
      if (createdChallengeResult.error) {
        if (isFriendChallengeSchemaError(createdChallengeResult.error)) {
          throw new Error('Run the updated Supabase schema to enable friend challenges.')
        }
        throw createdChallengeResult.error
      }

      const myChallengeParticipants = (myChallengeParticipantResult.data ?? [])
        .map(normalizeFriendChallengeParticipantRow)
        .filter((participant): participant is FriendChallengeParticipant => participant !== null)
      const createdChallenges = (createdChallengeResult.data ?? [])
        .map(normalizeFriendChallengeRow)
        .filter((challenge): challenge is FriendChallenge => challenge !== null)
      const challengeIds = Array.from(new Set([
        ...myChallengeParticipants.map((participant) => participant.challengeId),
        ...createdChallenges.map((challenge) => challenge.id),
      ]))

      if (challengeIds.length > 0) {
        const [challengeResult, participantResult] = await Promise.all([
          supabase
            .from(SUPABASE_FRIEND_CHALLENGE_TABLE)
            .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
            .in('id', challengeIds),
          supabase
            .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
            .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
            .in('challenge_id', challengeIds),
        ])

        if (challengeResult.error) {
          if (isFriendChallengeSchemaError(challengeResult.error)) {
            throw new Error('Run the updated Supabase schema to enable friend challenges.')
          }
          throw challengeResult.error
        }
        if (participantResult.error) {
          if (isFriendChallengeSchemaError(participantResult.error)) {
            throw new Error('Run the updated Supabase schema to enable friend challenges.')
          }
          throw participantResult.error
        }

        const challenges = (challengeResult.data ?? [])
          .map(normalizeFriendChallengeRow)
          .filter((challenge): challenge is FriendChallenge => challenge !== null)
        const challengeParticipants = (participantResult.data ?? [])
          .map(normalizeFriendChallengeParticipantRow)
          .filter((participant): participant is FriendChallengeParticipant => participant !== null)
        const missingProfileIds = Array.from(new Set(challengeParticipants.map((participant) => participant.userId)))
          .filter((profileUserId) => !profilesByUserId.has(profileUserId))

        if (missingProfileIds.length > 0) {
          const { data: challengeProfileRows, error: challengeProfileError } = await supabase
            .from(SUPABASE_PROFILE_TABLE)
            .select('user_id, display_name, invite_code')
            .in('user_id', missingProfileIds)

          if (challengeProfileError) throw challengeProfileError
          for (const challengeProfile of (challengeProfileRows ?? [])
            .map(normalizeFriendProfileRow)
            .filter((profileRow): profileRow is FriendProfile => profileRow !== null)) {
            profilesByUserId.set(challengeProfile.userId, challengeProfile)
          }
        }

        challengeViews = challenges
          .map((challenge) => {
            const participants = challengeParticipants
              .filter((participant) => participant.challengeId === challenge.id)
              .map((participant) => {
                const participantProfile = profilesByUserId.get(participant.userId)
                return {
                  userId: participant.userId,
                  displayName: participantProfile?.displayName ?? 'Challenger',
                  inviteCode: participantProfile?.inviteCode ?? '',
                  invitedBy: participant.invitedBy,
                  status: participant.status,
                  summary: participant.summary,
                  createdAt: participant.createdAt,
                  respondedAt: participant.respondedAt,
                  isCurrentUser: participant.userId === user.id,
                } satisfies FriendChallengeParticipantView
              })
              .sort((a, b) => {
                if (a.status !== b.status) return a.status === 'accepted' ? -1 : 1
                return (b.summary?.weeklyCompletion ?? 0) - (a.summary?.weeklyCompletion ?? 0)
                  || (b.summary?.averageCompletion ?? 0) - (a.summary?.averageCompletion ?? 0)
                  || a.displayName.localeCompare(b.displayName)
              })
            const currentParticipant = challengeParticipants.find((participant) => (
              participant.challengeId === challenge.id && participant.userId === user.id
            ))

            return {
              ...challenge,
              currentUserStatus: currentParticipant?.status ?? 'pending',
              isCreator: challenge.creatorId === user.id,
              participants,
            } satisfies FriendChallengeView
          })
          .sort((a, b) => {
            if (a.currentUserStatus !== b.currentUserStatus) return a.currentUserStatus === 'pending' ? -1 : 1
            return b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name)
          })
      }

      const { data: squadRows, error: squadError } = await supabase
        .from(SUPABASE_SQUAD_TABLE)
        .select('id, owner_id, name, created_at, updated_at')
        .eq('owner_id', user.id)

      if (squadError) {
        if (isFriendSquadSchemaError(squadError)) {
          squadSchemaReady = false
        } else {
          throw squadError
        }
      } else {
        const squads = (squadRows ?? [])
          .map(normalizeFriendSquadRow)
          .filter((squad): squad is FriendSquad => squad !== null)
        const squadIds = squads.map((squad) => squad.id)
        let squadMembers: FriendSquadMember[] = []

        if (squadIds.length > 0) {
          const { data: memberRows, error: memberError } = await supabase
            .from(SUPABASE_SQUAD_MEMBER_TABLE)
            .select('squad_id, user_id, added_by, created_at')
            .in('squad_id', squadIds)

          if (memberError) {
            if (isFriendSquadSchemaError(memberError)) {
              squadSchemaReady = false
            } else {
              throw memberError
            }
          } else {
            squadMembers = (memberRows ?? [])
              .map(normalizeFriendSquadMemberRow)
              .filter((member): member is FriendSquadMember => member !== null)
          }
        }

        squadViews = squadSchemaReady
          ? squads
            .map((squad) => ({
              ...squad,
              members: squadMembers
                .filter((member) => member.squadId === squad.id && acceptedFriendIds.includes(member.userId))
                .map((member) => profilesByUserId.get(member.userId))
                .filter((memberProfile): memberProfile is FriendProfile => memberProfile !== undefined)
                .sort((a, b) => a.displayName.localeCompare(b.displayName)),
            } satisfies FriendSquadView))
            .sort((a, b) => a.name.localeCompare(b.name))
          : []
      }

      const eventActorIds = Array.from(new Set([user.id, ...acceptedFriendIds]))
      const { data: friendEventRows, error: friendEventError } = await supabase
        .from(SUPABASE_FRIEND_EVENT_TABLE)
        .select('id, actor_id, target_user_id, challenge_id, squad_id, event_type, metadata, created_at')
        .or(`actor_id.in.(${eventActorIds.join(',')}),target_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(40)

      if (friendEventError) {
        if (!isFriendEventSchemaError(friendEventError)) throw friendEventError
      } else {
        eventRows = (friendEventRows ?? [])
          .map(normalizeFriendEventRow)
          .filter((event): event is FriendEvent => event !== null)
      }

      setLeaderboardRows(rows)
      setFriendRequests(requests)
      setFriendChallenges(challengeViews)
      setFriendSquads(squadViews)
      setFriendEvents(eventRows)
      setFriendsStatus({
        tone: squadSchemaReady ? 'success' : 'neutral',
        message: squadSchemaReady
          ? `${acceptedFriendIds.length} ${acceptedFriendIds.length === 1 ? 'friend' : 'friends'} · ${squadViews.length} ${squadViews.length === 1 ? 'squad' : 'squads'} · ${requests.length} pending · ${challengeViews.length} challenges.`
          : 'Friends loaded. Run the updated Supabase schema to enable squads.',
      })
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not load friends.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function saveFriendProfile() {
    if (!supabase || !user) return

    const displayName = displayNameDraft.trim()
    if (!displayName) {
      setFriendsStatus({ tone: 'error', message: 'Display name cannot be empty.' })
      return
    }

    setFriendsBusy(true)
    try {
      const profile = await ensureFriendProfile()
      if (!profile) throw new Error('Could not load your friend profile.')

      const { data, error } = await supabase
        .from(SUPABASE_PROFILE_TABLE)
        .update({ display_name: displayName })
        .eq('user_id', user.id)
        .select('user_id, display_name, invite_code')
        .single()

      if (error) throw error
      const normalizedProfile = normalizeFriendProfileRow(data)
      if (normalizedProfile) {
        setFriendProfile(normalizedProfile)
        setDisplayNameDraft(normalizedProfile.displayName)
      }
      setFriendsStatus({ tone: 'success', message: 'Friend profile saved.' })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save friend profile.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function copyOwnInviteCode() {
    const inviteCode = friendProfile?.inviteCode
    if (!inviteCode) {
      setFriendsStatus({ tone: 'error', message: 'Invite code is still loading.' })
      showAppNotice('Invite code is still loading.', 'error')
      return
    }

    try {
      await copyTextToClipboard(inviteCode)
      setFriendsStatus({ tone: 'success', message: 'Invite code copied.' })
      showAppNotice('Invite code copied.')
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not copy invite code.',
      })
      showAppNotice('Could not copy invite code.', 'error')
    }
  }

  function buildOwnInviteMessage(): string | null {
    const inviteCode = friendProfile?.inviteCode
    if (!inviteCode) return null

    const name = friendProfile?.displayName || displayNameDraft.trim() || 'me'
    return `Add ${name} on God Mode: ${inviteCode}\n${window.location.origin}`
  }

  async function shareOwnInviteMessage() {
    const inviteMessage = buildOwnInviteMessage()
    if (!inviteMessage) {
      setFriendsStatus({ tone: 'error', message: 'Invite code is still loading.' })
      showAppNotice('Invite code is still loading.', 'error')
      return
    }

    try {
      if ('share' in navigator && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'God Mode invite',
          text: inviteMessage,
        })
        setFriendsStatus({ tone: 'success', message: 'Invite shared.' })
        return
      }

      await copyTextToClipboard(inviteMessage)
      setFriendsStatus({ tone: 'success', message: 'Invite text copied.' })
      showAppNotice('Invite text copied.')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setFriendsStatus({ tone: 'neutral', message: 'Invite share canceled.' })
        return
      }

      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not share invite.',
      })
      showAppNotice('Could not share invite.', 'error')
    }
  }

  async function recordFriendEvent(
    eventType: FriendEventType,
    options: {
      targetUserId?: string | null
      challengeId?: string | null
      squadId?: string | null
      metadata?: Record<string, unknown>
    } = {},
  ) {
    if (!supabase || !user) return

    try {
      const { error } = await supabase
        .from(SUPABASE_FRIEND_EVENT_TABLE)
        .insert({
          actor_id: user.id,
          target_user_id: options.targetUserId ?? null,
          challenge_id: options.challengeId ?? null,
          squad_id: options.squadId ?? null,
          event_type: eventType,
          metadata: options.metadata ?? {},
        })

      if (error && !isFriendEventSchemaError(error)) {
        console.warn('Could not record friend event', error)
      }
    } catch (error) {
      if (!isFriendEventSchemaError(error)) console.warn('Could not record friend event', error)
    }
  }

  async function sendFriendRequestByInviteCode() {
    if (!supabase || !user) return

    const inviteCode = inviteCodeDraft.trim().toUpperCase()
    if (!inviteCode) {
      setFriendsStatus({ tone: 'error', message: 'Enter a friend invite code first.' })
      return
    }

    setFriendsBusy(true)
    try {
      const profile = await ensureFriendProfile()
      if (!profile) throw new Error('Could not load your friend profile.')

      const { data: friendProfileRow, error: friendProfileError } = await supabase
        .from(SUPABASE_PROFILE_TABLE)
        .select('user_id, display_name, invite_code')
        .eq('invite_code', inviteCode)
        .maybeSingle()

      if (friendProfileError) throw friendProfileError
      const friendProfile = normalizeFriendProfileRow(friendProfileRow)
      if (!friendProfile) throw new Error('No friend found with that invite code.')
      if (friendProfile.userId === user.id) throw new Error('That is your own invite code.')

      const [userA, userB] = sortedFriendshipPair(user.id, friendProfile.userId)
      const { data: existingFriendshipRow, error: existingFriendshipError } = await supabase
        .from(SUPABASE_FRIENDSHIP_TABLE)
        .select('user_a, user_b, created_by, requested_by, status, created_at, responded_at')
        .eq('user_a', userA)
        .eq('user_b', userB)
        .maybeSingle()

      if (existingFriendshipError) {
        if (isFriendRequestSchemaError(existingFriendshipError)) {
          throw new Error('Run the updated Supabase schema to enable friend requests.')
        }
        throw existingFriendshipError
      }

      const existingFriendship = normalizeFriendshipRow(existingFriendshipRow)
      if (existingFriendship?.status === 'accepted') {
        throw new Error(`${friendProfile.displayName} is already on your leaderboard.`)
      }

      if (existingFriendship?.status === 'pending' && existingFriendship.requestedBy === user.id) {
        throw new Error(`You already sent ${friendProfile.displayName} a request.`)
      }

      if (existingFriendship?.status === 'pending' && existingFriendship.requestedBy !== user.id) {
        await respondToFriendRequest(friendProfile.userId, 'accepted', `${friendProfile.displayName} accepted.`)
        setInviteCodeDraft('')
        return
      }

      const nextRequest = {
        user_a: userA,
        user_b: userB,
        created_by: user.id,
        requested_by: user.id,
        status: 'pending',
        responded_at: null,
      }
      const { error: friendshipError } = existingFriendship
        ? await supabase
          .from(SUPABASE_FRIENDSHIP_TABLE)
          .update(nextRequest)
          .eq('user_a', userA)
          .eq('user_b', userB)
        : await supabase
          .from(SUPABASE_FRIENDSHIP_TABLE)
          .insert({
            ...nextRequest,
            created_at: new Date().toISOString(),
          })

      if (friendshipError) {
        if (isFriendRequestSchemaError(friendshipError)) {
          throw new Error('Run the updated Supabase schema to enable friend requests.')
        }
        throw friendshipError
      }
      await recordFriendEvent('friend_request_sent', { targetUserId: friendProfile.userId })
      setInviteCodeDraft('')
      setFriendsStatus({ tone: 'success', message: `Friend request sent to ${friendProfile.displayName}.` })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send friend request.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function respondToFriendRequest(otherUserId: string, nextStatus: 'accepted' | 'declined', successMessage?: string) {
    if (!supabase || !user) return

    setFriendsBusy(true)
    try {
      const [userA, userB] = sortedFriendshipPair(user.id, otherUserId)
      const { data, error } = await supabase
        .from(SUPABASE_FRIENDSHIP_TABLE)
        .update({
          status: nextStatus,
          responded_at: new Date().toISOString(),
        })
        .eq('user_a', userA)
        .eq('user_b', userB)
        .eq('status', 'pending')
        .neq('requested_by', user.id)
        .select('user_a')
        .maybeSingle()

      if (error) {
        if (isFriendRequestSchemaError(error)) {
          throw new Error('Run the updated Supabase schema to enable friend requests.')
        }
        throw error
      }
      if (!data) throw new Error('No incoming friend request found.')

      setFriendsStatus({
        tone: 'success',
        message: successMessage ?? (nextStatus === 'accepted' ? 'Friend request accepted.' : 'Friend request declined.'),
      })
      await recordFriendEvent(nextStatus === 'accepted' ? 'friend_request_accepted' : 'friend_request_declined', {
        targetUserId: otherUserId,
      })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update friend request.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function createFriendSquad(input: CreateFriendSquadInput) {
    if (!supabase || !user) return

    const name = input.name.trim()
    if (!name) {
      setFriendsStatus({ tone: 'error', message: 'Squad name cannot be empty.' })
      return
    }

    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const memberIds = Array.from(new Set(input.memberIds)).filter((memberId) => acceptedFriendIds.has(memberId))
    if (memberIds.length === 0) {
      setFriendsStatus({ tone: 'error', message: 'Choose at least one accepted friend for the squad.' })
      return
    }

    setFriendsBusy(true)
    try {
      const { data: squadRow, error: squadError } = await supabase
        .from(SUPABASE_SQUAD_TABLE)
        .insert({
          owner_id: user.id,
          name,
          updated_at: new Date().toISOString(),
        })
        .select('id, owner_id, name, created_at, updated_at')
        .single()

      if (squadError) {
        if (isFriendSquadSchemaError(squadError)) {
          throw new Error('Run the updated Supabase schema to enable squads.')
        }
        throw squadError
      }

      const squad = normalizeFriendSquadRow(squadRow)
      if (!squad) throw new Error('Could not create the squad.')

      const { error: memberError } = await supabase
        .from(SUPABASE_SQUAD_MEMBER_TABLE)
        .insert(memberIds.map((memberId) => ({
          squad_id: squad.id,
          user_id: memberId,
          added_by: user.id,
        })))

      if (memberError) {
        await supabase
          .from(SUPABASE_SQUAD_TABLE)
          .delete()
          .eq('id', squad.id)
          .eq('owner_id', user.id)

        if (isFriendSquadSchemaError(memberError)) {
          throw new Error('Run the updated Supabase schema to enable squads.')
        }
        throw memberError
      }

      await recordFriendEvent('squad_created', {
        squadId: squad.id,
        metadata: {
          squadName: squad.name,
          memberCount: memberIds.length,
        },
      })
      setFriendsStatus({ tone: 'success', message: `${squad.name} squad created.` })
      showAppNotice('Squad created.')
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not create the squad.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function updateFriendSquad(input: UpdateFriendSquadInput) {
    if (!supabase || !user) return

    const name = input.name.trim()
    if (!name) {
      setFriendsStatus({ tone: 'error', message: 'Squad name cannot be empty.' })
      return
    }

    const squad = friendSquads.find((item) => item.id === input.squadId)
    if (!squad) {
      setFriendsStatus({ tone: 'error', message: 'Could not find that squad.' })
      return
    }

    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const memberIds = Array.from(new Set(input.memberIds)).filter((memberId) => acceptedFriendIds.has(memberId))

    setFriendsBusy(true)
    try {
      const { error: squadError } = await supabase
        .from(SUPABASE_SQUAD_TABLE)
        .update({
          name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.squadId)
        .eq('owner_id', user.id)

      if (squadError) {
        if (isFriendSquadSchemaError(squadError)) {
          throw new Error('Run the updated Supabase schema to enable squads.')
        }
        throw squadError
      }

      const { error: deleteError } = await supabase
        .from(SUPABASE_SQUAD_MEMBER_TABLE)
        .delete()
        .eq('squad_id', input.squadId)

      if (deleteError) {
        if (isFriendSquadSchemaError(deleteError)) {
          throw new Error('Run the updated Supabase schema to enable squads.')
        }
        throw deleteError
      }

      if (memberIds.length > 0) {
        const { error: memberError } = await supabase
          .from(SUPABASE_SQUAD_MEMBER_TABLE)
          .insert(memberIds.map((memberId) => ({
            squad_id: input.squadId,
            user_id: memberId,
            added_by: user.id,
          })))

        if (memberError) {
          if (isFriendSquadSchemaError(memberError)) {
            throw new Error('Run the updated Supabase schema to enable squads.')
          }
          throw memberError
        }
      }

      await recordFriendEvent('squad_updated', {
        squadId: input.squadId,
        metadata: {
          squadName: name,
          memberCount: memberIds.length,
        },
      })
      setFriendsStatus({ tone: 'success', message: `${name} squad updated.` })
      showAppNotice('Squad updated.')
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update the squad.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function deleteFriendSquad(squadId: string) {
    if (!supabase || !user) return

    const squad = friendSquads.find((item) => item.id === squadId)
    const confirmed = window.confirm(`Delete ${squad?.name ?? 'this squad'}? Challenges already created will stay.`)
    if (!confirmed) {
      setFriendsStatus({ tone: 'neutral', message: 'Squad deletion canceled.' })
      return
    }

    setFriendsBusy(true)
    try {
      const { error } = await supabase
        .from(SUPABASE_SQUAD_TABLE)
        .delete()
        .eq('id', squadId)
        .eq('owner_id', user.id)

      if (error) {
        if (isFriendSquadSchemaError(error)) {
          throw new Error('Run the updated Supabase schema to enable squads.')
        }
        throw error
      }

      await recordFriendEvent('squad_deleted', {
        squadId,
        metadata: {
          squadName: squad?.name ?? 'Squad',
        },
      })
      setFriendsStatus({ tone: 'success', message: 'Squad deleted.' })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not delete the squad.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function createFriendChallenge(input: CreateFriendChallengeInput) {
    if (!supabase || !user) return

    const name = input.name.trim()
    if (!name) {
      setFriendsStatus({ tone: 'error', message: 'Challenge name cannot be empty.' })
      return
    }
    if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate) || input.endDate < input.startDate) {
      setFriendsStatus({ tone: 'error', message: 'Choose a valid challenge date range.' })
      return
    }

    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const inviteeIds = Array.from(new Set(input.inviteeIds)).filter((inviteeId) => acceptedFriendIds.has(inviteeId))

    setFriendsBusy(true)
    try {
      const profile = await ensureFriendProfile()
      if (!profile) throw new Error('Could not load your friend profile.')

      const challengeSettings = buildChallengeSettingsForTemplate(settings, input.templateId, name, input.startDate, input.endDate)
      const { data: challengeRow, error: challengeError } = await supabase
        .from(SUPABASE_FRIEND_CHALLENGE_TABLE)
        .insert({
          creator_id: user.id,
          name,
          start_date: input.startDate,
          end_date: input.endDate,
          scoring_mode: input.scoringMode,
          settings: challengeSettings,
          updated_at: new Date().toISOString(),
        })
        .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
        .single()

      if (challengeError) {
        if (isFriendChallengeSchemaError(challengeError)) {
          throw new Error('Run the updated Supabase schema to enable friend challenges.')
        }
        throw challengeError
      }

      const challenge = normalizeFriendChallengeRow(challengeRow)
      if (!challenge) throw new Error('Could not create the challenge.')
      const ownerSummary = buildFriendChallengeSummary(user.id, entries, challenge, settings, privacySettings)
      const now = new Date().toISOString()
      const participantRows = [
        {
          challenge_id: challenge.id,
          user_id: user.id,
          invited_by: user.id,
          status: 'accepted',
          summary: ownerSummary,
          responded_at: now,
        },
        ...inviteeIds.map((inviteeId) => ({
          challenge_id: challenge.id,
          user_id: inviteeId,
          invited_by: user.id,
          status: 'pending',
          summary: null,
          responded_at: null,
        })),
      ]

      const { error: participantError } = await supabase
        .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
        .insert(participantRows)

      if (participantError) {
        if (isFriendChallengeSchemaError(participantError)) {
          throw new Error('Run the updated Supabase schema to enable friend challenges.')
        }
        throw participantError
      }

      await recordFriendEvent('challenge_created', {
        challengeId: challenge.id,
        metadata: {
          challengeName: challenge.name,
          inviteCount: inviteeIds.length,
          templateId: input.templateId ?? 'custom',
        },
      })
      setFriendsStatus({
        tone: 'success',
        message: inviteeIds.length === 0
          ? 'Challenge created. Invite friends whenever you are ready.'
          : `Challenge created and ${inviteeIds.length} ${inviteeIds.length === 1 ? 'friend was' : 'friends were'} invited.`,
      })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not create the friend challenge.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function inviteFriendChallengeParticipants(input: InviteFriendChallengeInput) {
    if (!supabase || !user) return

    const challenge = friendChallenges.find((item) => item.id === input.challengeId)
    if (!challenge) {
      setFriendsStatus({ tone: 'error', message: 'Could not find that challenge.' })
      return
    }
    if (!challenge.isCreator) {
      setFriendsStatus({ tone: 'error', message: 'Only the challenge owner can invite more friends.' })
      return
    }

    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const existingParticipantIds = new Set(challenge.participants.map((participant) => participant.userId))
    const inviteeIds = Array.from(new Set(input.inviteeIds))
      .filter((inviteeId) => acceptedFriendIds.has(inviteeId) && !existingParticipantIds.has(inviteeId))

    if (inviteeIds.length === 0) {
      setFriendsStatus({ tone: 'error', message: 'Choose accepted friends who are not already in the challenge.' })
      return
    }

    setFriendsBusy(true)
    try {
      const { error } = await supabase
        .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
        .insert(inviteeIds.map((inviteeId) => ({
          challenge_id: challenge.id,
          user_id: inviteeId,
          invited_by: user.id,
          status: 'pending',
          summary: null,
          responded_at: null,
        })))

      if (error) {
        if (isFriendChallengeSchemaError(error)) {
          throw new Error('Run the updated Supabase schema to enable friend challenges.')
        }
        throw error
      }

      await recordFriendEvent('challenge_invites_sent', {
        challengeId: challenge.id,
        metadata: {
          challengeName: challenge.name,
          inviteCount: inviteeIds.length,
        },
      })
      setFriendsStatus({
        tone: 'success',
        message: `${inviteeIds.length} ${inviteeIds.length === 1 ? 'friend was' : 'friends were'} invited to ${challenge.name}.`,
      })
      showAppNotice('Challenge invite sent.')
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not invite friends to the challenge.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function respondToFriendChallenge(challengeId: string, nextStatus: 'accepted' | 'declined') {
    if (!supabase || !user) return

    setFriendsBusy(true)
    try {
      const challenge = friendChallenges.find((item) => item.id === challengeId)
      const updatePayload: Record<string, unknown> = {
        status: nextStatus,
        responded_at: new Date().toISOString(),
      }
      if (challenge && nextStatus === 'accepted') {
        updatePayload.summary = buildFriendChallengeSummary(user.id, entries, challenge, settings, privacySettings)
      }

      const { data, error } = await supabase
        .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
        .update(updatePayload)
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .select('challenge_id')
        .maybeSingle()

      if (error) {
        if (isFriendChallengeSchemaError(error)) {
          throw new Error('Run the updated Supabase schema to enable friend challenges.')
        }
        throw error
      }
      if (!data) throw new Error('No pending challenge invite found.')

      setFriendsStatus({
        tone: 'success',
        message: nextStatus === 'accepted' ? 'Challenge invite accepted.' : 'Challenge invite declined.',
      })
      await recordFriendEvent(nextStatus === 'accepted' ? 'challenge_invite_accepted' : 'challenge_invite_declined', {
        challengeId,
        metadata: {
          challengeName: challenge?.name ?? 'Challenge',
        },
      })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update the challenge invite.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function publishFriendChallengeScore(challengeId: string, note = '', reaction: ScoreReaction | null = null) {
    if (!supabase || !user) return

    const challenge = friendChallenges.find((item) => item.id === challengeId)
    if (!challenge) {
      setFriendsStatus({ tone: 'error', message: 'Could not find that challenge.' })
      return
    }
    if (challenge.currentUserStatus !== 'accepted') {
      setFriendsStatus({ tone: 'error', message: 'Accept the challenge before publishing a score.' })
      return
    }

    setFriendsBusy(true)
    try {
      const cleanNote = note.trim().slice(0, 180)
      const summary = {
        ...buildFriendChallengeSummary(user.id, entries, challenge, settings, privacySettings),
        note: cleanNote,
        reaction,
      }
      const { error } = await supabase
        .from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
        .update({
          summary,
          responded_at: new Date().toISOString(),
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
        .eq('status', 'accepted')

      if (error) {
        if (isFriendChallengeSchemaError(error)) {
          throw new Error('Run the updated Supabase schema to enable friend challenges.')
        }
        throw error
      }

      await recordFriendEvent('challenge_score_published', {
        challengeId,
        metadata: {
          challengeName: challenge.name,
          note: cleanNote,
          reaction,
        },
      })
      setFriendsStatus({ tone: 'success', message: `${challenge.name} score published.` })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not publish the challenge score.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function publishFriendSummary(silent = false, sourceEntries = entries, sourcePrivacySettings = privacySettings) {
    if (!supabase || !user) return

    if (!silent) setFriendsBusy(true)
    try {
      const profile = await ensureFriendProfile()
      if (!profile) throw new Error('Could not load your friend profile.')

      const summary = buildChallengeSummary(user.id, sourceEntries, settings, sourcePrivacySettings)
      const { error } = await supabase
        .from(SUPABASE_SUMMARY_TABLE)
        .upsert({
          user_id: user.id,
          challenge_title: summary.challengeTitle,
          start_date: summary.startDate,
          end_date: summary.endDate,
          logged_days: summary.loggedDays,
          total_days: summary.totalDays,
          average_completion: summary.averageCompletion,
          weekly_completion: summary.weeklyCompletion,
          current_streak: summary.currentStreak,
          longest_streak: summary.longestStreak,
          last_logged_date: summary.lastLoggedDate,
          privacy: summary.privacy,
          updated_at: summary.updatedAt,
        }, { onConflict: 'user_id' })

      if (error) {
        if (isSummarySchemaError(error)) {
          throw new Error('Run the updated Supabase schema to enable privacy settings.')
        }
        throw error
      }
      if (!silent) {
        await recordFriendEvent('leaderboard_score_published')
      }
      await refreshFriendsData()
      if (!silent) setFriendsStatus({ tone: 'success', message: 'Leaderboard score published.' })
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not publish leaderboard score.',
      })
    } finally {
      if (!silent) setFriendsBusy(false)
    }
  }

  function toggleRule(key: RuleKey) {
    if (entryFinalized) return
    const next = !ruleComplete(entry, key, settings)
    switch (key) {
      case 'exercise':
        if (next) {
          const workout = {
            id: makeWorkoutId(),
            type: 'Workout',
            minutes: settings.targets.exerciseMinutes,
          }
          updateEntry({ exerciseMinutes: workout.minutes, workouts: [workout] })
        } else {
          updateEntry({ exerciseMinutes: 0, workouts: [] })
        }
        break
      case 'sober':
        updateEntry({ sober: next })
        break
      case 'foodLogged':
        updateEntry({ foodLogged: next })
        break
      case 'calories':
        updateEntry({ calories: next ? settings.targets.calories : null })
        break
      case 'protein':
        updateEntry({ proteinGrams: next ? settings.targets.proteinGrams : 0 })
        break
      case 'water':
        updateEntry({ waterLiters: next ? settings.targets.waterLiters : null })
        break
      case 'sleep':
        updateEntry({ sleepHours: next ? settings.targets.sleepHours : null })
        break
      case 'reading':
        updateEntry({ readTenPages: next })
        break
      case 'journal':
        updateEntry({ journaled: next })
        break
      default:
        updateEntry({
          ruleCompletions: {
            ...entry.ruleCompletions,
            [key]: next,
          },
        })
        break
    }
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const friendsBadgeCount = friendRequests.filter((request) => request.direction === 'incoming').length
    + friendChallenges.filter((challenge) => challenge.currentUserStatus === 'pending' && !challenge.isCreator).length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">⚡</div>
        <div>
          <p className="eyebrow">Daily tracker</p>
          <h1>{settings.title}</h1>
        </div>
        <div className="topbar-actions">
          <span className={`save-status ${savePulse ? 'is-saving' : ''}`}>
            {savePulse ? 'Saved' : 'Local'}
          </span>
          {installPrompt && (
            <button className="install-button" type="button" onClick={installApp}>
              Install
            </button>
          )}
          <button className="install-button" type="button" onClick={openTutorial}>
            Guide
          </button>
        </div>
      </header>
      {appNotice && <AppNoticeToast notice={appNotice} onDismiss={() => setAppNotice(null)} />}

      <main>
        <section className="date-strip" aria-label="Selected day">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setSelectedDate((date) => clampDate(addDays(date, -1), settings))}
            disabled={selectedDate === settings.startDate}
          >
            ‹
          </button>
          <label>
            <span>Tracking day {dayNumber(selectedDate, settings)}</span>
            <input
              type="date"
              min={settings.startDate}
              max={latestSelectableDate}
              value={selectedDate}
              onChange={(event) => setSelectedDate(clampDate(event.target.value, settings))}
            />
          </label>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => setSelectedDate((date) => clampDate(addDays(date, 1), settings))}
            disabled={selectedDate === latestSelectableDate}
          >
            ›
          </button>
        </section>

        {!trackerHasStarted && (
          <section className="prep-banner">
            <span>PREP MODE</span>
            <p>Tracking starts {formatDate(settings.startDate)}.</p>
          </section>
        )}

        {view === 'home' && (
          <Dashboard
            entry={entry}
            entries={entries}
            selectedDate={selectedDate}
            settings={settings}
            completed={stats.completed}
            totalRules={stats.total}
            percent={stats.percent}
            latestWeight={latestWeight}
            isFinalized={entryFinalized}
            onToggleRule={toggleRule}
            onOpenCheckIn={() => setView('check-in')}
            onFinalizeDay={finalizeSelectedDay}
            onUnlockDay={unlockSelectedDay}
          />
        )}

        {view === 'check-in' && (
          <CheckIn
            entry={entry}
            settings={settings}
            isFinalized={entryFinalized}
            onUpdate={updateEntryIfUnlocked}
            onFinalizeDay={finalizeSelectedDay}
            onUnlockDay={unlockSelectedDay}
          />
        )}
        {view === 'calendar' && (
          <CalendarView
            entries={entries}
            selectedDate={selectedDate}
            settings={settings}
            onSelectDate={(date) => {
              setSelectedDate(date)
              setView('home')
            }}
          />
        )}
        {view === 'progress' && <ProgressView entries={entries} settings={settings} />}
        {view === 'friends' && (
          <FriendsView
            configured={isSupabaseConfigured}
            user={user}
            profile={friendProfile}
            displayName={displayNameDraft}
            inviteCode={inviteCodeDraft}
            leaderboardRows={leaderboardRows}
            friendRequests={friendRequests}
            friendChallenges={friendChallenges}
            friendSquads={friendSquads}
            friendEvents={friendEvents}
            privacySettings={privacySettings}
            status={friendsStatus}
            busy={friendsBusy}
            onDisplayNameChange={setDisplayNameDraft}
            onInviteCodeChange={setInviteCodeDraft}
            onSaveProfile={saveFriendProfile}
            onCopyInviteCode={copyOwnInviteCode}
            onShareInviteMessage={shareOwnInviteMessage}
            onPrivacyChange={updatePrivacy}
            onAddFriend={sendFriendRequestByInviteCode}
            onAcceptRequest={(userId) => respondToFriendRequest(userId, 'accepted')}
            onDeclineRequest={(userId) => respondToFriendRequest(userId, 'declined')}
            onCreateSquad={createFriendSquad}
            onUpdateSquad={updateFriendSquad}
            onDeleteSquad={deleteFriendSquad}
            onCreateChallenge={createFriendChallenge}
            onInviteChallengeParticipants={inviteFriendChallengeParticipants}
            onAcceptChallenge={(challengeId) => respondToFriendChallenge(challengeId, 'accepted')}
            onDeclineChallenge={(challengeId) => respondToFriendChallenge(challengeId, 'declined')}
            onPublishChallengeScore={publishFriendChallengeScore}
            onPublishSummary={() => publishFriendSummary(false)}
            onRefresh={refreshFriendsData}
            onOpenSettings={() => setView('settings')}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            settings={settings}
            entries={entries}
            reminderSettings={reminderSettings}
            reminderStatus={reminderStatus}
            cloudConfigured={isSupabaseConfigured}
            cloudStatus={cloudStatus}
            cloudBusy={cloudBusy}
            cloudUpdatedAt={cloudUpdatedAt}
            syncConflict={syncConflict}
            user={user}
            authEmail={authEmail}
            authPassword={authPassword}
            onSettingsChange={updateSettings}
            onDataImport={replaceData}
            onReminderChange={updateReminder}
            onRequestReminderPermission={requestReminderPermission}
            onAuthEmailChange={setAuthEmail}
            onAuthPasswordChange={setAuthPassword}
            onSignInWithPassword={signInWithPassword}
            onCreatePasswordAccount={createPasswordAccount}
            onSetAccountPassword={setAccountPassword}
            onSendMagicLink={sendMagicLink}
            onSendPasswordReset={sendPasswordReset}
            onSignOut={signOut}
            onPushCloud={pushCloudData}
            onPullCloud={pullCloudData}
            onExportAccountData={exportAccountData}
            onDeleteCloudAccountData={deleteCloudAccountData}
            onUseCloudVersion={useCloudConflictVersion}
            onKeepLocalVersion={keepLocalConflictVersion}
            onMergeCloudEntries={mergeConflictEntries}
            onDismissConflict={dismissSyncConflict}
          />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton label="Home" icon="home" active={view === 'home'} onClick={() => setView('home')} />
        <NavButton label="Check-In" icon="check" active={view === 'check-in'} onClick={() => setView('check-in')} />
        <NavButton label="Calendar" icon="calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
        <NavButton label="Progress" icon="progress" active={view === 'progress'} onClick={() => setView('progress')} />
        <NavButton label="Friends" icon="friends" active={view === 'friends'} onClick={() => setView('friends')} badgeCount={friendsBadgeCount} />
        <NavButton label="Settings" icon="settings" active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>
      {showTutorial && (
        <TutorialOverlay
          step={tutorialStep}
          onStepChange={setTutorialStep}
          onClose={() => closeTutorial(true)}
          onNavigate={(nextView) => {
            setView(nextView)
            closeTutorial(true)
          }}
        />
      )}
    </div>
  )
}

function AppNoticeToast({ notice, onDismiss }: { notice: AppNotice; onDismiss: () => void }) {
  return (
    <div className={`app-notice ${notice.tone}`} role="status" aria-live="polite">
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
        x
      </button>
    </div>
  )
}

function TutorialOverlay({
  step,
  onStepChange,
  onClose,
  onNavigate,
}: {
  step: number
  onStepChange: (step: number) => void
  onClose: () => void
  onNavigate: (view: View) => void
}) {
  const currentStep = TUTORIAL_STEPS[step] ?? TUTORIAL_STEPS[0]
  const isFirst = step === 0
  const isLast = step === TUTORIAL_STEPS.length - 1
  const targetView: View = step === 1 ? 'check-in' : step === 3 ? 'settings' : step === 4 ? 'friends' : 'home'
  const targetLabel = targetView === 'check-in' ? 'Open Check-In' : `Open ${targetView.charAt(0).toUpperCase()}${targetView.slice(1)}`

  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section className="tutorial-panel">
        <div className="tutorial-header">
          <div>
            <p className="eyebrow">{currentStep.eyebrow}</p>
            <h2 id="tutorial-title">{currentStep.title}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Skip
          </button>
        </div>
        <p>{currentStep.body}</p>
        <div className="tutorial-progress" aria-label="Tutorial progress">
          {TUTORIAL_STEPS.map((tutorialStep, index) => (
            <span className={index === step ? 'active' : ''} key={tutorialStep.title} />
          ))}
        </div>
        <div className="tutorial-actions">
          <button className="ghost-button" type="button" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={isFirst}>
            Back
          </button>
          <button className="secondary-button" type="button" onClick={() => onNavigate(targetView)}>
            {targetLabel}
          </button>
          {isLast ? (
            <button className="primary-button" type="button" onClick={onClose}>
              Finish
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={() => onStepChange(Math.min(TUTORIAL_STEPS.length - 1, step + 1))}>
              Next
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

function Dashboard({
  entry,
  entries,
  selectedDate,
  settings,
  completed,
  totalRules,
  percent,
  latestWeight,
  isFinalized,
  onToggleRule,
  onOpenCheckIn,
  onFinalizeDay,
  onUnlockDay,
}: {
  entry: DailyEntry
  entries: EntryMap
  selectedDate: string
  settings: ChallengeSettings
  completed: number
  totalRules: number
  percent: number
  latestWeight: number | undefined
  isFinalized: boolean
  onToggleRule: (key: RuleKey) => void
  onOpenCheckIn: () => void
  onFinalizeDay: () => void
  onUnlockDay: () => void
}) {
  const activeRules = getEnabledRules(settings)

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">{formatDate(selectedDate)}</p>
          <h2>{isFinalized ? 'Day finalized.' : percent === 100 ? 'God mode secured.' : 'Build the day.'}</h2>
          <p>{completed} of {totalRules} rules complete{isFinalized && entry.finalizedAt ? ` · ${formatDateTime(entry.finalizedAt)}` : ''}</p>
        </div>
        <div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` } as CSSProperties}>
          <div>
            <strong>{percent}%</strong>
            <span>today</span>
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Tracker summary">
        <StatCard label="Current streak" value={`${currentStreak(entries, selectedDate, settings)} days`} icon="🔥" />
        <StatCard label="Longest streak" value={`${longestStreak(entries, settings)} days`} icon="🏆" />
        <StatCard label="Latest weight" value={latestWeight ? `${latestWeight.toFixed(1)} lb` : '—'} icon="◒" />
      </section>

      <section className="panel rules-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Daily standards</p>
            <h2>Today’s Rules</h2>
          </div>
          <span>{completed}/{totalRules}</span>
        </div>

        <div className="rule-list">
          {activeRules.map((rule) => {
            const isComplete = ruleComplete(entry, rule.key, settings)
            const detail = ruleDetail(rule, entry, settings)

            return (
              <button
                className={`rule-row ${isComplete ? 'is-complete' : ''}`}
                type="button"
                key={rule.key}
                onClick={() => onToggleRule(rule.key)}
                disabled={isFinalized}
              >
                <span className="rule-icon">{rule.icon}</span>
                <span className="rule-label">
                  <strong>{rule.label}</strong>
                  <small>{detail ?? (rule.weight === 'nonNegotiable' ? 'Non-negotiable' : 'Supporting')}</small>
                </span>
                <span className="rule-check" aria-label={isComplete ? 'Complete' : 'Incomplete'}>
                  {isComplete ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>

        <button className="primary-button" type="button" onClick={onOpenCheckIn}>
          Open full check-in
        </button>
        {isFinalized ? (
          <button className="secondary-button" type="button" onClick={onUnlockDay}>
            Unlock Day
          </button>
        ) : (
          <button className="secondary-button" type="button" onClick={onFinalizeDay}>
            Finalize Day
          </button>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <article className="stat-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  )
}

function CheckIn({
  entry,
  settings,
  isFinalized,
  onUpdate,
  onFinalizeDay,
  onUnlockDay,
}: {
  entry: DailyEntry
  settings: ChallengeSettings
  isFinalized: boolean
  onUpdate: (patch: Partial<DailyEntry>) => void
  onFinalizeDay: () => void
  onUnlockDay: () => void
}) {
  const workoutLogs = Array.isArray(entry.workouts) ? entry.workouts : []
  const workoutTotal = getExerciseMinutes(entry)
  const workoutProgress = Math.min(100, Math.round((workoutTotal / settings.targets.exerciseMinutes) * 100))

  function updateWorkouts(nextWorkouts: WorkoutLog[]) {
    const workouts = normalizeWorkoutLogs(nextWorkouts)
    onUpdate({
      workouts,
      exerciseMinutes: workoutMinutesTotal(workouts),
    })
  }

  function updateWorkout(id: string, patch: Partial<WorkoutLog>) {
    updateWorkouts(workoutLogs.map((workout) => workout.id === id ? { ...workout, ...patch } : workout))
  }

  function addWorkout() {
    if (workoutLogs.length >= MAX_WORKOUT_LOGS) return
    updateWorkouts([...workoutLogs, makeEmptyWorkout()])
  }

  function removeWorkout(id: string) {
    updateWorkouts(workoutLogs.filter((workout) => workout.id !== id))
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">{isFinalized ? 'Finalized' : 'Daily input'}</p>
        <h2>Check-In</h2>
        <p>{isFinalized && entry.finalizedAt ? `Locked ${formatDateTime(entry.finalizedAt)}.` : 'Track the facts. Honest data is more useful than a perfect score.'}</p>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="1" title="Workout" />
        <div className="workout-summary">
          <div>
            <strong>{workoutTotal} / {settings.targets.exerciseMinutes} min</strong>
            <span>{workoutProgress}% of daily workout target</span>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={addWorkout} disabled={isFinalized || workoutLogs.length >= MAX_WORKOUT_LOGS}>
            Add Exercise
          </button>
        </div>
        {workoutLogs.length === 0 ? (
          <p className="empty-workout-log">Add a workout entry to count minutes toward your exercise rule.</p>
        ) : (
          <div className="workout-log-list">
            {workoutLogs.map((workout) => (
              <article className="workout-log-row" key={workout.id}>
                <SelectField
                  disabled={isFinalized}
                  label="Type"
                  value={workout.type}
                  options={WORKOUT_TYPES}
                  onChange={(type) => updateWorkout(workout.id, { type })}
                />
                <NumberField
                  disabled={isFinalized}
                  label="Minutes"
                  value={workout.minutes}
                  min={0}
                  max={MAX_WORKOUT_MINUTES}
                  step={5}
                  onChange={(value) => updateWorkout(workout.id, { minutes: value ?? 0 })}
                  suffix="min"
                />
                <button className="ghost-button workout-remove-button" type="button" onClick={() => removeWorkout(workout.id)} disabled={isFinalized}>
                  Remove
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel form-panel">
        <SectionTitle number="2" title="Nutrition" />
        <div className="field-grid">
          <NumberField disabled={isFinalized} label={`Calories (${settings.targets.calories} kcal target)`} value={entry.calories} min={0} max={10000} onChange={(value) => onUpdate({ calories: value })} suffix="kcal" />
          <NumberField disabled={isFinalized} label={`Protein (${settings.targets.proteinGrams} g goal)`} value={entry.proteinGrams} min={0} max={500} onChange={(value) => onUpdate({ proteinGrams: value })} suffix="g" />
          <NumberField disabled={isFinalized} label={`Water (${settings.targets.waterLiters} L goal)`} value={entry.waterLiters} min={0} max={15} step={0.1} onChange={(value) => onUpdate({ waterLiters: value })} suffix="L" />
          <NumberField disabled={isFinalized} label="Weight" value={entry.weightPounds} min={50} max={700} step={0.1} onChange={(value) => onUpdate({ weightPounds: value })} suffix="lb" />
        </div>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="3" title="Discipline" />
        <CheckField disabled={isFinalized} label="Sober" checked={entry.sober} onChange={(checked) => onUpdate({ sober: checked })} />
        <CheckField disabled={isFinalized} label="Read 10 pages" checked={entry.readTenPages} onChange={(checked) => onUpdate({ readTenPages: checked })} />
        <CheckField disabled={isFinalized} label="Journal completed" checked={entry.journaled} onChange={(checked) => onUpdate({ journaled: checked })} />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="4" title="Body + Mind" />
        <NumberField disabled={isFinalized} label={`Sleep hours (${settings.targets.sleepHours} hr target)`} value={entry.sleepHours} min={0} max={24} step={0.25} onChange={(value) => onUpdate({ sleepHours: value })} suffix="hours" />
        <div className="rating-grid">
          <RatingField disabled={isFinalized} label="Mood" value={entry.mood} onChange={(value) => onUpdate({ mood: value })} />
          <RatingField disabled={isFinalized} label="Energy" value={entry.energy} onChange={(value) => onUpdate({ energy: value })} />
          <RatingField disabled={isFinalized} label="Hunger" value={entry.hunger} onChange={(value) => onUpdate({ hunger: value })} />
        </div>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="5" title="Reflection" />
        <TextArea disabled={isFinalized} label="What went well?" value={entry.wentWell} placeholder="Name the win you want to repeat." onChange={(value) => onUpdate({ wentWell: value })} />
        <TextArea disabled={isFinalized} label="What made today difficult?" value={entry.difficult} placeholder="Record the trigger, obstacle, or weak point." onChange={(value) => onUpdate({ difficult: value })} />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="6" title="Finalize" />
        {isFinalized ? (
          <button className="secondary-button" type="button" onClick={onUnlockDay}>
            Unlock Day
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onFinalizeDay}>
            Finalize Day
          </button>
        )}
      </section>

      <p className="autosave-note">{isFinalized ? 'This day is locked until you unlock it.' : 'Changes save automatically on this device.'}</p>
    </div>
  )
}

function sortLeaderboardRows(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    const aSummary = a.summary
    const bSummary = b.summary
    return (bSummary?.weeklyCompletion ?? 0) - (aSummary?.weeklyCompletion ?? 0)
      || (bSummary?.averageCompletion ?? 0) - (aSummary?.averageCompletion ?? 0)
      || (bSummary?.currentStreak ?? 0) - (aSummary?.currentStreak ?? 0)
      || a.displayName.localeCompare(b.displayName)
  })
}

function getSquadLeaderboardRows(squad: FriendSquadView, leaderboardRows: LeaderboardRow[]): LeaderboardRow[] {
  const squadMemberIds = new Set(squad.members.map((member) => member.userId))
  return sortLeaderboardRows(
    leaderboardRows.filter((row) => row.isCurrentUser || squadMemberIds.has(row.userId)),
  )
}

function formatActivityDate(value: string): string {
  const date = value.slice(0, 10)
  return isIsoDate(date) ? formatShortDate(date) : 'Recently'
}

function buildFriendActivityFeed({
  leaderboardRows,
  friendRequests,
  friendChallenges,
  friendSquads,
}: {
  leaderboardRows: LeaderboardRow[]
  friendRequests: FriendRequest[]
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
}): FriendActivityFeedItem[] {
  const feed: FriendActivityFeedItem[] = []

  for (const request of friendRequests) {
    feed.push({
      id: `request-${request.userA}-${request.userB}`,
      title: request.direction === 'incoming' ? 'Friend request received' : 'Friend request sent',
      detail: request.direction === 'incoming'
        ? `${request.displayName} wants to connect.`
        : `Waiting for ${request.displayName} to respond.`,
      meta: formatActivityDate(request.createdAt),
      tone: 'pending',
      sortAt: request.createdAt,
    })
  }

  for (const squad of friendSquads) {
    feed.push({
      id: `squad-${squad.id}`,
      title: `${squad.name} squad`,
      detail: squad.members.length === 0
        ? 'No active members yet.'
        : `${squad.members.length} ${squad.members.length === 1 ? 'member' : 'members'} ready for challenges.`,
      meta: formatActivityDate(squad.updatedAt),
      tone: squad.members.length > 0 ? 'success' : 'neutral',
      sortAt: squad.updatedAt,
    })
  }

  for (const challenge of friendChallenges) {
    const acceptedCount = challenge.participants.filter((participant) => participant.status === 'accepted').length
    const pendingCount = challenge.participants.filter((participant) => participant.status === 'pending').length
    feed.push({
      id: `challenge-${challenge.id}`,
      title: challenge.currentUserStatus === 'pending' && !challenge.isCreator ? 'Challenge invite waiting' : challenge.name,
      detail: challenge.currentUserStatus === 'pending' && !challenge.isCreator
        ? `Accept or decline ${challenge.name}.`
        : `${acceptedCount} active · ${pendingCount} invited.`,
      meta: `${formatShortDate(challenge.startDate)} - ${formatShortDate(challenge.endDate)}`,
      tone: challenge.currentUserStatus === 'pending' && !challenge.isCreator ? 'pending' : 'neutral',
      sortAt: challenge.updatedAt,
    })
  }

  for (const row of leaderboardRows) {
    if (row.isCurrentUser || !row.summary) continue
    feed.push({
      id: `summary-${row.userId}-${row.summary.updatedAt}`,
      title: `${row.displayName} published a score`,
      detail: `${formatSummaryMetric(row.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)} last 7 days.`,
      meta: formatActivityDate(row.summary.updatedAt),
      tone: 'success',
      sortAt: row.summary.updatedAt,
    })
  }

  return feed
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
    .slice(0, 10)
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function eventProfileName(userId: string | null, profilesByUserId: Map<string, FriendProfile>, currentUserId: string | null): string {
  if (!userId) return 'Someone'
  if (currentUserId && userId === currentUserId) return 'You'
  return profilesByUserId.get(userId)?.displayName ?? 'A friend'
}

function buildStoredFriendActivityFeed({
  friendEvents,
  leaderboardRows,
  friendChallenges,
  friendSquads,
  currentUserId,
}: {
  friendEvents: FriendEvent[]
  leaderboardRows: LeaderboardRow[]
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
  currentUserId: string | null
}): FriendActivityFeedItem[] {
  const profilesByUserId = new Map<string, FriendProfile>(
    leaderboardRows.map((row) => [row.userId, {
      userId: row.userId,
      displayName: row.displayName,
      inviteCode: row.inviteCode,
    }]),
  )
  const challengesById = new Map(friendChallenges.map((challenge) => [challenge.id, challenge]))
  const squadsById = new Map(friendSquads.map((squad) => [squad.id, squad]))

  return friendEvents.map((event) => {
    const actor = eventProfileName(event.actorId, profilesByUserId, currentUserId)
    const target = eventProfileName(event.targetUserId, profilesByUserId, currentUserId)
    const eventChallengeName = event.challengeId ? challengesById.get(event.challengeId)?.name ?? '' : ''
    const eventSquadName = event.squadId ? squadsById.get(event.squadId)?.name ?? '' : ''
    const challengeName = eventChallengeName || metadataString(event.metadata, 'challengeName') || 'Challenge'
    const squadName = eventSquadName || metadataString(event.metadata, 'squadName') || 'Squad'
    const inviteCount = metadataNumber(event.metadata, 'inviteCount')
    const note = metadataString(event.metadata, 'note')
    const reaction = reactionLabel(normalizeScoreReaction(event.metadata.reaction))
    let title = 'Friend activity'
    let detail = `${actor} updated something.`
    let tone: FriendActivityFeedItem['tone'] = 'neutral'

    switch (event.eventType) {
      case 'friend_request_sent':
        title = 'Friend request sent'
        detail = `${actor} sent ${target} a friend request.`
        tone = 'pending'
        break
      case 'friend_request_accepted':
        title = 'Friend request accepted'
        detail = `${actor} and ${target} are connected.`
        tone = 'success'
        break
      case 'friend_request_declined':
        title = 'Friend request declined'
        detail = `${actor} declined a friend request.`
        break
      case 'squad_created':
        title = `${squadName} squad created`
        detail = `${actor} saved a private squad.`
        tone = 'success'
        break
      case 'squad_updated':
        title = `${squadName} squad updated`
        detail = `${actor} changed the squad roster.`
        tone = 'success'
        break
      case 'squad_deleted':
        title = 'Squad deleted'
        detail = `${actor} deleted ${squadName}.`
        break
      case 'challenge_created':
        title = `${challengeName} created`
        detail = inviteCount && inviteCount > 0
          ? `${actor} invited ${inviteCount} ${inviteCount === 1 ? 'friend' : 'friends'}.`
          : `${actor} created a friend challenge.`
        tone = inviteCount && inviteCount > 0 ? 'pending' : 'success'
        break
      case 'challenge_invites_sent':
        title = 'Challenge invites sent'
        detail = `${actor} invited ${inviteCount ?? 0} ${inviteCount === 1 ? 'friend' : 'friends'} to ${challengeName}.`
        tone = 'pending'
        break
      case 'challenge_invite_accepted':
        title = 'Challenge invite accepted'
        detail = `${actor} joined ${challengeName}.`
        tone = 'success'
        break
      case 'challenge_invite_declined':
        title = 'Challenge invite declined'
        detail = `${actor} declined ${challengeName}.`
        break
      case 'challenge_score_published':
        title = `${actor} published a challenge score`
        detail = `${challengeName}${reaction ? ` · ${reaction}` : ''}${note ? ` · ${note}` : ''}`
        tone = 'success'
        break
      case 'leaderboard_score_published':
        title = `${actor} published a leaderboard score`
        detail = 'Leaderboard stats were refreshed.'
        tone = 'success'
        break
    }

    return {
      id: `event-${event.id}`,
      title,
      detail,
      meta: formatActivityDate(event.createdAt),
      tone,
      sortAt: event.createdAt,
    }
  }).sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()).slice(0, 20)
}

function FriendsView({
  configured,
  user,
  profile,
  displayName,
  inviteCode,
  leaderboardRows,
  friendRequests,
  friendChallenges,
  friendSquads,
  friendEvents,
  privacySettings,
  status,
  busy,
  onDisplayNameChange,
  onInviteCodeChange,
  onSaveProfile,
  onCopyInviteCode,
  onShareInviteMessage,
  onPrivacyChange,
  onAddFriend,
  onAcceptRequest,
  onDeclineRequest,
  onCreateSquad,
  onUpdateSquad,
  onDeleteSquad,
  onCreateChallenge,
  onInviteChallengeParticipants,
  onAcceptChallenge,
  onDeclineChallenge,
  onPublishChallengeScore,
  onPublishSummary,
  onRefresh,
  onOpenSettings,
}: {
  configured: boolean
  user: User | null
  profile: FriendProfile | null
  displayName: string
  inviteCode: string
  leaderboardRows: LeaderboardRow[]
  friendRequests: FriendRequest[]
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
  friendEvents: FriendEvent[]
  privacySettings: PrivacySettings
  status: DataStatus
  busy: boolean
  onDisplayNameChange: (value: string) => void
  onInviteCodeChange: (value: string) => void
  onSaveProfile: () => void
  onCopyInviteCode: () => void
  onShareInviteMessage: () => void
  onPrivacyChange: (privacySettings: PrivacySettings) => void
  onAddFriend: () => void
  onAcceptRequest: (userId: string) => void
  onDeclineRequest: (userId: string) => void
  onCreateSquad: (input: CreateFriendSquadInput) => void
  onUpdateSquad: (input: UpdateFriendSquadInput) => void
  onDeleteSquad: (squadId: string) => void
  onCreateChallenge: (input: CreateFriendChallengeInput) => void
  onInviteChallengeParticipants: (input: InviteFriendChallengeInput) => void
  onAcceptChallenge: (challengeId: string) => void
  onDeclineChallenge: (challengeId: string) => void
  onPublishChallengeScore: (challengeId: string, note?: string, reaction?: ScoreReaction | null) => void
  onPublishSummary: () => void
  onRefresh: () => void
  onOpenSettings: () => void
}) {
  const incomingRequests = friendRequests.filter((request) => request.direction === 'incoming')
  const outgoingRequests = friendRequests.filter((request) => request.direction === 'outgoing')
  const acceptedFriends = leaderboardRows.filter((row) => !row.isCurrentUser)
  const [activeFriendsTab, setActiveFriendsTab] = useState<FriendsTab>('overview')
  const [challengeTemplateId, setChallengeTemplateId] = useState(CHALLENGE_TEMPLATES[1]?.id ?? 'custom')
  const [challengeName, setChallengeName] = useState('No Zero Days')
  const [challengeStartDate, setChallengeStartDate] = useState(todayIso())
  const [challengeEndDate, setChallengeEndDate] = useState(addDays(todayIso(), 6))
  const [challengeScoringMode, setChallengeScoringMode] = useState<FriendChallengeScoringMode>('personal')
  const [challengeInviteIds, setChallengeInviteIds] = useState<string[]>([])
  const [squadName, setSquadName] = useState('Training Squad')
  const [squadMemberIds, setSquadMemberIds] = useState<string[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const currentUserId = user?.id ?? null
  const activityFeed = useMemo(() => (
    friendEvents.length > 0
      ? buildStoredFriendActivityFeed({
        friendEvents,
        leaderboardRows,
        friendChallenges,
        friendSquads,
        currentUserId,
      })
      : buildFriendActivityFeed({
        leaderboardRows,
        friendRequests,
        friendChallenges,
        friendSquads,
      })
  ), [friendEvents, leaderboardRows, friendRequests, friendChallenges, friendSquads, currentUserId])
  const pendingCount = incomingRequests.length + friendChallenges.filter((challenge) => challenge.currentUserStatus === 'pending' && !challenge.isCreator).length
  const networkBadgeCount = incomingRequests.length
  const challengeBadgeCount = friendChallenges.filter((challenge) => challenge.currentUserStatus === 'pending' && !challenge.isCreator).length
  const activeChallenges = friendChallenges.filter((challenge) => !isChallengeCompleted(challenge))
  const completedChallenges = friendChallenges.filter(isChallengeCompleted)
  const selectedChallenge = selectedChallengeId ? friendChallenges.find((challenge) => challenge.id === selectedChallengeId) ?? null : null
  const selectedFriend = selectedFriendId ? acceptedFriends.find((friend) => friend.userId === selectedFriendId) ?? null : null
  const currentUserRow = leaderboardRows.find((row) => row.isCurrentUser) ?? null

  function toggleChallengeInvite(userId: string) {
    setChallengeInviteIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function toggleSquadMember(userId: string) {
    setSquadMemberIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function applySquadToChallenge(squad: FriendSquadView) {
    const memberIds = squad.members.map((member) => member.userId)
    setChallengeInviteIds((current) => Array.from(new Set([...current, ...memberIds])))
  }

  function applyChallengeTemplate(templateId: string) {
    const template = CHALLENGE_TEMPLATES.find((item) => item.id === templateId) ?? CHALLENGE_TEMPLATES[0]
    setChallengeTemplateId(template.id)
    if (template.id === 'custom') return

    setChallengeName(template.name)
    setChallengeScoringMode(template.scoringMode)
    if (isIsoDate(challengeStartDate)) setChallengeEndDate(addDays(challengeStartDate, template.durationDays - 1))
  }

  function updateChallengeStartDate(startDate: string) {
    setChallengeStartDate(startDate)
    const template = CHALLENGE_TEMPLATES.find((item) => item.id === challengeTemplateId)
    if (template && template.id !== 'custom' && isIsoDate(startDate)) {
      setChallengeEndDate(addDays(startDate, template.durationDays - 1))
    }
  }

  function submitSquad() {
    const acceptedFriendIds = new Set(acceptedFriends.map((friend) => friend.userId))
    onCreateSquad({
      name: squadName,
      memberIds: squadMemberIds.filter((userId) => acceptedFriendIds.has(userId)),
    })
  }

  function submitChallenge() {
    const acceptedFriendIds = new Set(acceptedFriends.map((friend) => friend.userId))
    onCreateChallenge({
      name: challengeName,
      startDate: challengeStartDate,
      endDate: challengeEndDate,
      scoringMode: challengeScoringMode,
      inviteeIds: challengeInviteIds.filter((userId) => acceptedFriendIds.has(userId)),
      templateId: challengeTemplateId,
    })
  }

  if (!configured) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <p className="eyebrow">Friends v2</p>
          <h2>Friends</h2>
          <p>Supabase is required for friends, invite codes, and leaderboards.</p>
        </section>
        <section className="panel focus-panel">
          <p className="eyebrow">Cloud required</p>
          <h2>Configure Supabase first.</h2>
          <p>Run the schema, add the Vite env vars, and redeploy. Local tracking still works while social features are offline.</p>
        </section>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <p className="eyebrow">Friends v2</p>
          <h2>Friends</h2>
          <p>Sign in to send friend requests and compare daily scores.</p>
        </section>
        <section className="panel focus-panel">
          <p className="eyebrow">Account needed</p>
          <h2>Sign in from Settings.</h2>
          <p>Friends only see share-safe stats like completion, streaks, and logged days.</p>
          <button className="primary-button" type="button" onClick={onOpenSettings}>
            Open Settings
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Friends v2</p>
        <h2>Friends</h2>
        <p>Accept requests, then compare last-7-day completion, average score, streaks, and logged days.</p>
      </section>

      <section className="friends-command-center" aria-label="Friends sections">
        <div className="friends-tabs" role="tablist" aria-label="Friends sections">
          {FRIENDS_TABS.map((tab) => {
            const tabBadge = tab.key === 'network' ? networkBadgeCount : tab.key === 'challenges' ? challengeBadgeCount : 0
            return (
              <button
                className={activeFriendsTab === tab.key ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeFriendsTab === tab.key}
                key={tab.key}
                onClick={() => setActiveFriendsTab(tab.key)}
              >
                {tab.label}
                {tabBadge > 0 && <b className="inline-badge">{tabBadge}</b>}
              </button>
            )
          })}
        </div>
        <div className="friends-stat-grid">
          <span><small>Friends</small><strong>{acceptedFriends.length}</strong></span>
          <span><small>Squads</small><strong>{friendSquads.length}</strong></span>
          <span><small>Challenges</small><strong>{friendChallenges.length}</strong></span>
          <span><small>Needs action</small><strong>{pendingCount}</strong></span>
        </div>
      </section>

      {activeFriendsTab === 'overview' && (
        <>
      <section className="panel friends-profile-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your profile</p>
            <h2>Invite + identity</h2>
          </div>
        </div>
        <div className="friends-profile-grid">
          <TextField label="Display name" value={displayName} onChange={onDisplayNameChange} />
          <div className="invite-code-card">
            <small>Invite code</small>
            <strong>{profile?.inviteCode || 'Loading...'}</strong>
            <button className="ghost-button" type="button" onClick={onCopyInviteCode} disabled={busy || !profile?.inviteCode}>
              Copy Code
            </button>
          </div>
        </div>
        <div className="data-actions">
          <button className="secondary-button" type="button" onClick={onSaveProfile} disabled={busy}>
            Save Profile
          </button>
          <button className="secondary-button" type="button" onClick={onPublishSummary} disabled={busy}>
            Publish Score
          </button>
          <button className="secondary-button" type="button" onClick={onShareInviteMessage} disabled={busy || !profile?.inviteCode}>
            Share Invite
          </button>
          <button className="secondary-button" type="button" onClick={onRefresh} disabled={busy}>
            Refresh
          </button>
        </div>
        <div className="privacy-panel">
          <div>
            <small>Privacy settings</small>
            <p>Choose which stats are visible when you publish leaderboard and challenge scores.</p>
          </div>
          <div className="privacy-grid">
            <CheckField
              label="Show 7-day score"
              checked={privacySettings.showWeeklyCompletion}
              disabled={busy}
              onChange={(showWeeklyCompletion) => onPrivacyChange({ ...privacySettings, showWeeklyCompletion })}
            />
            <CheckField
              label="Show average"
              checked={privacySettings.showAverageCompletion}
              disabled={busy}
              onChange={(showAverageCompletion) => onPrivacyChange({ ...privacySettings, showAverageCompletion })}
            />
            <CheckField
              label="Show streak"
              checked={privacySettings.showStreak}
              disabled={busy}
              onChange={(showStreak) => onPrivacyChange({ ...privacySettings, showStreak })}
            />
            <CheckField
              label="Show logged days"
              checked={privacySettings.showLoggedDays}
              disabled={busy}
              onChange={(showLoggedDays) => onPrivacyChange({ ...privacySettings, showLoggedDays })}
            />
          </div>
        </div>
        <p className={`data-status ${status.tone}`}>{busy ? 'Working...' : status.message}</p>
      </section>

      <section className="panel friend-activity-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activity</p>
            <h2>Squad feed</h2>
          </div>
          <span>{activityFeed.length}</span>
        </div>
        <FriendActivityFeed items={activityFeed} />
      </section>
        </>
      )}

      {activeFriendsTab === 'network' && (
        <>
      <section className="panel add-friend-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Add friend</p>
            <h2>Invite code</h2>
          </div>
        </div>
        <div className="auth-form">
          <TextField label="Friend code" value={inviteCode} onChange={(value) => onInviteCodeChange(value.toUpperCase())} />
          <button className="secondary-button" type="button" onClick={onAddFriend} disabled={busy}>
            Send Request
          </button>
        </div>
      </section>

      <section className="panel friend-requests-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Requests</p>
            <h2>Friend requests</h2>
          </div>
          <span>{friendRequests.length}</span>
        </div>
        {friendRequests.length === 0 ? (
          <p className="empty-leaderboard">No pending requests.</p>
        ) : (
          <div className="friend-request-list">
            {incomingRequests.map((request) => (
              <FriendRequestCard
                key={`${request.userA}-${request.userB}`}
                request={request}
                busy={busy}
                onAccept={() => onAcceptRequest(request.userId)}
                onDecline={() => onDeclineRequest(request.userId)}
              />
            ))}
            {outgoingRequests.map((request) => (
              <FriendRequestCard
                key={`${request.userA}-${request.userB}`}
                request={request}
                busy={busy}
                onAccept={() => {}}
                onDecline={() => {}}
              />
            ))}
          </div>
        )}
      </section>
        </>
      )}

      {activeFriendsTab === 'squads' && (
        <>
      <section className="panel friend-squads-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Challenge squads</p>
            <h2>Small private groups</h2>
          </div>
          <span>{friendSquads.length}</span>
        </div>
        <div className="challenge-create-panel">
          <div className="field-grid">
            <TextField label="Squad name" value={squadName} onChange={setSquadName} />
          </div>
          <div className="challenge-invite-picker">
            <small>Squad members</small>
            {acceptedFriends.length === 0 ? (
              <p>No accepted friends yet.</p>
            ) : (
              <div>
                {acceptedFriends.map((friend) => (
                  <label className="challenge-invite-option" key={friend.userId}>
                    <input
                      type="checkbox"
                      checked={squadMemberIds.includes(friend.userId)}
                      onChange={() => toggleSquadMember(friend.userId)}
                    />
                    <span>{friend.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="secondary-button" type="button" onClick={submitSquad} disabled={busy || !squadName.trim() || squadMemberIds.length === 0}>
            Create Squad
          </button>
        </div>
        {friendSquads.length === 0 ? (
          <p className="empty-leaderboard">No squads yet. Save a group once, then use it when creating challenges.</p>
        ) : (
          <div className="squad-list">
            {friendSquads.map((squad) => (
              <FriendSquadCard
                key={squad.id}
                squad={squad}
                leaderboardRows={leaderboardRows}
                acceptedFriends={acceptedFriends}
                busy={busy}
                onUpdate={(input) => onUpdateSquad(input)}
                onUseForChallenge={() => applySquadToChallenge(squad)}
                onDelete={() => onDeleteSquad(squad.id)}
              />
            ))}
          </div>
        )}
      </section>
        </>
      )}

      {activeFriendsTab === 'challenges' && (
        <>
      <section className="panel friend-challenges-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Friend challenges</p>
            <h2>Custom competitions</h2>
          </div>
          <span>{friendChallenges.length}</span>
        </div>
        <div className="challenge-create-panel">
          <div className="template-picker">
            <label className="select-field">
              <span>Template</span>
              <select value={challengeTemplateId} onChange={(event) => applyChallengeTemplate(event.target.value)}>
                {CHALLENGE_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <p>{describeTemplateOverrides(challengeTemplateById(challengeTemplateId))}</p>
          </div>
          <div className="field-grid">
            <TextField label="Challenge name" value={challengeName} onChange={setChallengeName} />
            <label className="select-field">
              <span>Scoring</span>
              <select value={challengeScoringMode} onChange={(event) => setChallengeScoringMode(event.target.value as FriendChallengeScoringMode)}>
                <option value="personal">Personal targets</option>
                <option value="shared">Shared rules</option>
              </select>
            </label>
            <TextField label="Start" type="date" value={challengeStartDate} onChange={updateChallengeStartDate} />
            <TextField label="End" type="date" value={challengeEndDate} onChange={setChallengeEndDate} />
          </div>
          <div className="challenge-invite-picker">
            <small>Invite friends</small>
            {friendSquads.length > 0 && (
              <div className="squad-shortcuts">
                {friendSquads.map((squad) => (
                  <button className="ghost-button" type="button" key={squad.id} onClick={() => applySquadToChallenge(squad)} disabled={busy || squad.members.length === 0}>
                    Use {squad.name}
                  </button>
                ))}
              </div>
            )}
            {acceptedFriends.length === 0 ? (
              <p>No accepted friends yet.</p>
            ) : (
              <div>
                {acceptedFriends.map((friend) => (
                  <label className="challenge-invite-option" key={friend.userId}>
                    <input
                      type="checkbox"
                      checked={challengeInviteIds.includes(friend.userId)}
                      onChange={() => toggleChallengeInvite(friend.userId)}
                    />
                    <span>{friend.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="secondary-button" type="button" onClick={submitChallenge} disabled={busy || !challengeName.trim()}>
            Create Challenge
          </button>
        </div>
        {selectedChallenge && (
          <FriendChallengeDetail
            challenge={selectedChallenge}
            acceptedFriends={acceptedFriends}
            busy={busy}
            onClose={() => setSelectedChallengeId(null)}
            onInviteMore={(inviteeIds) => onInviteChallengeParticipants({
              challengeId: selectedChallenge.id,
              inviteeIds,
            })}
            onPublish={(note, reaction) => onPublishChallengeScore(selectedChallenge.id, note, reaction)}
          />
        )}
        {friendChallenges.length === 0 ? (
          <p className="empty-leaderboard">No friend challenges yet.</p>
        ) : (
          <>
            <div className="challenge-section">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">Active</p>
                  <h3>Current challenges</h3>
                </div>
                <span>{activeChallenges.length}</span>
              </div>
              {activeChallenges.length === 0 ? (
                <p className="empty-leaderboard">No active challenges right now.</p>
              ) : (
                <div className="challenge-list">
                  {activeChallenges.map((challenge) => (
                    <FriendChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={busy}
                      onSelect={() => setSelectedChallengeId(challenge.id)}
                      onAccept={() => onAcceptChallenge(challenge.id)}
                      onDecline={() => onDeclineChallenge(challenge.id)}
                      onPublish={() => onPublishChallengeScore(challenge.id)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="challenge-section">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">Archive</p>
                  <h3>Completed challenges</h3>
                </div>
                <span>{completedChallenges.length}</span>
              </div>
              {completedChallenges.length === 0 ? (
                <p className="empty-leaderboard">Completed friend-versus-friend history will collect here.</p>
              ) : (
                <div className="challenge-list">
                  {completedChallenges.map((challenge) => (
                    <FriendChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={busy}
                      onSelect={() => setSelectedChallengeId(challenge.id)}
                      onAccept={() => onAcceptChallenge(challenge.id)}
                      onDecline={() => onDeclineChallenge(challenge.id)}
                      onPublish={() => onPublishChallengeScore(challenge.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
        </>
      )}

      {activeFriendsTab === 'leaderboard' && (
      <section className="panel leaderboard-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Competition</p>
            <h2>Leaderboard</h2>
          </div>
          <span>{leaderboardRows.length}</span>
        </div>
        {selectedFriend && (
          <FriendProfileDetail
            friend={selectedFriend}
            currentUser={currentUserRow}
            friendChallenges={friendChallenges}
            friendSquads={friendSquads}
            onClose={() => setSelectedFriendId(null)}
          />
        )}
        {leaderboardRows.length === 0 ? (
          <p className="empty-leaderboard">Publish your score to start the leaderboard.</p>
        ) : (
          <div className="leaderboard-list">
            {leaderboardRows.map((row, index) => (
              <LeaderboardCard
                key={row.userId}
                row={row}
                rank={index + 1}
                onOpenProfile={row.isCurrentUser ? undefined : () => setSelectedFriendId(row.userId)}
              />
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  )
}

function FriendRequestCard({
  request,
  busy,
  onAccept,
  onDecline,
}: {
  request: FriendRequest
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const isIncoming = request.direction === 'incoming'

  return (
    <article className="friend-request-card">
      <div className="friend-request-main">
        <strong>{request.displayName}</strong>
        <span>{isIncoming ? 'Wants to compete with you' : 'Waiting for response'}</span>
      </div>
      {isIncoming ? (
        <div className="friend-request-actions">
          <button className="secondary-button compact-button" type="button" onClick={onAccept} disabled={busy}>
            Accept
          </button>
          <button className="ghost-button" type="button" onClick={onDecline} disabled={busy}>
            Decline
          </button>
        </div>
      ) : (
        <span className="request-badge">Pending</span>
      )}
    </article>
  )
}

function FriendActivityFeed({ items }: { items: FriendActivityFeedItem[] }) {
  if (items.length === 0) {
    return <p className="empty-leaderboard">No squad or friend activity yet.</p>
  }

  return (
    <div className="activity-list">
      {items.map((item) => (
        <article className={`activity-card ${item.tone}`} key={item.id}>
          <div className="activity-dot" />
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
          <small>{item.meta}</small>
        </article>
      ))}
    </div>
  )
}

function FriendSquadCard({
  squad,
  leaderboardRows,
  acceptedFriends,
  busy,
  onUpdate,
  onUseForChallenge,
  onDelete,
}: {
  squad: FriendSquadView
  leaderboardRows: LeaderboardRow[]
  acceptedFriends: LeaderboardRow[]
  busy: boolean
  onUpdate: (input: UpdateFriendSquadInput) => void
  onUseForChallenge: () => void
  onDelete: () => void
}) {
  const squadLeaderboardRows = getSquadLeaderboardRows(squad, leaderboardRows)
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(squad.name)
  const [draftMemberIds, setDraftMemberIds] = useState(squad.members.map((member) => member.userId))

  function startEditing() {
    setDraftName(squad.name)
    setDraftMemberIds(squad.members.map((member) => member.userId))
    setIsEditing(true)
  }

  function toggleDraftMember(userId: string) {
    setDraftMemberIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function saveSquad() {
    onUpdate({
      squadId: squad.id,
      name: draftName,
      memberIds: draftMemberIds,
    })
    setIsEditing(false)
  }

  return (
    <article className="squad-card">
      {isEditing ? (
        <div className="squad-edit-panel">
          <TextField label="Squad name" value={draftName} onChange={setDraftName} />
          <div className="challenge-invite-picker">
            <small>Members</small>
            {acceptedFriends.length === 0 ? (
              <p>No accepted friends yet.</p>
            ) : (
              <div>
                {acceptedFriends.map((friend) => (
                  <label className="challenge-invite-option" key={friend.userId}>
                    <input
                      type="checkbox"
                      checked={draftMemberIds.includes(friend.userId)}
                      onChange={() => toggleDraftMember(friend.userId)}
                    />
                    <span>{friend.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="squad-card-actions">
            <button className="secondary-button compact-button" type="button" onClick={saveSquad} disabled={busy || !draftName.trim()}>
              Save Squad
            </button>
            <button className="ghost-button" type="button" onClick={() => setIsEditing(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="squad-card-main">
          <div>
            <strong>{squad.name}</strong>
            <span>{squad.members.length} {squad.members.length === 1 ? 'member' : 'members'}</span>
          </div>
          {squad.members.length === 0 ? (
            <p>No active members. Add accepted friends by editing this squad.</p>
          ) : (
            <div className="squad-member-list">
              {squad.members.map((member) => (
                <span key={member.userId}>{member.displayName}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {squadLeaderboardRows.length > 0 && (
        <div className="squad-leaderboard">
          <small>Squad leaderboard</small>
          {squadLeaderboardRows.map((row, index) => (
            <article className={`squad-leaderboard-row ${row.isCurrentUser ? 'is-you' : ''}`} key={row.userId}>
              <b>{index + 1}</b>
              <div>
                <strong>{row.displayName}</strong>
                <span>{formatSummaryMetric(row.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)} last 7 days</span>
              </div>
              <em>{formatSummaryMetric(row.summary, 'showStreak', (summary) => `${summary.currentStreak} streak`)}</em>
            </article>
          ))}
        </div>
      )}
      <div className="squad-card-actions">
        {!isEditing && (
          <button className="secondary-button compact-button" type="button" onClick={startEditing} disabled={busy}>
            Edit Squad
          </button>
        )}
        <button className="secondary-button compact-button" type="button" onClick={onUseForChallenge} disabled={busy || squad.members.length === 0}>
          Use for Challenge
        </button>
        <button className="ghost-button" type="button" onClick={onDelete} disabled={busy}>
          Delete
        </button>
      </div>
    </article>
  )
}

function FriendChallengeCard({
  challenge,
  busy,
  onSelect,
  onAccept,
  onDecline,
  onPublish,
}: {
  challenge: FriendChallengeView
  busy: boolean
  onSelect: () => void
  onAccept: () => void
  onDecline: () => void
  onPublish: () => void
}) {
  const modeLabel = challenge.scoringMode === 'shared' ? 'Shared rules' : 'Personal targets'
  const acceptedParticipants = challenge.participants.filter((participant) => participant.status === 'accepted')
  const pendingParticipants = challenge.participants.filter((participant) => participant.status === 'pending')
  const rankedParticipants = [...acceptedParticipants].sort((a, b) => (
    (b.summary?.weeklyCompletion ?? 0) - (a.summary?.weeklyCompletion ?? 0)
    || (b.summary?.averageCompletion ?? 0) - (a.summary?.averageCompletion ?? 0)
    || (b.summary?.currentStreak ?? 0) - (a.summary?.currentStreak ?? 0)
    || a.displayName.localeCompare(b.displayName)
  ))

  return (
    <article className={`challenge-card ${challenge.currentUserStatus === 'pending' ? 'has-pending-invite' : ''}`}>
      <div className="challenge-card-header">
        <div>
          <small>{modeLabel} · {formatShortDate(challenge.startDate)} - {formatShortDate(challenge.endDate)}</small>
          <h3>{challenge.name}</h3>
          <p>{acceptedParticipants.length} active · {pendingParticipants.length} invited</p>
        </div>
        <span className="request-badge">{challenge.isCreator ? 'Owner' : challenge.currentUserStatus}</span>
      </div>

      <div className="challenge-card-actions">
        <button className="secondary-button compact-button" type="button" onClick={onSelect} disabled={busy}>
          Details
        </button>
        {challenge.currentUserStatus === 'pending' && !challenge.isCreator && (
          <>
            <button className="secondary-button compact-button" type="button" onClick={onAccept} disabled={busy}>
              Accept
            </button>
            <button className="ghost-button" type="button" onClick={onDecline} disabled={busy}>
              Decline
            </button>
          </>
        )}
        {challenge.currentUserStatus === 'accepted' && (
          <button className="secondary-button compact-button" type="button" onClick={onPublish} disabled={busy}>
            Publish Challenge Score
          </button>
        )}
      </div>

      {rankedParticipants.length === 0 ? (
        <p className="empty-leaderboard">No accepted participants yet.</p>
      ) : (
        <div className="leaderboard-list">
          {rankedParticipants.map((participant, index) => (
            <article className={`leaderboard-card ${participant.isCurrentUser ? 'is-you' : ''}`} key={participant.userId}>
              <div className="leaderboard-rank">{index + 1}</div>
              <div className="leaderboard-main">
                <div className="leaderboard-name-row">
                  <strong>{participant.displayName}</strong>
                  {participant.isCurrentUser && <span>You</span>}
                </div>
                <small>{participant.summary ? `Updated ${formatShortDate(participant.summary.updatedAt.slice(0, 10))}` : 'No score published yet'}</small>
              </div>
              <div className="leaderboard-stats">
                <span><small>7-day</small><strong>{formatSummaryMetric(participant.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)}</strong></span>
                <span><small>Avg</small><strong>{formatSummaryMetric(participant.summary, 'showAverageCompletion', (summary) => `${summary.averageCompletion}%`)}</strong></span>
                <span><small>Streak</small><strong>{formatSummaryMetric(participant.summary, 'showStreak', (summary) => String(summary.currentStreak))}</strong></span>
                <span><small>Logged</small><strong>{formatSummaryMetric(participant.summary, 'showLoggedDays', (summary) => `${summary.loggedDays}/${summary.totalDays}`)}</strong></span>
              </div>
              {(participant.summary?.note || participant.summary?.reaction) && (
                <p className="score-note">
                  {reactionLabel(participant.summary.reaction) ?? 'Note'}{participant.summary.note ? ` · ${participant.summary.note}` : ''}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </article>
  )
}

function FriendChallengeDetail({
  challenge,
  acceptedFriends,
  busy,
  onClose,
  onInviteMore,
  onPublish,
}: {
  challenge: FriendChallengeView
  acceptedFriends: LeaderboardRow[]
  busy: boolean
  onClose: () => void
  onInviteMore: (inviteeIds: string[]) => void
  onPublish: (note: string, reaction: ScoreReaction | null) => void
}) {
  const participantIds = new Set(challenge.participants.map((participant) => participant.userId))
  const availableFriends = acceptedFriends.filter((friend) => !participantIds.has(friend.userId))
  const acceptedParticipants = challenge.participants.filter((participant) => participant.status === 'accepted')
  const pendingParticipants = challenge.participants.filter((participant) => participant.status === 'pending')
  const declinedParticipants = challenge.participants.filter((participant) => participant.status === 'declined')
  const rankedParticipants = [...acceptedParticipants].sort((a, b) => (
    (b.summary?.weeklyCompletion ?? 0) - (a.summary?.weeklyCompletion ?? 0)
    || (b.summary?.averageCompletion ?? 0) - (a.summary?.averageCompletion ?? 0)
    || (b.summary?.currentStreak ?? 0) - (a.summary?.currentStreak ?? 0)
    || a.displayName.localeCompare(b.displayName)
  ))
  const myParticipant = challenge.participants.find((participant) => participant.isCurrentUser) ?? null
  const activeRules = getEnabledRules(challenge.settings)
  const completed = isChallengeCompleted(challenge)
  const [inviteIds, setInviteIds] = useState<string[]>([])
  const [scoreNote, setScoreNote] = useState(myParticipant?.summary?.note ?? '')
  const [scoreReaction, setScoreReaction] = useState<ScoreReaction | null>(myParticipant?.summary?.reaction ?? null)

  useEffect(() => {
    setInviteIds([])
    setScoreNote(myParticipant?.summary?.note ?? '')
    setScoreReaction(myParticipant?.summary?.reaction ?? null)
  }, [challenge.id])

  function toggleInvite(userId: string) {
    setInviteIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function submitInvites() {
    onInviteMore(inviteIds)
    setInviteIds([])
  }

  return (
    <article className="challenge-detail-card">
      <div className="challenge-detail-header">
        <div>
          <small>{completed ? 'Completed archive' : 'Challenge detail'}</small>
          <h3>{challenge.name}</h3>
          <p>{formatShortDate(challenge.startDate)} - {formatShortDate(challenge.endDate)} · {challenge.scoringMode === 'shared' ? 'Shared rules' : 'Personal targets'}</p>
        </div>
        <div className="challenge-detail-actions">
          <span className="request-badge">{challenge.isCreator ? 'Owner' : statusLabel(challenge.currentUserStatus)}</span>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="challenge-detail-grid">
        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Publishing</p>
              <h3>Your score</h3>
            </div>
          </div>
          <div className="publish-state">
            <span><small>Status</small><strong>{myParticipant ? statusLabel(myParticipant.status) : 'Not joined'}</strong></span>
            <span><small>Last publish</small><strong>{myParticipant?.summary ? formatShortDate(myParticipant.summary.updatedAt.slice(0, 10)) : 'None'}</strong></span>
          </div>
          {challenge.currentUserStatus === 'accepted' ? (
            <div className="score-publish-form">
              <TextArea
                label="Score note"
                value={scoreNote}
                placeholder="Optional: what made this score happen?"
                disabled={busy}
                onChange={(value) => setScoreNote(value.slice(0, 180))}
              />
              <label className="select-field">
                <span>Reaction</span>
                <select value={scoreReaction ?? ''} disabled={busy} onChange={(event) => setScoreReaction(normalizeScoreReaction(event.target.value))}>
                  <option value="">No reaction</option>
                  {SCORE_REACTIONS.map((reaction) => (
                    <option key={reaction.key} value={reaction.key}>{reaction.label}</option>
                  ))}
                </select>
              </label>
              <button className="secondary-button compact-button" type="button" onClick={() => onPublish(scoreNote, scoreReaction)} disabled={busy}>
                Publish With Note
              </button>
            </div>
          ) : (
            <p className="empty-leaderboard">Accept this challenge before publishing a score.</p>
          )}
        </section>

        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Participants</p>
              <h3>Roster state</h3>
            </div>
          </div>
          <div className="challenge-roster-grid">
            <span><small>Accepted</small><strong>{acceptedParticipants.length}</strong></span>
            <span><small>Pending</small><strong>{pendingParticipants.length}</strong></span>
            <span><small>Declined</small><strong>{declinedParticipants.length}</strong></span>
          </div>
          <div className="participant-history-list">
            {challenge.participants.map((participant) => (
              <article className="participant-history-row" key={participant.userId}>
                <div>
                  <strong>{participant.displayName}{participant.isCurrentUser ? ' · You' : ''}</strong>
                  <span>Invited {formatActivityDate(participant.createdAt)}{participant.respondedAt ? ` · Responded ${formatActivityDate(participant.respondedAt)}` : ''}</span>
                </div>
                <b>{statusLabel(participant.status)}</b>
              </article>
            ))}
          </div>
        </section>
      </div>

      {challenge.isCreator && (
        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Invite management</p>
              <h3>Add friends</h3>
            </div>
            <span>{availableFriends.length}</span>
          </div>
          {availableFriends.length === 0 ? (
            <p className="empty-leaderboard">All accepted friends are already in this challenge.</p>
          ) : (
            <>
              <div className="challenge-invite-picker">
                <div>
                  {availableFriends.map((friend) => (
                    <label className="challenge-invite-option" key={friend.userId}>
                      <input
                        type="checkbox"
                        checked={inviteIds.includes(friend.userId)}
                        onChange={() => toggleInvite(friend.userId)}
                      />
                      <span>{friend.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="secondary-button compact-button" type="button" onClick={submitInvites} disabled={busy || inviteIds.length === 0}>
                Send Challenge Invites
              </button>
            </>
          )}
        </section>
      )}

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Settings</p>
            <h3>Rules and targets</h3>
          </div>
        </div>
        <div className="challenge-settings-grid">
          <span><small>Exercise</small><strong>{challenge.settings.targets.exerciseMinutes} min</strong></span>
          <span><small>Protein</small><strong>{challenge.settings.targets.proteinGrams} g</strong></span>
          <span><small>Water</small><strong>{challenge.settings.targets.waterLiters} L</strong></span>
          <span><small>Sleep</small><strong>{challenge.settings.targets.sleepHours} hr</strong></span>
        </div>
        <div className="squad-member-list">
          {activeRules.map((rule) => (
            <span key={rule.key}>{rule.label} · {rule.weight === 'nonNegotiable' ? 'Non-negotiable' : 'Supporting'}</span>
          ))}
        </div>
      </section>

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Weekly comparison</h3>
          </div>
        </div>
        {rankedParticipants.length === 0 ? (
          <p className="empty-leaderboard">No accepted participants have published yet.</p>
        ) : (
          <div className="leaderboard-list">
            {rankedParticipants.map((participant, index) => (
              <article className={`leaderboard-card ${participant.isCurrentUser ? 'is-you' : ''}`} key={participant.userId}>
                <div className="leaderboard-rank">{index + 1}</div>
                <div className="leaderboard-main">
                  <div className="leaderboard-name-row">
                    <strong>{participant.displayName}</strong>
                    {participant.isCurrentUser && <span>You</span>}
                  </div>
                  <small>{participant.summary?.lastLoggedDate ? `Last log ${formatShortDate(participant.summary.lastLoggedDate)}` : 'No logged score yet'}</small>
                </div>
                <div className="leaderboard-stats">
                  <span><small>7-day</small><strong>{formatSummaryMetric(participant.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)}</strong></span>
                  <span><small>Avg</small><strong>{formatSummaryMetric(participant.summary, 'showAverageCompletion', (summary) => `${summary.averageCompletion}%`)}</strong></span>
                  <span><small>Streak</small><strong>{formatSummaryMetric(participant.summary, 'showStreak', (summary) => String(summary.currentStreak))}</strong></span>
                  <span><small>Logged</small><strong>{formatSummaryMetric(participant.summary, 'showLoggedDays', (summary) => `${summary.loggedDays}/${summary.totalDays}`)}</strong></span>
                </div>
                {(participant.summary?.note || participant.summary?.reaction) && (
                  <p className="score-note">
                    {reactionLabel(participant.summary.reaction) ?? 'Note'}{participant.summary.note ? ` · ${participant.summary.note}` : ''}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}

function FriendProfileDetail({
  friend,
  currentUser,
  friendChallenges,
  friendSquads,
  onClose,
}: {
  friend: LeaderboardRow
  currentUser: LeaderboardRow | null
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
  onClose: () => void
}) {
  const sharedSquads = friendSquads.filter((squad) => squad.members.some((member) => member.userId === friend.userId))
  const sharedChallenges = friendChallenges.filter((challenge) => {
    const friendParticipant = challenge.participants.find((participant) => participant.userId === friend.userId)
    const currentParticipant = challenge.participants.find((participant) => participant.isCurrentUser)
    return friendParticipant?.status === 'accepted' && currentParticipant?.status === 'accepted'
  })
  const headToHead = sharedChallenges.reduce((record, challenge) => {
    const friendParticipant = challenge.participants.find((participant) => participant.userId === friend.userId)
    const currentParticipant = challenge.participants.find((participant) => participant.isCurrentUser)
    const friendScore = friendParticipant?.summary?.weeklyCompletion ?? null
    const currentScore = currentParticipant?.summary?.weeklyCompletion ?? null
    if (friendScore === null || currentScore === null || friendScore === currentScore) return record
    return friendScore > currentScore
      ? { ...record, friendWins: record.friendWins + 1 }
      : { ...record, yourWins: record.yourWins + 1 }
  }, { friendWins: 0, yourWins: 0 })
  const recentChallengeScores = sharedChallenges
    .map((challenge) => {
      const participant = challenge.participants.find((item) => item.userId === friend.userId)
      return participant?.summary
        ? {
          challenge,
          summary: participant.summary,
        }
        : null
    })
    .filter((item): item is { challenge: FriendChallengeView; summary: ChallengeSummary } => item !== null)
    .sort((a, b) => b.summary.updatedAt.localeCompare(a.summary.updatedAt))
    .slice(0, 3)

  return (
    <article className="friend-profile-detail">
      <div className="challenge-detail-header">
        <div>
          <small>Friend profile</small>
          <h3>{friend.displayName}</h3>
          <p>{sharedSquads.length} shared {sharedSquads.length === 1 ? 'squad' : 'squads'} · {sharedChallenges.length} shared {sharedChallenges.length === 1 ? 'challenge' : 'challenges'}</p>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="friend-profile-grid">
        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Recent score</p>
              <h3>Leaderboard</h3>
            </div>
          </div>
          <div className="leaderboard-stats">
            <span><small>7-day</small><strong>{formatSummaryMetric(friend.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)}</strong></span>
            <span><small>Avg</small><strong>{formatSummaryMetric(friend.summary, 'showAverageCompletion', (summary) => `${summary.averageCompletion}%`)}</strong></span>
            <span><small>Streak</small><strong>{formatSummaryMetric(friend.summary, 'showStreak', (summary) => String(summary.currentStreak))}</strong></span>
            <span><small>Logged</small><strong>{formatSummaryMetric(friend.summary, 'showLoggedDays', (summary) => `${summary.loggedDays}/${summary.totalDays}`)}</strong></span>
          </div>
        </section>

        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Head-to-head</p>
              <h3>Shared challenges</h3>
            </div>
          </div>
          <div className="challenge-roster-grid">
            <span><small>{friend.displayName}</small><strong>{headToHead.friendWins}</strong></span>
            <span><small>{currentUser?.displayName ?? 'You'}</small><strong>{headToHead.yourWins}</strong></span>
            <span><small>Total</small><strong>{sharedChallenges.length}</strong></span>
          </div>
        </section>
      </div>

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Shared squads</p>
            <h3>Groups together</h3>
          </div>
        </div>
        {sharedSquads.length === 0 ? (
          <p className="empty-leaderboard">No shared squads yet.</p>
        ) : (
          <div className="squad-member-list">
            {sharedSquads.map((squad) => <span key={squad.id}>{squad.name}</span>)}
          </div>
        )}
      </section>

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Recent challenge scores</p>
            <h3>Published history</h3>
          </div>
        </div>
        {recentChallengeScores.length === 0 ? (
          <p className="empty-leaderboard">No shared challenge scores published yet.</p>
        ) : (
          <div className="participant-history-list">
            {recentChallengeScores.map(({ challenge, summary }) => (
              <article className="participant-history-row" key={challenge.id}>
                <div>
                  <strong>{challenge.name}</strong>
                  <span>Updated {formatActivityDate(summary.updatedAt)}{summary.note ? ` · ${summary.note}` : ''}</span>
                </div>
                <b>{formatSummaryMetric(summary, 'showWeeklyCompletion', (item) => `${item.weeklyCompletion}%`)}</b>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}

function LeaderboardCard({ row, rank, onOpenProfile }: { row: LeaderboardRow; rank: number; onOpenProfile?: () => void }) {
  const summary = row.summary

  return (
    <article className={`leaderboard-card ${row.isCurrentUser ? 'is-you' : ''}`}>
      <div className="leaderboard-rank">{rank}</div>
      <div className="leaderboard-main">
        <div className="leaderboard-name-row">
          <strong>{row.displayName}</strong>
          {row.isCurrentUser && <span>You</span>}
        </div>
        <small>{summary?.challengeTitle ?? 'No score published yet'}</small>
      </div>
      <div className="leaderboard-stats">
        <span><small>7-day</small><strong>{formatSummaryMetric(summary, 'showWeeklyCompletion', (item) => `${item.weeklyCompletion}%`)}</strong></span>
        <span><small>Avg</small><strong>{formatSummaryMetric(summary, 'showAverageCompletion', (item) => `${item.averageCompletion}%`)}</strong></span>
        <span><small>Streak</small><strong>{formatSummaryMetric(summary, 'showStreak', (item) => String(item.currentStreak))}</strong></span>
        <span><small>Logged</small><strong>{formatSummaryMetric(summary, 'showLoggedDays', (item) => `${item.loggedDays}/${item.totalDays}`)}</strong></span>
      </div>
      {onOpenProfile && (
        <button className="ghost-button leaderboard-profile-button" type="button" onClick={onOpenProfile}>
          View Profile
        </button>
      )}
    </article>
  )
}

function formatSummaryMetric(
  summary: ChallengeSummary | null,
  privacyKey: keyof PrivacySettings,
  format: (summary: ChallengeSummary) => string,
): string {
  if (!summary) return '—'
  return summary.privacy[privacyKey] ? format(summary) : 'Private'
}

function SettingsView({
  settings,
  entries,
  reminderSettings,
  reminderStatus,
  cloudConfigured,
  cloudStatus,
  cloudBusy,
  cloudUpdatedAt,
  syncConflict,
  user,
  authEmail,
  authPassword,
  onSettingsChange,
  onDataImport,
  onReminderChange,
  onRequestReminderPermission,
  onAuthEmailChange,
  onAuthPasswordChange,
  onSignInWithPassword,
  onCreatePasswordAccount,
  onSetAccountPassword,
  onSendMagicLink,
  onSendPasswordReset,
  onSignOut,
  onPushCloud,
  onPullCloud,
  onExportAccountData,
  onDeleteCloudAccountData,
  onUseCloudVersion,
  onKeepLocalVersion,
  onMergeCloudEntries,
  onDismissConflict,
}: {
  settings: ChallengeSettings
  entries: EntryMap
  reminderSettings: ReminderSettings
  reminderStatus: DataStatus
  cloudConfigured: boolean
  cloudStatus: DataStatus
  cloudBusy: boolean
  cloudUpdatedAt: string | null
  syncConflict: SyncConflict | null
  user: User | null
  authEmail: string
  authPassword: string
  onSettingsChange: (settings: ChallengeSettings) => void
  onDataImport: (settings: ChallengeSettings, entries: EntryMap) => void
  onReminderChange: (settings: ReminderSettings) => void
  onRequestReminderPermission: () => void
  onAuthEmailChange: (email: string) => void
  onAuthPasswordChange: (password: string) => void
  onSignInWithPassword: () => void
  onCreatePasswordAccount: () => void
  onSetAccountPassword: () => void
  onSendMagicLink: () => void
  onSendPasswordReset: () => void
  onSignOut: () => void
  onPushCloud: () => void
  onPullCloud: () => void
  onExportAccountData: () => void
  onDeleteCloudAccountData: () => void
  onUseCloudVersion: () => void
  onKeepLocalVersion: () => void
  onMergeCloudEntries: () => void
  onDismissConflict: () => void
}) {
  const activeRuleCount = getEnabledRules(settings).length
  const entryCount = Object.keys(entries).length
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: `${entryCount} saved ${entryCount === 1 ? 'entry' : 'entries'}`,
  })
  const [newCategoryName, setNewCategoryName] = useState('')
  const categories = settings.categories.length > 0 ? settings.categories : DEFAULT_RULE_CATEGORIES

  function update(patch: Partial<ChallengeSettings>) {
    onSettingsChange(normalizeSettings({ ...settings, ...patch }))
  }

  function updateTargets(patch: Partial<ChallengeTargets>) {
    update({ targets: { ...settings.targets, ...patch } })
  }

  function updateRule(key: RuleKey, patch: Partial<RuleConfig>) {
    update({
      rules: settings.rules.map((rule) => rule.key === key ? { ...rule, ...patch } : rule),
    })
  }

  function addRule(category: RuleCategoryConfig) {
    update({
      rules: [...settings.rules, makeCustomRule(category)],
    })
  }

  function addCategory() {
    const label = normalizeCategoryLabel(newCategoryName, '')
    if (!label) return
    const key = makeCategoryKey(label, new Set(categories.map((category) => category.key)))
    update({
      categories: [...categories, { key, label }],
    })
    setNewCategoryName('')
  }

  function removeRule(key: RuleKey) {
    updateRule(key, { enabled: false, deleted: true })
  }

  function updateStartDate(startDate: string) {
    update({
      startDate,
      endDate: settings.endDate < startDate ? startDate : settings.endDate,
    })
  }

  function exportJsonBackup() {
    const payload = makeBackupPayload(settings, entries)
    const filename = `${sanitizeFilenamePart(settings.title)}-${todayIso()}-backup.json`
    downloadTextFile(filename, 'application/json;charset=utf-8', JSON.stringify(payload, null, 2))
    const count = Object.keys(payload.entries).length
    setDataStatus({
      tone: 'success',
      message: `JSON backup exported with ${count} ${count === 1 ? 'entry' : 'entries'}.`,
    })
  }

  function exportCsv() {
    const filename = `${sanitizeFilenamePart(settings.title)}-${todayIso()}-entries.csv`
    downloadTextFile(filename, 'text/csv;charset=utf-8', entriesToCsv(entries, settings))
    setDataStatus({
      tone: 'success',
      message: `CSV exported with ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}.`,
    })
  }

  async function importJsonBackup(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const backup = await readBackupFile(file)
      const count = Object.keys(backup.entries).length
      const shouldImport = window.confirm(
        `Import ${count} ${count === 1 ? 'entry' : 'entries'} from ${file.name}? This replaces current local settings and entries.`,
      )

      if (!shouldImport) {
        setDataStatus({ tone: 'neutral', message: 'Import canceled.' })
        return
      }

      onDataImport(backup.settings, backup.entries)
      setDataStatus({
        tone: 'success',
        message: `Imported ${count} ${count === 1 ? 'entry' : 'entries'} and tracker settings.`,
      })
    } catch (error) {
      setDataStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not import that backup file.',
      })
    } finally {
      input.value = ''
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Milestone 4</p>
        <h2>Settings</h2>
        <p>Ongoing tracker · {activeRuleCount} scored rules</p>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="1" title="Data" />
        <div className="data-actions">
          <button className="secondary-button" type="button" onClick={exportJsonBackup}>
            Export JSON
          </button>
          <label className="secondary-button file-import-label">
            <span>Import JSON</span>
            <input type="file" accept="application/json,.json" onChange={importJsonBackup} />
          </label>
          <button className="secondary-button" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <p className={`data-status ${dataStatus.tone}`}>{dataStatus.message}</p>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="2" title="Cloud Sync" />
        <CloudSyncPanel
          configured={cloudConfigured}
          user={user}
          status={cloudStatus}
          busy={cloudBusy}
          updatedAt={cloudUpdatedAt}
          conflict={syncConflict}
          authEmail={authEmail}
          authPassword={authPassword}
          onAuthEmailChange={onAuthEmailChange}
          onAuthPasswordChange={onAuthPasswordChange}
          onSignInWithPassword={onSignInWithPassword}
          onCreatePasswordAccount={onCreatePasswordAccount}
          onSetAccountPassword={onSetAccountPassword}
          onSendMagicLink={onSendMagicLink}
          onSendPasswordReset={onSendPasswordReset}
          onSignOut={onSignOut}
          onPushCloud={onPushCloud}
          onPullCloud={onPullCloud}
          onExportAccountData={onExportAccountData}
          onDeleteCloudAccountData={onDeleteCloudAccountData}
          onUseCloudVersion={onUseCloudVersion}
          onKeepLocalVersion={onKeepLocalVersion}
          onMergeCloudEntries={onMergeCloudEntries}
          onDismissConflict={onDismissConflict}
        />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="3" title="Reminders" />
        <ReminderPanel
          settings={reminderSettings}
          status={reminderStatus}
          onChange={onReminderChange}
          onRequestPermission={onRequestReminderPermission}
        />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="4" title="Tracker" />
        <TextField label="Title" value={settings.title} onChange={(title) => update({ title })} />
        <TextField label="Tracking since" type="date" value={settings.startDate} onChange={updateStartDate} />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="5" title="Targets" />
        <div className="field-grid">
          <NumberField label="Exercise target" value={settings.targets.exerciseMinutes} min={1} max={300} onChange={(value) => value !== null && updateTargets({ exerciseMinutes: value })} suffix="min" />
          <NumberField label="Calorie target" value={settings.targets.calories} min={1} max={10000} onChange={(value) => value !== null && updateTargets({ calories: value })} suffix="kcal" />
          <NumberField label="Protein target" value={settings.targets.proteinGrams} min={1} max={500} onChange={(value) => value !== null && updateTargets({ proteinGrams: value })} suffix="g" />
          <NumberField label="Water target" value={settings.targets.waterLiters} min={0.1} max={15} step={0.1} onChange={(value) => value !== null && updateTargets({ waterLiters: value })} suffix="L" />
          <NumberField label="Sleep target" value={settings.targets.sleepHours} min={0.25} max={24} step={0.25} onChange={(value) => value !== null && updateTargets({ sleepHours: value })} suffix="hr" />
        </div>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="6" title="Scored Rules" />
        <div className="rule-glossary">
          <span><strong>Scored</strong> counts toward today’s percent and streaks.</span>
          <span><strong>Non-negotiable</strong> counts double.</span>
          <span><strong>Supporting</strong> counts once.</span>
          <span><strong>Active</strong> counts now; inactive stays saved for later.</span>
        </div>
        <div className="category-create-row">
          <TextField label="New category" value={newCategoryName} onChange={setNewCategoryName} />
          <button className="secondary-button" type="button" onClick={addCategory} disabled={!newCategoryName.trim()}>
            Add Category
          </button>
        </div>
        {categories.map((category) => {
          const categoryRules = getScoredRules(settings).filter((rule) => rule.category === category.key)

          return (
            <div className="settings-rule-category" key={category.key}>
              <div className="settings-rule-category-header">
                <div>
                  <p className="eyebrow">{category.label}</p>
                  <h3>{category.label} Rules</h3>
                </div>
                <button className="secondary-button compact-button" type="button" onClick={() => addRule(category)}>
                  Add Rule
                </button>
              </div>
              <div className="settings-rule-list">
                {categoryRules.length === 0 && <p className="empty-rule-category">No {category.label.toLowerCase()} rules yet.</p>}
                {categoryRules.map((rule) => (
                  <article className={`settings-rule-row ${rule.enabled ? '' : 'is-disabled'}`} key={rule.key}>
                    <label className="symbol-field">
                      <span>Icon</span>
                      <input
                        value={rule.icon}
                        maxLength={2}
                        onChange={(event) => updateRule(rule.key, { icon: event.target.value })}
                        aria-label={`${rule.label} icon`}
                      />
                    </label>
                    <TextField label="Rule" value={rule.label} onChange={(label) => updateRule(rule.key, { label })} />
                    <div className="settings-rule-controls">
                      <label className="mini-check-field">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(event) => updateRule(rule.key, { enabled: event.target.checked })}
                        />
                        <span>Active</span>
                      </label>
                      <label className="weight-field">
                        <span>Weight</span>
                        <select value={rule.weight} onChange={(event) => updateRule(rule.key, { weight: event.target.value as RuleWeight })}>
                          <option value="nonNegotiable">Non-negotiable</option>
                          <option value="supporting">Supporting</option>
                        </select>
                      </label>
                      <label className="weight-field">
                        <span>Group</span>
                        <select value={rule.category} onChange={(event) => updateRule(rule.key, { category: event.target.value })}>
                          {categories.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <button className="danger-button" type="button" onClick={() => removeRule(rule.key)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

function CloudSyncPanel({
  configured,
  user,
  status,
  busy,
  updatedAt,
  conflict,
  authEmail,
  authPassword,
  onAuthEmailChange,
  onAuthPasswordChange,
  onSignInWithPassword,
  onCreatePasswordAccount,
  onSetAccountPassword,
  onSendMagicLink,
  onSendPasswordReset,
  onSignOut,
  onPushCloud,
  onPullCloud,
  onExportAccountData,
  onDeleteCloudAccountData,
  onUseCloudVersion,
  onKeepLocalVersion,
  onMergeCloudEntries,
  onDismissConflict,
}: {
  configured: boolean
  user: User | null
  status: DataStatus
  busy: boolean
  updatedAt: string | null
  conflict: SyncConflict | null
  authEmail: string
  authPassword: string
  onAuthEmailChange: (email: string) => void
  onAuthPasswordChange: (password: string) => void
  onSignInWithPassword: () => void
  onCreatePasswordAccount: () => void
  onSetAccountPassword: () => void
  onSendMagicLink: () => void
  onSendPasswordReset: () => void
  onSignOut: () => void
  onPushCloud: () => void
  onPullCloud: () => void
  onExportAccountData: () => void
  onDeleteCloudAccountData: () => void
  onUseCloudVersion: () => void
  onKeepLocalVersion: () => void
  onMergeCloudEntries: () => void
  onDismissConflict: () => void
}) {
  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(updatedAt))
    : 'Not synced yet'
  const conflictCloudLabel = conflict?.cloud.updatedAt
    ? new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(conflict.cloud.updatedAt))
    : null
  const conflictLocalLabel = conflict?.localChangedAt
    ? new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(conflict.localChangedAt))
    : null

  if (!configured) {
    return (
      <div className="cloud-panel">
        <p className="cloud-copy">Supabase is not configured for this build. Add the Vite env vars, run the SQL schema, and redeploy to turn on sign-in and multi-device sync.</p>
        <p className="data-status neutral">Local tracking, backups, and CSV export still work.</p>
      </div>
    )
  }

  return (
    <div className="cloud-panel">
      {user ? (
        <>
          <div className="sync-account-row">
            <div>
              <small>Signed in</small>
              <strong>{user.email}</strong>
            </div>
            <button className="ghost-button" type="button" onClick={onSignOut} disabled={busy}>
              Sign out
            </button>
          </div>
          <div className="data-actions">
            <button className="secondary-button" type="button" onClick={onPushCloud} disabled={busy}>
              Push Local
            </button>
            <button className="secondary-button" type="button" onClick={onPullCloud} disabled={busy}>
              Pull Cloud
            </button>
          </div>
          <p className="cloud-updated">Cloud snapshot: {updatedLabel}</p>
          <div className="account-data-panel">
            <div>
              <small>Password sign-in</small>
              <p>Set or update the password for this account so you can sign in without magic links.</p>
            </div>
            <div className="password-update-actions">
              <TextField label="New Password" type="password" value={authPassword} onChange={onAuthPasswordChange} />
              <button className="secondary-button" type="button" onClick={onSetAccountPassword} disabled={busy}>
                Set Password
              </button>
            </div>
          </div>
          <div className="account-data-panel">
            <div>
              <small>Account data</small>
              <p>Export or delete the cloud records this app stores for your signed-in account.</p>
            </div>
            <div className="account-data-actions">
              <button className="secondary-button" type="button" onClick={onExportAccountData} disabled={busy}>
                Export Account Data
              </button>
              <button className="danger-button" type="button" onClick={onDeleteCloudAccountData} disabled={busy}>
                Delete Cloud Data
              </button>
            </div>
          </div>
          {conflict && (
            <div className="sync-conflict-panel">
              <div>
                <p className="eyebrow">Sync conflict</p>
                <h3>Choose a version</h3>
                <p>{conflict.message}</p>
                <small>
                  Cloud: {conflictCloudLabel ?? 'unknown'} · This device: {conflictLocalLabel ?? 'unsynced local data'}
                </small>
              </div>
              <div className="sync-conflict-actions">
                <button className="secondary-button" type="button" onClick={onMergeCloudEntries} disabled={busy}>
                  Merge Daily Entries
                </button>
                <button className="secondary-button" type="button" onClick={onUseCloudVersion} disabled={busy}>
                  Use Cloud
                </button>
                <button className="secondary-button" type="button" onClick={onKeepLocalVersion} disabled={busy}>
                  Keep Local
                </button>
                <button className="ghost-button" type="button" onClick={onDismissConflict} disabled={busy}>
                  Decide Later
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="auth-stack">
          <div className="field-grid">
            <TextField label="Email" type="email" value={authEmail} onChange={onAuthEmailChange} />
            <TextField label="Password" type="password" value={authPassword} onChange={onAuthPasswordChange} />
          </div>
          <div className="auth-actions">
            <button className="secondary-button" type="button" onClick={onSignInWithPassword} disabled={busy}>
              Sign In
            </button>
            <button className="secondary-button" type="button" onClick={onCreatePasswordAccount} disabled={busy}>
              Create Account
            </button>
          </div>
          <div className="auth-form">
            <button className="secondary-button" type="button" onClick={onSendMagicLink} disabled={busy}>
              Send Magic Link Backup
            </button>
            <button className="ghost-button" type="button" onClick={onSendPasswordReset} disabled={busy}>
              Reset Password
            </button>
          </div>
        </div>
      )}
      <p className={`data-status ${status.tone}`}>{busy ? 'Working...' : status.message}</p>
    </div>
  )
}

function ReminderPanel({
  settings,
  status,
  onChange,
  onRequestPermission,
}: {
  settings: ReminderSettings
  status: DataStatus
  onChange: (settings: ReminderSettings) => void
  onRequestPermission: () => void
}) {
  return (
    <div className="reminder-panel">
      <label className="check-field">
        <span>Daily check-in reminder</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
        />
      </label>
      <div className="field-grid">
        <TextField label="Time" type="time" value={settings.time} onChange={(time) => onChange({ ...settings, time })} />
        <TextField label="Message" value={settings.message} onChange={(message) => onChange({ ...settings, message })} />
      </div>
      <button className="secondary-button" type="button" onClick={onRequestPermission}>
        Allow Local Notifications
      </button>
      <p className={`data-status ${status.tone}`}>{status.message}</p>
    </div>
  )
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="form-section-title">
      <span>{number}</span>
      <h3>{title}</h3>
    </div>
  )
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled = false,
  onChange,
}: {
  label: string
  value: number | null
  min: number
  max: number
  step?: number
  suffix: string
  disabled?: boolean
  onChange: (value: number | null) => void
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
        <small>{suffix}</small>
      </div>
    </label>
  )
}

function TextField({
  label,
  value,
  type = 'text',
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  type?: 'text' | 'date' | 'email' | 'password' | 'time'
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="text-field">
      <span>{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SelectField({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function CheckField({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="check-field">
      <span>{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function RatingField({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="rating-field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
        {[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number}/5</option>)}
      </select>
    </label>
  )
}

function TextArea({
  label,
  value,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="text-area-field">
      <span>{label}</span>
      <textarea value={value} placeholder={placeholder} rows={4} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function CalendarView({
  entries,
  selectedDate,
  settings,
  onSelectDate,
}: {
  entries: EntryMap
  selectedDate: string
  settings: ChallengeSettings
  onSelectDate: (date: string) => void
}) {
  const monthStart = `${selectedDate.slice(0, 7)}-01`
  const monthEnd = addDays(addDays(monthStart, 32).slice(0, 8) + '01', -1)
  const maxDate = selectableEndDate(settings)
  const startDate = monthStart < settings.startDate ? settings.startDate : monthStart
  const endDate = monthEnd > maxDate ? maxDate : monthEnd
  const dates = endDate >= startDate
    ? Array.from({ length: daysBetween(startDate, endDate) + 1 }, (_, index) => addDays(startDate, index))
    : []
  const leadingBlanks = new Date(`${monthStart}T12:00:00`).getDay()
  const cells = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ type: 'blank' as const, key: `blank-${index}` })),
    ...dates.map((date) => ({ type: 'day' as const, date, key: date })),
  ]

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Consistency map</p>
        <h2>{formatMonthLabel(selectedDate)}</h2>
        <p>Green means 80% or better. Tap any tracked date to open it.</p>
      </section>
      <section className="panel calendar-panel">
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {cells.map((cell) => {
            if (cell.type === 'blank') return <span className="calendar-blank" key={cell.key} />
            const dayEntry = entries[cell.date]
            const score = dayEntry ? completionStats(dayEntry, settings).percent : null
            const status = score === null ? 'empty' : score >= 80 ? 'great' : score >= 50 ? 'good' : 'low'
            return (
              <button
                type="button"
                key={cell.key}
                className={`calendar-day ${status} ${selectedDate === cell.date ? 'selected' : ''}`}
                onClick={() => onSelectDate(cell.date)}
              >
                <strong>{calendarCellLabel(cell.date, settings)}</strong>
                <small>{score === null ? '—' : `${score}%`}</small>
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span><i className="legend-great" />80–100%</span>
          <span><i className="legend-good" />50–79%</span>
          <span><i className="legend-low" />0–49%</span>
        </div>
      </section>
    </div>
  )
}

function ProgressView({ entries, settings }: { entries: EntryMap; settings: ChallengeSettings }) {
  const [period, setPeriod] = useState<ProgressPeriod>('week')
  const dates = getLoggedDates(entries, settings)
  const ruleRates = getRuleRatesForDates(dates, entries, settings)
  const periodRecap = buildPeriodRecap(entries, settings, period)
  const trendData = TREND_METRICS.map((metric) => ({
    metric,
    points: getTrendPoints(entries, settings, metric),
  }))

  const averageCompletion = dates.length === 0
    ? 0
    : Math.round(dates.reduce((sum, date) => sum + completionStats(entries[date], settings).percent, 0) / dates.length)

  const weakestRule = [...ruleRates].sort((a, b) => a.rate - b.rate)[0]

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Evidence over emotion</p>
        <h2>Progress</h2>
        <p>{dates.length} logged days · {averageCompletion}% average completion</p>
      </section>

      <section className="panel progress-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Completion by rule</p>
            <h2>What is holding?</h2>
          </div>
        </div>
        <div className="bar-list">
          {ruleRates.map((rule) => (
            <div className="bar-row" key={rule.key}>
              <div><span>{rule.icon}</span><strong>{rule.label}</strong><small>{rule.rate}%</small></div>
              <div className="bar-track"><span style={{ width: `${rule.rate}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel trends-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Trend charts</p>
            <h2>Body signals</h2>
          </div>
        </div>
        <div className="trend-grid">
          {trendData.map(({ metric, points }) => (
            <TrendChart key={metric.key} metric={metric} points={points} />
          ))}
        </div>
      </section>

      <section className="panel weekly-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent review</p>
            <h2>Pattern review</h2>
          </div>
          <div className="period-toggle" role="group" aria-label="Progress period">
            <button className={period === 'week' ? 'active' : ''} type="button" onClick={() => setPeriod('week')}>
              Last 7
            </button>
            <button className={period === 'month' ? 'active' : ''} type="button" onClick={() => setPeriod('month')}>
              Last 30
            </button>
          </div>
        </div>
        <div className="weekly-list">
          <PeriodRecapRow recap={periodRecap} />
        </div>
      </section>

      <section className="panel focus-panel">
        <p className="eyebrow">Next milestone</p>
        <h2>{dates.length === 0 ? 'Log your first day.' : weakestRule ? 'Protect the weakest rule.' : 'Enable a rule.'}</h2>
        <p>
          {dates.length === 0
            ? 'Your progress page becomes useful after you record real check-ins.'
            : weakestRule
              ? `Your lowest completion rate is ${weakestRule.label.toLowerCase()}. Build the next few days around making that rule easier.`
              : 'Turn on at least one rule in Settings to calculate progress.'}
        </p>
      </section>
    </div>
  )
}

function TrendChart({ metric, points }: { metric: TrendMetric; points: TrendPoint[] }) {
  const latest = points[points.length - 1]
  const first = points[0]
  const delta = latest && first && points.length > 1 ? latest.value - first.value : null
  const width = 320
  const height = 136
  const paddingX = 22
  const paddingY = 20
  const values = points.map((point) => point.value)
  const minValue = values.length > 0 ? Math.min(...values) : 0
  const maxValue = values.length > 0 ? Math.max(...values) : 1
  const yMin = minValue === maxValue ? minValue - 1 : minValue
  const yMax = minValue === maxValue ? maxValue + 1 : maxValue
  const yRange = yMax - yMin || 1
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2
  const coordinates = points.map((point, index) => {
    const x = points.length === 1
      ? width / 2
      : paddingX + (index / (points.length - 1)) * chartWidth
    const y = paddingY + (1 - (point.value - yMin) / yRange) * chartHeight
    return { ...point, x, y }
  })
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')

  return (
    <article className="trend-card" style={{ '--metric-color': metric.color } as CSSProperties}>
      <div className="trend-card-header">
        <div>
          <small>{metric.label}</small>
          <strong>{latest ? metric.format(latest.value) : 'No data'}</strong>
        </div>
        {delta !== null && <span>{formatSigned(delta, metric.unit)}</span>}
      </div>

      {points.length === 0 ? (
        <div className="trend-empty">{metric.emptyLabel}</div>
      ) : (
        <>
          <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric.label} trend`}>
            <path className="trend-axis" d={`M ${paddingX} ${height - paddingY} H ${width - paddingX}`} />
            {points.length > 1 && <path className="trend-line" d={path} />}
            {coordinates.map((point) => (
              <circle className="trend-point" key={point.date} cx={point.x} cy={point.y} r="4" />
            ))}
          </svg>
          <div className="trend-footer">
            <span>{formatShortDate(points[0].date)}</span>
            <span>{formatShortDate(points[points.length - 1].date)}</span>
          </div>
        </>
      )}
    </article>
  )
}

function PeriodRecapRow({ recap }: { recap: PeriodRecap }) {
  const hasData = recap.loggedDays > 0

  return (
    <article className={`weekly-row ${hasData ? '' : 'is-empty'}`}>
      <div className="weekly-row-header">
        <div>
          <strong>{recap.label}</strong>
          <span>{formatShortDate(recap.startDate)} - {formatShortDate(recap.endDate)}</span>
        </div>
        <b>{hasData ? `${recap.averageCompletion}%` : '—'}</b>
      </div>

      {hasData ? (
        <div className="weekly-metrics">
          <span><small>Logged</small><strong>{recap.loggedDays}/{recap.totalDays} days</strong></span>
          <span><small>Best</small><strong>{recap.bestRule ? `${recap.bestRule.label} ${recap.bestRule.rate}%` : '—'}</strong></span>
          <span><small>Focus</small><strong>{recap.weakestRule ? `${recap.weakestRule.label} ${recap.weakestRule.rate}%` : '—'}</strong></span>
          <span><small>Sleep</small><strong>{recap.averageSleep === null ? '—' : `${roundTo(recap.averageSleep)} hr`}</strong></span>
          <span><small>Calories</small><strong>{recap.averageCalories === null ? '—' : `${Math.round(recap.averageCalories)} kcal`}</strong></span>
          <span><small>Mood</small><strong>{recap.averageMood === null ? '—' : `${roundTo(recap.averageMood)}/5`}</strong></span>
          <span><small>Weight</small><strong>{recap.weightChange === null ? '—' : formatSigned(recap.weightChange, 'lb')}</strong></span>
          <span><small>Reflections</small><strong>{recap.reflectionCount}</strong></span>
        </div>
      ) : (
        <p>No check-ins logged for this period yet.</p>
      )}
    </article>
  )
}

function NavButton({
  label,
  icon,
  active,
  badgeCount = 0,
  onClick,
}: {
  label: string
  icon: 'home' | 'check' | 'calendar' | 'progress' | 'friends' | 'settings'
  active: boolean
  badgeCount?: number
  onClick: () => void
}) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      <Icon name={icon} />
      {badgeCount > 0 && <b className="nav-badge">{badgeCount}</b>}
      <span>{label}</span>
    </button>
  )
}

export default App
