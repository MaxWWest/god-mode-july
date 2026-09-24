import { describe, expect, it } from 'vitest'
import {
  calculateAdherenceScore,
  calculateCoreThreeCompliance,
  calculateRollingWeightAverage,
  calculateWeeklyWeightChange,
  calorieAdherence,
} from './cutMetrics'
import { addDays, DEFAULT_SETTINGS, makeEmptyEntry, normalizeSettings } from './tracker'
import type { EntryMap } from './types'

const settings = normalizeSettings({ ...DEFAULT_SETTINGS, startDate: '2026-07-01', endDate: '2026-12-31' })

function weightEntries(values: Array<number | null>): EntryMap {
  return Object.fromEntries(values.map((weight, index) => {
    const date = addDays('2026-07-01', index)
    return [date, { ...makeEmptyEntry(date), weightPounds: weight }]
  }))
}

describe('cut metrics', () => {
  it('calculates a seven-day rolling trend from noisy measurements', () => {
    const points = calculateRollingWeightAverage(weightEntries([229.5, 229, 228.7, 229.1, 228.2, 227.9, 228]), '2026-07-07')
    expect(points).toHaveLength(7)
    expect(points[6].rollingAverage).toBeCloseTo(228.63, 2)
  })

  it('ignores missing weigh-ins instead of treating them as zero', () => {
    const points = calculateRollingWeightAverage(weightEntries([229.5, null, 228.5, null, 228]), '2026-07-05')
    expect(points).toHaveLength(3)
    expect(points[2].rollingAverage).toBeCloseTo(228.67, 2)
  })

  it('compares calendar-week averages only when both weeks have weight data', () => {
    const entries = weightEntries([230, 229, null, null, null, null, null, 228, 227])
    expect(calculateWeeklyWeightChange(entries, '2026-07-09')).toMatchObject({ current: 227.5, previous: 229.5, change: -2 })
  })

  it('does not reward extreme under-eating', () => {
    expect(calorieAdherence(1950, 2000)).toBe(1)
    expect(calorieAdherence(1000, 2000)).toBeLessThan(0.6)
    const entry = { ...makeEmptyEntry('2026-07-01'), calories: 1000, proteinGrams: 150, steps: 12000, plannedWorkoutCompleted: true }
    expect(calculateAdherenceScore(entry, settings)).toBeLessThan(85)
  })

  it('gives planned recovery full training credit and keeps weight out of adherence', () => {
    const entry = { ...makeEmptyEntry('2026-07-01'), calories: 2000, proteinGrams: 150, steps: 12000, plannedWorkoutCompleted: true }
    expect(calculateAdherenceScore(entry, settings)).toBe(100)
    expect(calculateCoreThreeCompliance(entry, settings).complete).toBe(true)
    expect(calculateAdherenceScore({ ...entry, weightPounds: 500 }, settings)).toBe(100)
  })
})
