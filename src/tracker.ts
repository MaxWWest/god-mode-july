import type {
  BackupPayload,
  BuiltInRuleKey,
  ChallengeSettings,
  ChallengeTargets,
  CloudSnapshot,
  CustomRuleKey,
  DailyEntry,
  DietGoalType,
  DietRuleSettings,
  EntryMap,
  ExerciseCycleDays,
  ExerciseRuleSettings,
  PrivacySettings,
  ReminderSettings,
  RuleCategoryConfig,
  RuleCategoryKey,
  RuleConfig,
  RuleKey,
  RuleWeight,
  SyncMeta,
  WorkoutLog,
} from './types'

export const DAY_IN_MS = 86_400_000
export const MAX_TRACKING_DAYS = 3650
export const MAX_WORKOUT_LOGS = 12
export const MAX_WORKOUT_MINUTES = 300
export const MAX_DAILY_EXERCISE_MINUTES = 600
const LEGACY_DEFAULT_START_DATE = '2026-07-01'
const LEGACY_DEFAULT_END_DATE = '2026-07-31'
export const WORKOUT_TYPES = ['Strength', 'Cardio', 'Walking', 'Running', 'Cycling', 'Mobility', 'Sports', 'Workout', 'Other']
const DEFAULT_WORKOUT_TYPE = WORKOUT_TYPES[0]

export const BUILT_IN_RULE_KEYS: BuiltInRuleKey[] = ['exercise', 'sober', 'foodLogged', 'calories', 'protein', 'water', 'sleep', 'reading', 'journal']

export const DEFAULT_RULE_CATEGORIES: RuleCategoryConfig[] = [
  { key: 'exercise', label: 'Exercise' },
  { key: 'diet', label: 'Diet' },
  { key: 'mental', label: 'Mental' },
  { key: 'misc', label: 'Misc' },
]

export const DEFAULT_TARGETS: ChallengeTargets = {
  exerciseMinutes: 90,
  calories: 2200,
  proteinGrams: 140,
  waterLiters: 3,
  sleepHours: 7.5,
}

export const DEFAULT_RULES: RuleConfig[] = [
  {
    key: 'exercise', label: 'Exercise', icon: '◆', enabled: true, weight: 'nonNegotiable', category: 'exercise',
    exercise: { cycleDays: 1, scheduledDays: [1], workoutType: 'Any exercise', targetMinutes: 90 },
  },
  {
    key: 'sober', label: 'Alcohol', icon: '◈', enabled: true, weight: 'nonNegotiable', category: 'diet',
    diet: { goalType: 'avoid', goal: 0, unit: 'drinks' },
  },
  {
    key: 'calories', label: 'Calories', icon: '◌', enabled: false, weight: 'supporting', category: 'diet',
    diet: { goalType: 'maximum', goal: 2200, unit: 'kcal' },
  },
  {
    key: 'protein', label: 'Protein', icon: '▲', enabled: true, weight: 'nonNegotiable', category: 'diet',
    diet: { goalType: 'minimum', goal: 140, unit: 'g' },
  },
  {
    key: 'water', label: 'Water', icon: '≈', enabled: false, weight: 'supporting', category: 'diet',
    diet: { goalType: 'minimum', goal: 3, unit: 'L' },
  },
  { key: 'sleep', label: 'Sleep', icon: '◒', enabled: false, weight: 'supporting', category: 'misc' },
  { key: 'reading', label: 'Read 10 Pages', icon: '▣', enabled: true, weight: 'supporting', category: 'mental' },
  { key: 'journal', label: 'Journal', icon: '✦', enabled: true, weight: 'supporting', category: 'mental' },
]

export const DEFAULT_SETTINGS: ChallengeSettings = {
  title: 'God Mode July',
  startDate: todayIso(),
  endDate: addDays(todayIso(), 365),
  targets: DEFAULT_TARGETS,
  categories: DEFAULT_RULE_CATEGORIES,
  rules: DEFAULT_RULES,
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  time: '20:30',
  message: 'Log today before the day gets away from you.',
}

export const DEFAULT_SYNC_META: SyncMeta = {
  lastCloudUpdatedAt: null,
  lastLocalChangeAt: null,
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  showWeeklyCompletion: true,
  showAverageCompletion: true,
  showStreak: true,
  showLoggedDays: true,
}

