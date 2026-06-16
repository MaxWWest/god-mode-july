import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ChangeEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { loadFromStorage, saveToStorage } from './storage'
import {
  SUPABASE_FRIENDSHIP_TABLE,
  SUPABASE_PROFILE_TABLE,
  SUPABASE_SUMMARY_TABLE,
  SUPABASE_TABLE,
  isSupabaseConfigured,
  supabase,
} from './supabase'

type View = 'home' | 'check-in' | 'calendar' | 'progress' | 'friends' | 'settings'
type RuleKey = 'exercise' | 'sober' | 'foodLogged' | 'calories' | 'protein' | 'water' | 'sleep' | 'reading' | 'journal'
type RuleWeight = 'nonNegotiable' | 'supporting'

type RuleConfig = {
  key: RuleKey
  label: string
  icon: string
  enabled: boolean
  weight: RuleWeight
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

type DataStatus = {
  tone: 'success' | 'error' | 'neutral'
  message: string
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

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const ENTRIES_STORAGE_KEY = 'god-mode-july-entries-v1'
const SETTINGS_STORAGE_KEY = 'god-mode-july-settings-v1'
const REMINDER_STORAGE_KEY = 'god-mode-july-reminder-v1'
const SYNC_META_STORAGE_KEY = 'god-mode-july-sync-meta-v1'
const DAY_IN_MS = 86_400_000
const MAX_TRACKING_DAYS = 3650
const MAX_WORKOUT_LOGS = 12
const MAX_WORKOUT_MINUTES = 300
const MAX_DAILY_EXERCISE_MINUTES = 600
const LEGACY_DEFAULT_START_DATE = '2026-07-01'
const LEGACY_DEFAULT_END_DATE = '2026-07-31'
const WORKOUT_TYPES = ['Strength', 'Cardio', 'Walking', 'Running', 'Cycling', 'Mobility', 'Sports', 'Workout', 'Other']
const DEFAULT_WORKOUT_TYPE = WORKOUT_TYPES[0]

const DEFAULT_TARGETS: ChallengeTargets = {
  exerciseMinutes: 90,
  calories: 2200,
  proteinGrams: 140,
  waterLiters: 3,
  sleepHours: 7.5,
}

const DEFAULT_RULES: RuleConfig[] = [
  { key: 'exercise', label: 'Exercise', icon: '◆', enabled: true, weight: 'nonNegotiable' },
  { key: 'sober', label: 'No Alcohol', icon: '◈', enabled: true, weight: 'nonNegotiable' },
  { key: 'calories', label: 'Calories', icon: '◌', enabled: false, weight: 'supporting' },
  { key: 'protein', label: 'Protein', icon: '▲', enabled: true, weight: 'nonNegotiable' },
  { key: 'water', label: 'Water', icon: '≈', enabled: false, weight: 'supporting' },
  { key: 'sleep', label: 'Sleep', icon: '◒', enabled: false, weight: 'supporting' },
  { key: 'reading', label: 'Read 10 Pages', icon: '▣', enabled: true, weight: 'supporting' },
  { key: 'journal', label: 'Journal', icon: '✦', enabled: true, weight: 'supporting' },
]

const DEFAULT_SETTINGS: ChallengeSettings = {
  title: 'God Mode July',
  startDate: todayIso(),
  endDate: addDays(todayIso(), 365),
  targets: DEFAULT_TARGETS,
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

function isRuleKey(value: unknown): value is RuleKey {
  return DEFAULT_RULES.some((rule) => rule.key === value)
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

function timestampIsAfter(value: string | null, baseline: string | null): boolean {
  if (!value) return false
  if (!baseline) return true
  return new Date(value).getTime() > new Date(baseline).getTime()
}

function normalizeRuleLabel(defaultRule: RuleConfig, storedLabel: string): string {
  const legacyLabels: Partial<Record<RuleKey, string[]>> = {
    exercise: ['90 min Exercise'],
    foodLogged: ['Log Food Honestly', 'Food honestly logged', 'Done Eating for the Day'],
    calories: ['Calories On Target'],
    protein: ['Protein Goal'],
    water: ['Water Goal'],
    sleep: ['Sleep Goal'],
  }

  if (legacyLabels[defaultRule.key]?.includes(storedLabel)) return defaultRule.label
  return storedLabel || defaultRule.label
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
      if (isRuleKey(rule.key)) storedRuleByKey.set(rule.key, rule)
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
      weight: storedRule?.weight === 'nonNegotiable' || storedRule?.weight === 'supporting'
        ? storedRule.weight
        : defaultRule.weight,
    }
  })

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
    rules,
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

function getEnabledRules(settings: ChallengeSettings): RuleConfig[] {
  return settings.rules.filter((rule) => rule.enabled)
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

function buildChallengeSummary(userId: string, entries: EntryMap, settings: ChallengeSettings): ChallengeSummary {
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
    loggedDays: loggedDates.length,
    totalDays: trackingLength(settings, throughDate),
    averageCompletion,
    weeklyCompletion,
    currentStreak: currentStreak(entries, throughDate, settings),
    longestStreak: longestStreak(entries, settings),
    lastLoggedDate: loggedDates[loggedDates.length - 1] ?? null,
    updatedAt: new Date().toISOString(),
  }
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

function normalizeSummaryRow(row: unknown): ChallengeSummary | null {
  const candidate = row && typeof row === 'object'
    ? row as Record<string, unknown>
    : null
  if (!candidate || typeof candidate.user_id !== 'string') return null

  return {
    userId: candidate.user_id,
    challengeTitle: normalizeText(candidate.challenge_title) || DEFAULT_SETTINGS.title,
    startDate: isIsoDate(candidate.start_date) ? candidate.start_date : DEFAULT_SETTINGS.startDate,
    endDate: isIsoDate(candidate.end_date) ? candidate.end_date : DEFAULT_SETTINGS.endDate,
    loggedDays: normalizeBoundedNumber(candidate.logged_days, 0, 0, MAX_TRACKING_DAYS),
    totalDays: normalizeBoundedNumber(candidate.total_days, 1, 1, MAX_TRACKING_DAYS),
    averageCompletion: normalizeBoundedNumber(candidate.average_completion, 0, 0, 100),
    weeklyCompletion: normalizeBoundedNumber(candidate.weekly_completion, 0, 0, 100),
    currentStreak: normalizeBoundedNumber(candidate.current_streak, 0, 0, MAX_TRACKING_DAYS),
    longestStreak: normalizeBoundedNumber(candidate.longest_streak, 0, 0, MAX_TRACKING_DAYS),
    lastLoggedDate: isIsoDate(candidate.last_logged_date) ? candidate.last_logged_date : null,
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : new Date().toISOString(),
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
  const ruleColumns = settings.rules.map((rule) => `rule_${rule.key}`)
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
      ...settings.rules.map((rule) => inChallenge ? Number(ruleComplete(entry, rule.key, settings)) : ''),
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
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [savePulse, setSavePulse] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(() => normalizeSyncMeta(loadFromStorage<unknown>(SYNC_META_STORAGE_KEY, DEFAULT_SYNC_META)).lastCloudUpdatedAt)
  const [cloudStatus, setCloudStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: isSupabaseConfigured ? 'Sign in to sync across devices.' : 'Add Supabase env vars to enable cloud sync.',
  })
  const [reminderStatus, setReminderStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: 'Reminders stay on this device.',
  })
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [inviteCodeDraft, setInviteCodeDraft] = useState('')
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [friendsBusy, setFriendsBusy] = useState(false)
  const [friendsStatus, setFriendsStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: isSupabaseConfigured ? 'Sign in to compete with friends.' : 'Add Supabase env vars to enable friends.',
  })

  const entry = entries[selectedDate] ?? makeEmptyEntry(selectedDate)
  const entryFinalized = isEntryFinalized(entry)
  const stats = completionStats(entry, settings)
  const trackerHasStarted = todayIso() >= settings.startDate
  const latestSelectableDate = selectableEndDate(settings)

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
    if (!supabase) return

    let isMounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setUser(data.session?.user ?? null)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setCloudStatus({
        tone: 'neutral',
        message: session?.user ? 'Signed in. Push local data or pull cloud data.' : 'Sign in to sync across devices.',
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
    if (user) void publishFriendSummary(true, nextEntries)
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
      setCloudStatus({ tone: 'success', message: 'Magic link sent. Check your email to finish signing in.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send magic link.',
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

      setLeaderboardRows(rows)
      setFriendRequests(requests)
      setFriendsStatus({
        tone: 'success',
        message: `${acceptedFriendIds.length} ${acceptedFriendIds.length === 1 ? 'friend' : 'friends'} · ${requests.length} pending.`,
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

  async function publishFriendSummary(silent = false, sourceEntries = entries) {
    if (!supabase || !user) return

    if (!silent) setFriendsBusy(true)
    try {
      const profile = await ensureFriendProfile()
      if (!profile) throw new Error('Could not load your friend profile.')

      const summary = buildChallengeSummary(user.id, sourceEntries, settings)
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
          updated_at: summary.updatedAt,
        }, { onConflict: 'user_id' })

      if (error) throw error
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
    }
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

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
        </div>
      </header>

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
            status={friendsStatus}
            busy={friendsBusy}
            onDisplayNameChange={setDisplayNameDraft}
            onInviteCodeChange={setInviteCodeDraft}
            onSaveProfile={saveFriendProfile}
            onAddFriend={sendFriendRequestByInviteCode}
            onAcceptRequest={(userId) => respondToFriendRequest(userId, 'accepted')}
            onDeclineRequest={(userId) => respondToFriendRequest(userId, 'declined')}
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
            onSettingsChange={updateSettings}
            onDataImport={replaceData}
            onReminderChange={updateReminder}
            onRequestReminderPermission={requestReminderPermission}
            onAuthEmailChange={setAuthEmail}
            onSendMagicLink={sendMagicLink}
            onSignOut={signOut}
            onPushCloud={pushCloudData}
            onPullCloud={pullCloudData}
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
        <NavButton label="Friends" icon="friends" active={view === 'friends'} onClick={() => setView('friends')} />
        <NavButton label="Settings" icon="settings" active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>
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

function FriendsView({
  configured,
  user,
  profile,
  displayName,
  inviteCode,
  leaderboardRows,
  friendRequests,
  status,
  busy,
  onDisplayNameChange,
  onInviteCodeChange,
  onSaveProfile,
  onAddFriend,
  onAcceptRequest,
  onDeclineRequest,
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
  status: DataStatus
  busy: boolean
  onDisplayNameChange: (value: string) => void
  onInviteCodeChange: (value: string) => void
  onSaveProfile: () => void
  onAddFriend: () => void
  onAcceptRequest: (userId: string) => void
  onDeclineRequest: (userId: string) => void
  onPublishSummary: () => void
  onRefresh: () => void
  onOpenSettings: () => void
}) {
  const incomingRequests = friendRequests.filter((request) => request.direction === 'incoming')
  const outgoingRequests = friendRequests.filter((request) => request.direction === 'outgoing')

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
          </div>
        </div>
        <div className="data-actions">
          <button className="secondary-button" type="button" onClick={onSaveProfile} disabled={busy}>
            Save Profile
          </button>
          <button className="secondary-button" type="button" onClick={onPublishSummary} disabled={busy}>
            Publish Score
          </button>
          <button className="secondary-button" type="button" onClick={onRefresh} disabled={busy}>
            Refresh
          </button>
        </div>
        <p className={`data-status ${status.tone}`}>{busy ? 'Working...' : status.message}</p>
      </section>

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

      <section className="panel leaderboard-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Competition</p>
            <h2>Leaderboard</h2>
          </div>
          <span>{leaderboardRows.length}</span>
        </div>
        {leaderboardRows.length === 0 ? (
          <p className="empty-leaderboard">Publish your score to start the leaderboard.</p>
        ) : (
          <div className="leaderboard-list">
            {leaderboardRows.map((row, index) => (
              <LeaderboardCard key={row.userId} row={row} rank={index + 1} />
            ))}
          </div>
        )}
      </section>
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

function LeaderboardCard({ row, rank }: { row: LeaderboardRow; rank: number }) {
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
        <span><small>7-day</small><strong>{summary ? `${summary.weeklyCompletion}%` : '—'}</strong></span>
        <span><small>Avg</small><strong>{summary ? `${summary.averageCompletion}%` : '—'}</strong></span>
        <span><small>Streak</small><strong>{summary ? summary.currentStreak : '—'}</strong></span>
        <span><small>Logged</small><strong>{summary ? `${summary.loggedDays}/${summary.totalDays}` : '—'}</strong></span>
      </div>
    </article>
  )
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
  onSettingsChange,
  onDataImport,
  onReminderChange,
  onRequestReminderPermission,
  onAuthEmailChange,
  onSendMagicLink,
  onSignOut,
  onPushCloud,
  onPullCloud,
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
  onSettingsChange: (settings: ChallengeSettings) => void
  onDataImport: (settings: ChallengeSettings, entries: EntryMap) => void
  onReminderChange: (settings: ReminderSettings) => void
  onRequestReminderPermission: () => void
  onAuthEmailChange: (email: string) => void
  onSendMagicLink: () => void
  onSignOut: () => void
  onPushCloud: () => void
  onPullCloud: () => void
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
          onAuthEmailChange={onAuthEmailChange}
          onSendMagicLink={onSendMagicLink}
          onSignOut={onSignOut}
          onPushCloud={onPushCloud}
          onPullCloud={onPullCloud}
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
        <div className="settings-rule-list">
          {settings.rules.map((rule) => (
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
              </div>
            </article>
          ))}
        </div>
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
  onAuthEmailChange,
  onSendMagicLink,
  onSignOut,
  onPushCloud,
  onPullCloud,
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
  onAuthEmailChange: (email: string) => void
  onSendMagicLink: () => void
  onSignOut: () => void
  onPushCloud: () => void
  onPullCloud: () => void
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
        <div className="auth-form">
          <TextField label="Email" type="email" value={authEmail} onChange={onAuthEmailChange} />
          <button className="secondary-button" type="button" onClick={onSendMagicLink} disabled={busy}>
            Send Magic Link
          </button>
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
        Allow Notifications
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
  type?: 'text' | 'date' | 'email' | 'time'
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

function NavButton({ label, icon, active, onClick }: { label: string; icon: 'home' | 'check' | 'calendar' | 'progress' | 'friends' | 'settings'; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={active ? 'active' : ''} onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )
}

export default App
