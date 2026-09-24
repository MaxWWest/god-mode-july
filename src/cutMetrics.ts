import type { ChallengeSettings, DailyEntry, EntryMap, WorkoutLog } from './types'
import { addDays, todayIso } from './tracker'

export type WeightPoint = { date: string; raw: number; rollingAverage: number | null }
export type WeeklyCutSummary = {
  startDate: string
  endDate: string
  currentWeightAverage: number | null
  previousWeightAverage: number | null
  weightChange: number | null
  weightChangePercent: number | null
  averageCalories: number | null
  averageProtein: number | null
  averageSteps: number | null
  averageSleep: number | null
  alcoholDrinks: number
  strengthSessions: number
  cardioSessions: number
  recoverySessions: number
  averageAdherence: number | null
  coreThreeDays: number
  elapsedDays: number
  loggedDays: number
}

const round = (value: number, places = 1) => Number(value.toFixed(places))
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

function dateRange(endDate: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => addDays(endDate, index - days + 1))
}

function numericValues(entries: EntryMap, dates: string[], getter: (entry: DailyEntry) => number | null): number[] {
  return dates.flatMap((date) => {
    const value = entries[date] ? getter(entries[date]) : null
    return typeof value === 'number' ? [value] : []
  })
}

export function poundsToDisplay(pounds: number, unit: 'lb' | 'kg'): number {
  return unit === 'kg' ? pounds / 2.2046226218 : pounds
}

export function displayWeightToPounds(value: number, unit: 'lb' | 'kg'): number {
  return unit === 'kg' ? value * 2.2046226218 : value
}

export function inchesToDisplay(inches: number, unit: 'in' | 'cm'): number {
  return unit === 'cm' ? inches * 2.54 : inches
}

export function displayWaistToInches(value: number, unit: 'in' | 'cm'): number {
  return unit === 'cm' ? value / 2.54 : value
}

export function calculateRollingWeightAverage(entries: EntryMap, throughDate = todayIso(), windowDays = 7): WeightPoint[] {
  const weights = Object.values(entries)
    .filter((entry) => entry.date <= throughDate && typeof entry.weightPounds === 'number')
    .sort((a, b) => a.date.localeCompare(b.date))
  return weights.map((entry) => {
    const startDate = addDays(entry.date, -(windowDays - 1))
    const window = weights.filter((candidate) => candidate.date >= startDate && candidate.date <= entry.date)
    return {
      date: entry.date,
      raw: entry.weightPounds!,
      rollingAverage: window.length >= 3 ? round(average(window.map((item) => item.weightPounds!))!, 2) : null,
    }
  })
}

export function startOfWeek(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  const mondayOffset = (parsed.getDay() + 6) % 7
  return addDays(date, -mondayOffset)
}

export function calculateWeeklyAverage(entries: EntryMap, weekStart: string): number | null {
  return average(numericValues(entries, dateRange(addDays(weekStart, 6), 7), (entry) => entry.weightPounds))
}

export function calculateWeeklyWeightChange(entries: EntryMap, throughDate = todayIso()) {
  const currentStart = startOfWeek(throughDate)
  const previousStart = addDays(currentStart, -7)
  const current = calculateWeeklyAverage(entries, currentStart)
  const previous = calculateWeeklyAverage(entries, previousStart)
  if (current === null || previous === null) return { current, previous, change: null, percent: null }
  const change = current - previous
  return { current: round(current, 2), previous: round(previous, 2), change: round(change, 2), percent: round((change / previous) * 100, 2) }
}

export function calculateWeightLossRate(entries: EntryMap, throughDate = todayIso()) {
  const points = calculateRollingWeightAverage(entries, throughDate).filter((point) => point.rollingAverage !== null)
  if (points.length < 7) return { poundsPerWeek: null, percentPerWeek: null }
  const latest = points[points.length - 1]
  const comparison = [...points].reverse().find((point) => point.date <= addDays(latest.date, -10))
  if (!comparison?.rollingAverage || !latest.rollingAverage) return { poundsPerWeek: null, percentPerWeek: null }
  const elapsedDays = Math.max(1, (new Date(`${latest.date}T12:00:00`).getTime() - new Date(`${comparison.date}T12:00:00`).getTime()) / 86_400_000)
  const poundsPerWeek = ((latest.rollingAverage - comparison.rollingAverage) / elapsedDays) * 7
  return { poundsPerWeek: round(poundsPerWeek, 2), percentPerWeek: round((poundsPerWeek / comparison.rollingAverage) * 100, 2) }
}

export function calorieAdherence(calories: number | null, target: number): number {
  if (calories === null || target <= 0) return 0
  const low = target * 0.9
  const high = target * 1.05
  if (calories >= low && calories <= high) return 1
  if (calories < low) return Math.max(0, calories / low)
  return Math.max(0, 1 - ((calories - high) / (target * 0.5)))
}

export function calculateAdherenceScore(entry: DailyEntry, settings: ChallengeSettings): number {
  const calories = calorieAdherence(entry.calories, settings.targets.calories)
  const protein = entry.proteinGrams === null ? 0 : Math.min(1, entry.proteinGrams / settings.targets.proteinGrams)
  const steps = entry.steps === null ? 0 : Math.min(1, entry.steps / settings.targets.steps)
  const training = entry.plannedWorkoutCompleted === true ? 1 : 0
  return Math.round((calories * 0.4 + protein * 0.25 + steps * 0.2 + training * 0.15) * 100)
}