export function addDays(date: string, amount: number): string {
  const parsed = new Date(`${date}T12:00:00`)
  parsed.setDate(parsed.getDate() + amount)
  return parsed.toISOString().slice(0, 10)
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T12:00:00`).getTime()
  const end = new Date(`${endDate}T12:00:00`).getTime()
  return Math.floor((end - start) / DAY_IN_MS)
}

export function isIsoDate(value: unknown): value is string {
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
  if (value === 'activity') return 'diet'
  if (value === 'physical') return fallback
  if (typeof value !== 'string') return fallback
  const key = value.trim().toLowerCase()
  if (['exercise', 'diet', 'mental', 'misc'].includes(key)) return key
  return ['exercise', 'diet', 'mental', 'misc'].includes(fallback) ? fallback : 'misc'
}

export function normalizeCategoryLabel(value: unknown, fallback: string): string {
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

export function makeCategoryKey(label: string, existingKeys: Set<string>): RuleCategoryKey {
  const base = slugifyCategoryLabel(label) || 'custom'
  let key = base
  let suffix = 2
  while (existingKeys.has(key)) {
    key = `${base}-${suffix}`
    suffix += 1
  }
  return key
}

function normalizeRuleWeight(value: unknown, fallback: RuleWeight): RuleWeight {
  return value === 'nonNegotiable' || value === 'supporting' ? value : fallback
}

function makeCustomRuleKey(): CustomRuleKey {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeCustomRule(category: RuleCategoryConfig): RuleConfig {
  const rule: RuleConfig = {
    key: makeCustomRuleKey(),
    label: `New ${category.label} Rule`,
    icon: category.key === 'mental' ? '✦' : category.key === 'exercise' ? '◆' : category.key === 'diet' ? '▲' : '●',
    enabled: true,
    weight: 'supporting',
    category: category.key,
  }
  if (category.key === 'exercise') {
    rule.exercise = { cycleDays: 7, scheduledDays: [1, 3, 5], workoutType: 'Any exercise', targetMinutes: 30 }
  }
  if (category.key === 'diet') {
    rule.diet = { goalType: 'minimum', goal: 1, unit: 'g' }
  }
  return rule
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

export function normalizeBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function normalizeText(value: unknown): string {
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

export function normalizeWorkoutLogs(value: unknown): WorkoutLog[] {
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
      .filter(([key, complete]) => normalizeRuleKey(key) !== null && typeof complete === 'boolean'),
  )
}

function normalizeRuleValueMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, amount]) => normalizeRuleKey(key) !== null && Number.isFinite(Number(amount)))
      .map(([key, amount]) => [key, Math.max(0, Number(amount))]),
  )
}

export function workoutMinutesTotal(workouts: WorkoutLog[]): number {
  return Math.min(
    MAX_DAILY_EXERCISE_MINUTES,
    workouts.reduce((sum, workout) => sum + workout.minutes, 0),
  )
}

export function getExerciseMinutes(entry: DailyEntry): number {
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

export function makeEmptyWorkout(): WorkoutLog {
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

export function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

export function normalizeSyncMeta(value: unknown): SyncMeta {
  const candidate = value && typeof value === 'object' ? value as Partial<SyncMeta> : {}
  return {
    lastCloudUpdatedAt: normalizeTimestamp(candidate.lastCloudUpdatedAt),
    lastLocalChangeAt: normalizeTimestamp(candidate.lastLocalChangeAt),
  }
}

export function normalizePrivacySettings(value: unknown): PrivacySettings {
  const candidate = value && typeof value === 'object' ? value as Partial<PrivacySettings> : {}
  return {
    showWeeklyCompletion: typeof candidate.showWeeklyCompletion === 'boolean' ? candidate.showWeeklyCompletion : DEFAULT_PRIVACY_SETTINGS.showWeeklyCompletion,
    showAverageCompletion: typeof candidate.showAverageCompletion === 'boolean' ? candidate.showAverageCompletion : DEFAULT_PRIVACY_SETTINGS.showAverageCompletion,
    showStreak: typeof candidate.showStreak === 'boolean' ? candidate.showStreak : DEFAULT_PRIVACY_SETTINGS.showStreak,
    showLoggedDays: typeof candidate.showLoggedDays === 'boolean' ? candidate.showLoggedDays : DEFAULT_PRIVACY_SETTINGS.showLoggedDays,
  }
}

export function timestampIsAfter(value: string | null, baseline: string | null): boolean {
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

function normalizeRuleCategories(_value: unknown, _rules: RuleConfig[]): RuleCategoryConfig[] {
  return DEFAULT_RULE_CATEGORIES
}

function normalizeExerciseCycleDays(value: unknown, fallback: ExerciseCycleDays): ExerciseCycleDays {
  return value === 1 || value === 7 || value === 30 ? value : fallback
}

function normalizeExerciseSettings(value: unknown, fallback: ExerciseRuleSettings): ExerciseRuleSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<ExerciseRuleSettings> : {}
  const cycleDays = normalizeExerciseCycleDays(candidate.cycleDays, fallback.cycleDays)
  const rawDays = Array.isArray(candidate.scheduledDays) ? candidate.scheduledDays : fallback.scheduledDays
  const scheduledDays = Array.from(new Set(rawDays
    .map((day) => Math.round(Number(day)))
    .filter((day) => Number.isFinite(day) && day >= 1 && day <= cycleDays)))
    .sort((a, b) => a - b)
  const workoutType = typeof candidate.workoutType === 'string' && candidate.workoutType.trim()
    ? candidate.workoutType.trim().slice(0, 40)
    : fallback.workoutType

  return {
    cycleDays,
    scheduledDays: scheduledDays.length > 0 ? scheduledDays : [1],
    workoutType,
    targetMinutes: normalizeBoundedNumber(candidate.targetMinutes, fallback.targetMinutes, 1, MAX_WORKOUT_MINUTES),
  }
}

function normalizeDietGoalType(value: unknown, fallback: DietGoalType): DietGoalType {
  return value === 'minimum' || value === 'maximum' || value === 'avoid' ? value : fallback
}

function normalizeDietSettings(value: unknown, fallback: DietRuleSettings): DietRuleSettings {
  const candidate = value && typeof value === 'object' ? value as Partial<DietRuleSettings> : {}
  const goalType = normalizeDietGoalType(candidate.goalType, fallback.goalType)
  const unit = typeof candidate.unit === 'string' && candidate.unit.trim()
    ? candidate.unit.trim().slice(0, 16)
    : fallback.unit

  return {
    goalType,
    goal: goalType === 'avoid' ? 0 : normalizeBoundedNumber(candidate.goal, fallback.goal, 0, 100000),
    unit,
  }
}

function defaultDietSettings(rule: RuleConfig, targets: ChallengeTargets): DietRuleSettings | undefined {
  if (!rule.diet) return undefined
  switch (rule.key) {
    case 'calories': return { ...rule.diet, goal: targets.calories }
    case 'protein': return { ...rule.diet, goal: targets.proteinGrams }
    case 'water': return { ...rule.diet, goal: targets.waterLiters }
    default: return rule.diet
  }
}

export function normalizeSettings(value: unknown): ChallengeSettings {
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

    const fallbackExercise = defaultRule.exercise
      ? { ...defaultRule.exercise, targetMinutes: defaultRule.key === 'exercise' ? targets.exerciseMinutes : defaultRule.exercise.targetMinutes }
      : undefined
    const fallbackDiet = defaultDietSettings(defaultRule, targets)
    const storedCategory = storedRule?.category === 'activity' && defaultRule.key === 'sleep'
      ? 'misc'
      : storedRule?.category
    const category = normalizeCategoryKey(storedCategory, defaultRule.category)
    const exerciseFallback: ExerciseRuleSettings = fallbackExercise
      ?? { cycleDays: 7, scheduledDays: [1, 3, 5], workoutType: 'Any exercise', targetMinutes: 30 }
    const dietFallback: DietRuleSettings = fallbackDiet
      ?? { goalType: 'minimum', goal: 1, unit: 'g' }

    return {
      key: defaultRule.key,
      label,
      icon,
      enabled: typeof storedRule?.enabled === 'boolean' ? storedRule.enabled : defaultRule.enabled,
      weight: normalizeRuleWeight(storedRule?.weight, defaultRule.weight),
      category,
      exercise: category === 'exercise' ? normalizeExerciseSettings(storedRule?.exercise, exerciseFallback) : undefined,
      diet: category === 'diet' ? normalizeDietSettings(storedRule?.diet, dietFallback) : undefined,
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

    const category = normalizeCategoryKey(rule.category, 'misc')
    const fallbackExercise: ExerciseRuleSettings = { cycleDays: 7, scheduledDays: [1, 3, 5], workoutType: 'Any exercise', targetMinutes: 30 }
    const fallbackDiet: DietRuleSettings = { goalType: 'minimum', goal: 1, unit: 'g' }
    normalizedRules.push({
      key,
      label,
      icon,
      enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
      weight: normalizeRuleWeight(rule.weight, 'supporting'),
      category,
      exercise: category === 'exercise' ? normalizeExerciseSettings(rule.exercise, fallbackExercise) : undefined,
      diet: category === 'diet' ? normalizeDietSettings(rule.diet, fallbackDiet) : undefined,
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

export function normalizeReminderSettings(value: unknown): ReminderSettings {
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
    ruleValues: normalizeRuleValueMap(candidate.ruleValues),
    mood: normalizeBoundedNumber(candidate.mood, 3, 1, 5),
    energy: normalizeBoundedNumber(candidate.energy, 3, 1, 5),
    hunger: normalizeBoundedNumber(candidate.hunger, 3, 1, 5),
    sleepHours: normalizeOptionalNumber(candidate.sleepHours, 0, 24),
    wentWell: normalizeText(candidate.wentWell),
    difficult: normalizeText(candidate.difficult),
  }
}

export function normalizeEntries(value: unknown): EntryMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries: EntryMap = {}
  for (const [date, rawEntry] of Object.entries(value)) {
    const entry = normalizeEntry(rawEntry, date)
    if (entry) entries[entry.date] = entry
  }

  return entries
}

export function normalizeCloudSnapshot(row: unknown): CloudSnapshot | null {
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

export function mergeCloudOnlyEntries(localEntries: EntryMap, cloudEntries: EntryMap): EntryMap {
  return normalizeEntries({
    ...cloudEntries,
    ...localEntries,
  })
}

export function countCloudOnlyEntries(localEntries: EntryMap, cloudEntries: EntryMap): number {
  return Object.keys(cloudEntries).filter((date) => !localEntries[date]).length
}

export function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function selectableEndDate(settings: ChallengeSettings): string {
  const today = todayIso()
  return today < settings.startDate ? settings.startDate : today
}

export function clampDate(date: string, settings: ChallengeSettings): string {
  if (date < settings.startDate) return settings.startDate
  const endDate = selectableEndDate(settings)
  if (date > endDate) return endDate
  return date
}

export function makeEmptyEntry(date: string): DailyEntry {
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
    ruleValues: {},
    mood: 3,
    energy: 3,
    hunger: 3,
    sleepHours: null,
    wentWell: '',
    difficult: '',
  }
}

export function isEntryFinalized(entry: DailyEntry): boolean {
  return typeof entry.finalizedAt === 'string' && entry.finalizedAt.length > 0
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

export function formatMonthLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

export function dayNumber(date: string, settings: ChallengeSettings): number {
  return daysBetween(settings.startDate, date) + 1
}

export function trackingLength(settings: ChallengeSettings, throughDate = selectableEndDate(settings)): number {
  return daysBetween(settings.startDate, throughDate) + 1
}

export function getTrackingDates(settings: ChallengeSettings, throughDate = selectableEndDate(settings)): string[] {
  return Array.from({ length: trackingLength(settings, throughDate) }, (_, index) => addDays(settings.startDate, index))
}

export function getScoredRules(settings: ChallengeSettings): RuleConfig[] {
  return settings.rules.filter((rule) => rule.deleted !== true)
}

export function exercisePatternDay(rule: RuleConfig, date: string, settings: ChallengeSettings): number | null {
  if (!rule.exercise) return null
  return (daysBetween(settings.startDate, date) % rule.exercise.cycleDays) + 1
}

export function isRuleScheduledForDate(rule: RuleConfig, date: string, settings: ChallengeSettings): boolean {
  if (rule.category !== 'exercise' || !rule.exercise) return true
  const cycleDay = exercisePatternDay(rule, date, settings)
  return cycleDay !== null && rule.exercise.scheduledDays.includes(cycleDay)
}

export function getEnabledRules(settings: ChallengeSettings, date?: string): RuleConfig[] {
  return getScoredRules(settings).filter((rule) => rule.enabled && (!date || isRuleScheduledForDate(rule, date, settings)))
}

export function ruleWeightValue(rule: RuleConfig): number {
  return rule.weight === 'nonNegotiable' ? 2 : 1
}

export function getDietRuleValue(entry: DailyEntry, rule: RuleConfig): number | null {
  const stored = entry.ruleValues?.[rule.key]
  if (typeof stored === 'number') return stored
  switch (rule.key) {
    case 'calories': return entry.calories
    case 'protein': return entry.proteinGrams
    case 'water': return entry.waterLiters
    default: return null
  }
}

export function getExerciseRuleMinutes(entry: DailyEntry, rule: RuleConfig): number {
  const workoutType = rule.exercise?.workoutType ?? 'Any exercise'
  if (workoutType === 'Any exercise') return getExerciseMinutes(entry)
  return (entry.workouts ?? [])
    .filter((workout) => workout.type.toLowerCase() === workoutType.toLowerCase())
    .reduce((sum, workout) => sum + workout.minutes, 0)
}

export function ruleComplete(entry: DailyEntry, ruleKey: RuleKey, settings: ChallengeSettings): boolean {
  const config = settings.rules.find((rule) => rule.key === ruleKey)
  if (config?.category === 'exercise' && config.exercise) {
    return isRuleScheduledForDate(config, entry.date, settings)
      && getExerciseRuleMinutes(entry, config) >= config.exercise.targetMinutes
  }
  if (config?.category === 'diet' && config.diet) {
    if (config.diet.goalType === 'avoid') {
      return config.key === 'sober' ? entry.sober : entry.ruleCompletions?.[config.key] === true
    }
    const value = getDietRuleValue(entry, config)
    if (value === null) return false
    return config.diet.goalType === 'minimum' ? value >= config.diet.goal : value <= config.diet.goal
  }

  switch (ruleKey) {
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
      return entry.ruleCompletions?.[ruleKey] === true
  }
}

export function completionStats(entry: DailyEntry, settings: ChallengeSettings) {
  const activeRules = getEnabledRules(settings, entry.date)
  const totalWeight = activeRules.reduce((sum, rule) => sum + ruleWeightValue(rule), 0)
  const completedRules = activeRules.filter((rule) => ruleComplete(entry, rule.key, settings))
  const completedWeight = completedRules.reduce((sum, rule) => sum + ruleWeightValue(rule), 0)

  return {
    completed: completedRules.length,
    total: activeRules.length,
    percent: totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100),
  }
}

export function getLoggedDates(entries: EntryMap, settings: ChallengeSettings): string[] {
  const endDate = selectableEndDate(settings)
  return Object.keys(entries)
    .filter((date) => date >= settings.startDate && date <= endDate)
    .sort()
}

export function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return cleaned || 'challenge'
}

export function downloadTextFile(filename: string, mimeType: string, text: string): void {
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

export function makeBackupPayload(settings: ChallengeSettings, entries: EntryMap): BackupPayload {
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

export function entriesToCsv(entries: EntryMap, settings: ChallengeSettings): string {
  const csvRules = getScoredRules(settings)
  const ruleColumns = csvRules.map((rule) => `rule_${rule.key}`)
  const ruleValueColumns = csvRules.map((rule) => `value_${rule.key}`)
  const headers = [
    'date',
    'tracking_day',
    'completion_percent',
    'completed_rules',
    'total_rules',
    ...ruleColumns,
    ...ruleValueColumns,
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
      ...csvRules.map((rule) => rule.diet && rule.diet.goalType !== 'avoid' ? getDietRuleValue(entry, rule) : ''),
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

export async function readBackupFile(file: File): Promise<BackupPayload> {
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
