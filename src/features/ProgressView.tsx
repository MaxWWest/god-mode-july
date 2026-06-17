import { useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  ChallengeSettings,
  DailyEntry,
  EntryMap,
  PeriodRecap,
  ProgressPeriod,
  RuleConfig,
  RuleKey,
  RuleRate,
  TrendMetric,
  TrendPoint,
  WorkoutLog,
} from '../types'

const DAY_IN_MS = 86_400_000
const MAX_DAILY_EXERCISE_MINUTES = 600

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
  return Math.round((new Date(`${endDate}T12:00:00`).getTime() - new Date(`${startDate}T12:00:00`).getTime()) / DAY_IN_MS)
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

function trackingLength(settings: ChallengeSettings, throughDate = selectableEndDate(settings)): number {
  return daysBetween(settings.startDate, throughDate) + 1
}

function getTrackingDates(settings: ChallengeSettings, throughDate = selectableEndDate(settings)): string[] {
  return Array.from({ length: trackingLength(settings, throughDate) }, (_, index) => addDays(settings.startDate, index))
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

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

export default function ProgressView({ entries, settings }: { entries: EntryMap; settings: ChallengeSettings }) {
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
