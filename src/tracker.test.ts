import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  buildDailyShareText,
  completionStats,
  duplicateFoodLog,
  formatExercisePatternDayLabel,
  formatExercisePatternSchedule,
  foodLibraryItemFromFood,
  foodLogFromLibraryItem,
  foodLogsEntryPatch,
  foodNutritionTotals,
  getEnabledRules,
  getExercisePatternProgress,
  getNextExerciseDate,
  makeEmptyEntry,
  normalizeFoodLibrary,
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

  it('normalizes persisted appearance choices and rejects unknown themes', () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, appearance: { theme: 'light', accent: 'teal' } }).appearance)
      .toEqual({ theme: 'light', accent: 'teal' })
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, appearance: { theme: 'neon', accent: 'orange' } }).appearance)
      .toEqual(DEFAULT_SETTINGS.appearance)
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

  it('uses weekday labels and reports current-cycle exercise progress', () => {
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
    const rule = settings.rules.find((item) => item.key === 'exercise')!
    const monday = {
      ...makeEmptyEntry('2026-06-01'),
      exerciseMinutes: 30,
      workouts: [{ id: 'strength-1', type: 'Strength', minutes: 30 }],
    }
    const progress = getExercisePatternProgress(rule, { [monday.date]: monday }, '2026-06-05', settings)

    expect([1, 3, 5].map((day) => formatExercisePatternDayLabel(rule, day, settings))).toEqual(['Mon', 'Wed', 'Fri'])
    expect(formatExercisePatternSchedule(rule, settings)).toBe('Mon, Wed, Fri')
    expect(getNextExerciseDate(rule, '2026-06-02', settings)).toBe('2026-06-03')
    expect(progress).toMatchObject({
      scheduledDates: ['2026-06-01', '2026-06-03', '2026-06-05'],
      completedDates: ['2026-06-01'],
      reachedDates: ['2026-06-01', '2026-06-03', '2026-06-05'],
      nextScheduledDate: '2026-06-08',
    })
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

  it('derives macro goals from logged meal items', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      rules: [
        { key: 'custom-carb-cap', label: 'Carbs', icon: 'C', enabled: true, weight: 'supporting', category: 'diet', diet: { goalType: 'maximum', goal: 200, unit: 'g', trackingSource: 'carbs' } },
        { key: 'custom-sodium-cap', label: 'Sodium', icon: 'S', enabled: true, weight: 'supporting', category: 'diet', diet: { goalType: 'maximum', goal: 2300, unit: 'mg', trackingSource: 'sodium' } },
      ],
    })
    const foods = [
      { id: 'oats', meal: 'breakfast' as const, name: 'Oats', calories: 350, proteinGrams: 15, carbsGrams: 60, fatGrams: 8, sodiumMg: 200, categories: ['grain' as const] },
      { id: 'chicken', meal: 'lunch' as const, name: 'Chicken bowl', calories: 650, proteinGrams: 50, carbsGrams: 70, fatGrams: 18, sodiumMg: 900, categories: ['protein' as const] },
    ]
    const entry = { ...makeEmptyEntry(settings.startDate), ...foodLogsEntryPatch(foods) }

    expect(foodNutritionTotals(entry.foods)).toMatchObject({ calories: 1000, proteinGrams: 65, carbsGrams: 130, sodiumMg: 1100 })
    expect(ruleComplete(entry, 'custom-carb-cap', settings)).toBe(true)
    expect(ruleComplete(entry, 'custom-sodium-cap', settings)).toBe(true)
  })

  it('uses food categories to update alcohol and dessert avoidance rules', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      rules: [
        DEFAULT_SETTINGS.rules.find((rule) => rule.key === 'sober')!,
        { key: 'custom-no-dessert', label: 'No Dessert', icon: 'D', enabled: true, weight: 'supporting', category: 'diet', diet: { goalType: 'avoid', goal: 0, unit: 'servings' } },
      ],
    })
    const dinner = { id: 'dinner', meal: 'dinner' as const, name: 'Chicken', calories: 500, proteinGrams: 45, carbsGrams: 30, fatGrams: 15, sodiumMg: 700, categories: ['protein' as const] }
    const cleanEntry = { ...makeEmptyEntry(settings.startDate), ...foodLogsEntryPatch([dinner]) }
    const beerEntry = { ...makeEmptyEntry(settings.startDate), ...foodLogsEntryPatch([
      dinner,
      { id: 'beer', meal: 'dinner' as const, name: 'Beer', calories: 150, proteinGrams: 1, carbsGrams: 12, fatGrams: 0, sodiumMg: 10, categories: ['alcohol' as const] },
    ]) }
    const cakeEntry = { ...makeEmptyEntry(settings.startDate), ...foodLogsEntryPatch([
      dinner,
      { id: 'cake', meal: 'dinner' as const, name: 'Cake', calories: 400, proteinGrams: 4, carbsGrams: 55, fatGrams: 20, sodiumMg: 300, categories: ['dessert' as const] },
    ]) }

    expect(ruleComplete(cleanEntry, 'sober', settings)).toBe(true)
    expect(ruleComplete(beerEntry, 'sober', settings)).toBe(false)
    expect(ruleComplete(cleanEntry, 'custom-no-dessert', settings)).toBe(true)
    expect(ruleComplete(cakeEntry, 'custom-no-dessert', settings)).toBe(false)
  })

  it('normalizes saved foods and converts them back into meal logs', () => {
    const savedAt = '2026-07-01T12:00:00.000Z'
    const library = normalizeFoodLibrary([
      { id: 'old', name: ' Greek Yogurt ', calories: 150, proteinGrams: 20, carbsGrams: 8, fatGrams: 0, sodiumMg: 90, categories: ['dairy'], favorite: true, useCount: 3, lastUsedAt: savedAt, createdAt: savedAt, updatedAt: savedAt },
      { id: 'duplicate', name: 'greek yogurt', calories: 200, proteinGrams: 25, categories: ['protein'], createdAt: savedAt, updatedAt: savedAt },
      { id: 'invalid', name: '   ' },
    ])

    expect(library).toHaveLength(1)
    expect(library[0]).toMatchObject({ name: 'Greek Yogurt', calories: 150, proteinGrams: 20, categories: ['dairy'], favorite: true, useCount: 3, lastUsedAt: savedAt })

    const mealFood = foodLogFromLibraryItem(library[0], 'lunch', 0.5)
    expect(mealFood).toMatchObject({ meal: 'lunch', name: 'Greek Yogurt (0.5x)', calories: 75, proteinGrams: 10 })
    expect(mealFood.id).not.toBe(library[0].id)
  })

  it('updates existing saved food macros when a matching item is saved again', () => {
    const existing = normalizeFoodLibrary([
      { id: 'chicken', name: 'Chicken Bowl', calories: 600, proteinGrams: 45, carbsGrams: 60, fatGrams: 15, sodiumMg: 800, categories: ['protein'], favorite: true, useCount: 4, lastUsedAt: '2026-06-02T12:00:00.000Z', createdAt: '2026-06-01T12:00:00.000Z', updatedAt: '2026-06-01T12:00:00.000Z' },
    ])[0]
    const next = foodLibraryItemFromFood({ id: 'meal-1', meal: 'dinner', name: 'Chicken Bowl', calories: 700, proteinGrams: 55, carbsGrams: 75, fatGrams: 18, sodiumMg: 950, categories: ['protein', 'grain'] }, existing)

    expect(next.id).toBe(existing.id)
    expect(next.createdAt).toBe(existing.createdAt)
    expect(next).toMatchObject({ calories: 700, proteinGrams: 55, categories: ['protein', 'grain'], favorite: true, useCount: 4, lastUsedAt: '2026-06-02T12:00:00.000Z' })
    expect(new Date(next.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(existing.updatedAt).getTime())
  })

  it('duplicates logged foods with a new id while preserving macros', () => {
    const food = { id: 'beer', meal: 'dinner' as const, name: 'Beer', calories: 150, proteinGrams: 1, carbsGrams: 12, fatGrams: 0, sodiumMg: 10, categories: ['alcohol' as const] }
    const duplicate = duplicateFoodLog(food, 'snack')

    expect(duplicate).toMatchObject({ meal: 'snack', name: 'Beer', calories: 150, proteinGrams: 1, categories: ['alcohol'] })
    expect(duplicate.id).not.toBe(food.id)
    expect(duplicate.categories).not.toBe(food.categories)
  })

  it('builds a daily share scorecard for group accountability', () => {
    const settings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
    })
    const entry = {
      ...makeEmptyEntry('2026-07-01'),
      finalizedAt: '2026-07-02T01:00:00.000Z',
      exerciseMinutes: 90,
      workouts: [{ id: 'lift', type: 'Strength', minutes: 90 }],
      foods: [{ id: 'dinner', meal: 'dinner' as const, name: 'Chicken bowl', calories: 650, proteinGrams: 55, carbsGrams: 60, fatGrams: 18, sodiumMg: 900, categories: ['protein' as const] }],
      sober: true,
      foodLogged: true,
      calories: 650,
      proteinGrams: 55,
      readTenPages: true,
      journaled: true,
      wentWell: 'Showed up early.',
    }

    const shareText = buildDailyShareText(entry, { [entry.date]: entry }, settings)

    expect(shareText).toContain('07/01/2026')
    expect(shareText).toContain("I've completed the day at")
    expect(shareText).toContain('Meals:\n- Dinner: Chicken bowl')
    expect(shareText).toContain('Exercises:\n- Strength 90 min')
    expect(shareText).toContain('Time day completed:')
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
