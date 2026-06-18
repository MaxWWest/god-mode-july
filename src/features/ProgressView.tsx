import { useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  ChallengeSettings,
  EntryMap,
  PeriodRecap,
  ProgressPeriod,
  RuleRate,
  TrendMetric,
  TrendPoint,
} from '../types'
import {
  addDays,
  completionStats,
  daysBetween,
  formatExercisePatternSchedule,
  formatMonthLabel,
  formatShortDate,
  getEnabledRules,
  getExercisePatternProgress,
  getLoggedDates,
  getTrackingDates,
  isRuleScheduledForDate,
  ruleComplete,
  selectableEndDate,
} from '../tracker'

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
    const eligibleDates = dates.filter((date) => isRuleScheduledForDate(rule, date, settings))
    if (eligibleDates.length === 0) return { ...rule, rate: 0 }
    const completeDays = eligibleDates.filter((date) => ruleComplete(entries[date], rule.key, settings)).length
    return { ...rule, rate: Math.round((completeDays / eligibleDates.length) * 100) }
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

export default function ProgressView({
  entries,
  settings,
  selectedDate,
  onSelectDate,
}: {
  entries: EntryMap
  settings: ChallengeSettings
  selectedDate: string
  onSelectDate: (date: string) => void
}) {
  const [period, setPeriod] = useState<ProgressPeriod>('week')
  const [progressTab, setProgressTab] = useState<'overview' | 'calendar'>('overview')
  const dates = getLoggedDates(entries, settings)
  const ruleRates = getRuleRatesForDates(dates, entries, settings)
  const periodRecap = buildPeriodRecap(entries, settings, period)
  const trendData = TREND_METRICS.map((metric) => ({
    metric,
    points: getTrendPoints(entries, settings, metric),
  }))
  const throughDate = selectableEndDate(settings)
  const exercisePatterns = getEnabledRules(settings)
    .filter((rule) => rule.category === 'exercise' && rule.exercise)
    .map((rule) => ({ rule, progress: getExercisePatternProgress(rule, entries, throughDate, settings) }))
    .filter((item) => item.progress !== null)

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

      <div className="settings-tabs" role="tablist" aria-label="Progress sections">
        <button className={progressTab === 'overview' ? 'active' : ''} type="button" role="tab" aria-selected={progressTab === 'overview'} onClick={() => setProgressTab('overview')}>Overview</button>
        <button className={progressTab === 'calendar' ? 'active' : ''} type="button" role="tab" aria-selected={progressTab === 'calendar'} onClick={() => setProgressTab('calendar')}>Calendar</button>
      </div>

      {progressTab === 'calendar' ? (
        <ProgressCalendar entries={entries} selectedDate={selectedDate} settings={settings} onSelectDate={onSelectDate} />
      ) : (
        <>

      {exercisePatterns.length > 0 && (
        <section className="panel exercise-progress-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current cycle</p>
              <h2>Exercise patterns</h2>
            </div>
          </div>
          <div className="exercise-progress-list">
            {exercisePatterns.map(({ rule, progress }) => {
              if (!progress) return null
              const percent = progress.scheduledDates.length === 0
                ? 0
                : Math.round((progress.completedDates.length / progress.scheduledDates.length) * 100)
              const todayIsTraining = progress.scheduledDates.includes(throughDate)
              return (
                <article className="exercise-progress-card" key={rule.key}>
                  <div className="exercise-progress-header">
                    <span>{rule.icon}</span>
                    <div>
                      <strong>{rule.label}</strong>
                      <small>{formatExercisePatternSchedule(rule, settings)} · {formatShortDate(progress.cycleStart)}–{formatShortDate(progress.cycleEnd)}</small>
                    </div>
                    <b>{progress.completedDates.length}/{progress.scheduledDates.length}</b>
                  </div>
                  <div className="bar-track"><span style={{ width: `${percent}%` }} /></div>
                  <div className="exercise-cycle-days">
                    {progress.scheduledDates.map((date) => {
                      const state = progress.completedDates.includes(date) ? 'complete' : date > throughDate ? 'upcoming' : 'missed'
                      return <span className={state} key={date}><strong>{formatShortDate(date)}</strong><small>{state}</small></span>
                    })}
                  </div>
                  <p>{todayIsTraining ? `${rule.exercise?.targetMinutes} minutes planned today.` : progress.nextScheduledDate ? `Rest day today · next training ${formatShortDate(progress.nextScheduledDate)}.` : 'Rest day today.'}</p>
                </article>
              )
            })}
          </div>
        </section>
      )}

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
        </>
      )}
    </div>
  )
}

function calendarCellLabel(date: string, settings: ChallengeSettings): string {
  const parsed = new Date(`${date}T12:00:00`)
  const day = parsed.getDate()
  if (date === settings.startDate || day === 1) return formatShortDate(date)
  return String(day)
}

function ProgressCalendar({
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
    <>
      <section className="page-intro progress-calendar-intro">
        <p className="eyebrow">Consistency map</p>
        <h2>{formatMonthLabel(selectedDate)}</h2>
        <p>Green means 80% or better. Tap a tracked date to open it on Home.</p>
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
              <button type="button" key={cell.key} className={`calendar-day ${status} ${selectedDate === cell.date ? 'selected' : ''}`} onClick={() => onSelectDate(cell.date)}>
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
    </>
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