export function calculateCoreThreeCompliance(entry: DailyEntry, settings: ChallengeSettings) {
  const calories = calorieAdherence(entry.calories, settings.targets.calories) === 1
  const protein = entry.proteinGrams !== null && entry.proteinGrams >= settings.targets.proteinGrams
  const steps = entry.steps !== null && entry.steps >= settings.targets.steps
  return { calories, protein, steps, complete: calories && protein && steps }
}

function workoutBuckets(workouts: WorkoutLog[]) {
  return workouts.reduce((counts, workout) => {
    const type = workout.type.toLowerCase()
    if (type.includes('strength')) counts.strength += 1
    else if (type.includes('run') || type.includes('cardio') || type.includes('cycling')) counts.cardio += 1
    else if (type.includes('recovery') || type.includes('mobility') || type.includes('yoga') || type === 'rest') counts.recovery += 1
    return counts
  }, { strength: 0, cardio: 0, recovery: 0 })
}

export function buildWeeklyCutSummary(entries: EntryMap, settings: ChallengeSettings, throughDate = todayIso()): WeeklyCutSummary {
  const startDate = startOfWeek(throughDate)
  const dates = dateRange(throughDate, Math.min(7, Number(throughDate.slice(8, 10)) + 7)).filter((date) => date >= startDate)
  const logged = dates.map((date) => entries[date]).filter((entry): entry is DailyEntry => Boolean(entry))
  const weight = calculateWeeklyWeightChange(entries, throughDate)
  const workouts = workoutBuckets(logged.flatMap((entry) => entry.workouts ?? []))
  return {
    startDate,
    endDate: throughDate,
    currentWeightAverage: weight.current,
    previousWeightAverage: weight.previous,
    weightChange: weight.change,
    weightChangePercent: weight.percent,
    averageCalories: average(logged.flatMap((entry) => entry.calories === null ? [] : [entry.calories])),
    averageProtein: average(logged.flatMap((entry) => entry.proteinGrams === null ? [] : [entry.proteinGrams])),
    averageSteps: average(logged.flatMap((entry) => entry.steps === null ? [] : [entry.steps])),
    averageSleep: average(logged.flatMap((entry) => entry.sleepHours === null ? [] : [entry.sleepHours])),
    alcoholDrinks: logged.reduce((sum, entry) => sum + (entry.alcoholDrinks ?? 0), 0),
    strengthSessions: workouts.strength,
    cardioSessions: workouts.cardio,
    recoverySessions: workouts.recovery,
    averageAdherence: logged.length ? average(logged.map((entry) => calculateAdherenceScore(entry, settings))) : null,
    coreThreeDays: logged.filter((entry) => calculateCoreThreeCompliance(entry, settings).complete).length,
    elapsedDays: dates.length,
    loggedDays: logged.length,
  }
}

export function calculateProgressToCheckpoint(settings: ChallengeSettings, currentWeight: number | null) {
  const start = settings.targets.startingWeightPounds
  const checkpoint = settings.targets.checkpointWeightsPounds[0]
  if (currentWeight === null || start === checkpoint) return { lost: null, remaining: null, percent: 0 }
  const lost = start - currentWeight
  const total = start - checkpoint
  return { lost: round(lost), remaining: round(Math.max(0, currentWeight - checkpoint)), percent: Math.round(Math.max(0, Math.min(1, lost / total)) * 100) }
}

export function calculateWaistChange(entries: EntryMap) {
  const values = Object.values(entries).filter((entry) => typeof entry.waistInches === 'number').sort((a, b) => a.date.localeCompare(b.date))
  if (!values.length) return { starting: null, current: null, change: null }
  const starting = values[0].waistInches!
  const current = values[values.length - 1].waistInches!
  return { starting, current, change: round(current - starting, 2) }
}

export function getCutStatus(entries: EntryMap, settings: ChallengeSettings, throughDate = todayIso()) {
  const rate = calculateWeightLossRate(entries, throughDate)
  const weekly = buildWeeklyCutSummary(entries, settings, throughDate)
  if (rate.percentPerWeek === null) return { label: 'INSUFFICIENT DATA', message: 'Keep logging morning weight. More data is needed before evaluating the trend.', tone: 'neutral' as const }
  const lossRate = -rate.percentPerWeek
  if (lossRate > 1) return { label: 'HOLD STEADY', message: 'Weight is falling quickly. Monitor recovery, hunger, training performance, and energy.', tone: 'rapid' as const }
  if (lossRate >= 0.5) return { label: 'ON TRACK', message: 'Your current trend is within the target range. Keep the current plan.', tone: 'success' as const }
  if (lossRate < 0.25 && (weekly.averageAdherence ?? 0) >= 80) return { label: 'REVIEW PLAN', message: 'The trend is relatively flat despite good adherence. Review intake accuracy and activity before changing targets.', tone: 'review' as const }
  return { label: 'HOLD STEADY', message: 'The trend is moving. Keep collecting consistent data before making an adjustment.', tone: 'neutral' as const }
}
