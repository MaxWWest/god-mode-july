import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  completionStats,
  makeEmptyEntry,
  normalizePrivacySettings,
  normalizeSettings,
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
