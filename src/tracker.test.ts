import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  completionStats,
  getEnabledRules,
  makeEmptyEntry,
  normalizePrivacySettings,
  normalizeSettings,
  ruleComplete,
} from './tracker'

describe('tracker scoring', () => {
  it('weights non-negotiable rules twice as much as supporting rules', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      rules: DEFAULT_SETTINGS.rules.map((rule) => ({
        ...rule,
        enabled: rule.key === 'exercise' || rule.key === 'reading',
        weight: rule.key === 'exercise' ? 'nonNegotiable' : 'supporting',
      })),
    })
    const entry = { ...makeEmptyEntry(settings.startDate), readTenPages: true }

    expect(completionStats(entry, settings)).toEqual({ completed: 1, total: 2, percent: 33 })
  })

  it('normalizes invalid targets and keeps custom scored rules', () => {
    const settings = normalizeSettings({
      targets: { exerciseMinutes: 0, calories: '2400', proteinGrams: 160, waterLiters: 3, sleepHours: 8 },
      rules: [{
        key: 'custom-morning-walk',
        label: 'Morning walk',
        icon: 'W',
        enabled: true,
        weight: 'supporting',
        category: 'activity',
      }],
    })

    expect(settings.targets.exerciseMinutes).toBe(DEFAULT_SETTINGS.targets.exerciseMinutes)
    expect(settings.targets.calories).toBe(2400)
    expect(settings.rules.some((rule) => rule.key === 'custom-morning-walk')).toBe(true)
  })

  it('scores exercise only on selected days in a repeating pattern', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      startDate: '2026-06-01',
      endDate: '2026-07-01',
      rules: DEFAULT_SETTINGS.rules.map((rule) => ({
        ...rule,
        enabled: rule.key === 'exercise',
        exercise: rule.key === 'exercise'
          ? { cycleDays: 7, scheduledDays: [1, 3, 5], workoutType: 'Strength', targetMinutes: 30 }
          : rule.exercise,
      })),
    })
    const restDay = makeEmptyEntry('2026-06-02')
    const trainingDay = {
      ...makeEmptyEntry('2026-06-03'),
      workouts: [{ id: 'strength-1', type: 'Strength', minutes: 30 }],
      exerciseMinutes: 30,
    }

    expect(getEnabledRules(settings, restDay.date)).toHaveLength(0)
    expect(completionStats(trainingDay, settings)).toEqual({ completed: 1, total: 1, percent: 100 })
  })

  it('supports minimum, maximum, and avoid diet goals with custom units', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      rules: [
        { key: 'custom-fiber-goal', label: 'Fiber', icon: 'F', enabled: true, weight: 'supporting', category: 'diet', diet: { goalType: 'minimum', goal: 30, unit: 'g' } },
        { key: 'custom-sodium-cap', label: 'Sodium', icon: 'S', enabled: true, weight: 'supporting', category: 'diet', diet: { goalType: 'maximum', goal: 2300, unit: 'mg' } },
        { key: 'custom-dessert-avoid', label: 'Dessert', icon: 'D', enabled: true, weight: 'supporting', category: 'diet', diet: { goalType: 'avoid', goal: 0, unit: 'servings' } },
      ],
    })
    const entry = {
      ...makeEmptyEntry(settings.startDate),
      ruleValues: { 'custom-fiber-goal': 32, 'custom-sodium-cap': 2100 },
      ruleCompletions: { 'custom-dessert-avoid': true },
    }

    expect(ruleComplete(entry, 'custom-fiber-goal', settings)).toBe(true)
    expect(ruleComplete(entry, 'custom-sodium-cap', settings)).toBe(true)
    expect(ruleComplete(entry, 'custom-dessert-avoid', settings)).toBe(true)
  })
})

describe('privacy settings', () => {
  it('defaults malformed values without disabling valid choices', () => {
    expect(normalizePrivacySettings({ showStreak: false, showLoggedDays: 'yes' })).toEqual({
      showWeeklyCompletion: true,
      showAverageCompletion: true,
      showStreak: false,
      showLoggedDays: true,
    })
  })
})
