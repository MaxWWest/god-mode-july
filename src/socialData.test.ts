import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildChallengeSettingsForTemplate,
  buildChallengeSummary,
  buildFriendChallengeSnapshots,
  buildFriendChallengeSummary,
  normalizeChallengeScoreSnapshotRow,
  normalizeFriendChallengeParticipantRow,
  normalizeSummaryRow,
} from './socialData'
import { DEFAULT_SETTINGS, makeEmptyEntry, normalizeSettings } from './tracker'
import type { FriendChallenge } from './types'

describe('social challenge data', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-18T12:00:00Z'))
  })

  afterEach(() => vi.useRealTimers())

  it('applies challenge template target and rule overrides', () => {
    const settings = buildChallengeSettingsForTemplate(
      DEFAULT_SETTINGS,
      'sleep-reset',
      'Sleep together',
      '2026-06-18',
      '2026-06-27',
    )

    expect(settings.title).toBe('Sleep together')
    expect(settings.targets.sleepHours).toBe(8)
    expect(settings.rules.find((rule) => rule.key === 'sleep')).toMatchObject({
      enabled: true,
      weight: 'nonNegotiable',
    })
    expect(settings.rules.find((rule) => rule.key === 'exercise')?.exercise?.targetMinutes).toBe(45)
    expect(settings.rules.find((rule) => rule.key === 'water')?.diet?.goal).toBe(3)
  })

  it('redacts hidden values from published leaderboard summaries', () => {
    const settings = normalizeSettings({ ...DEFAULT_SETTINGS, startDate: '2026-06-17', endDate: '2026-06-30' })
    const entry = {
      ...makeEmptyEntry('2026-06-17'),
      exerciseMinutes: settings.targets.exerciseMinutes,
      sober: true,
      proteinGrams: settings.targets.proteinGrams,
      readTenPages: true,
      journaled: true,
    }
    const summary = buildChallengeSummary('user-1', { [entry.date]: entry }, settings, {
      showWeeklyCompletion: false,
      showAverageCompletion: false,
      showStreak: false,
      showLoggedDays: false,
    })

    expect(summary).toMatchObject({
      loggedDays: 0,
      averageCompletion: 0,
      weeklyCompletion: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastLoggedDate: null,
    })
  })

  it('scores only elapsed dates inside a friend challenge', () => {
    const challenge: FriendChallenge = {
      id: 'challenge-1',
      creatorId: 'user-1',
      name: 'Three days',
      startDate: '2026-06-17',
      endDate: '2026-06-19',
      scoringMode: 'personal',
      settings: DEFAULT_SETTINGS,
      createdAt: '2026-06-17T00:00:00Z',
      updatedAt: '2026-06-17T00:00:00Z',
    }
    const entry = { ...makeEmptyEntry('2026-06-17'), sober: true }
    const summary = buildFriendChallengeSummary('user-1', { [entry.date]: entry }, challenge, DEFAULT_SETTINGS)

    expect(summary.totalDays).toBe(2)
    expect(summary.loggedDays).toBe(1)
    expect(summary.endDate).toBe('2026-06-19')

    const snapshots = buildFriendChallengeSnapshots('user-1', { [entry.date]: entry }, challenge, DEFAULT_SETTINGS)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]).toMatchObject({
      challengeId: 'challenge-1',
      userId: 'user-1',
      date: '2026-06-17',
      totalRules: 5,
    })
  })

  it('normalizes stored participant summaries and rejects malformed rows', () => {
    const participant = normalizeFriendChallengeParticipantRow({
      challenge_id: 'challenge-1',
      user_id: 'user-1',
      invited_by: 'user-2',
      status: 'accepted',
      summary: {
        user_id: 'user-1',
        challenge_title: 'June push',
        start_date: '2026-06-01',
        end_date: '2026-06-18',
        weekly_completion: 88,
      },
    })

    expect(participant?.summary?.weeklyCompletion).toBe(88)
    expect(normalizeFriendChallengeParticipantRow({ user_id: 'user-1' })).toBeNull()
    expect(normalizeSummaryRow(null)).toBeNull()
    expect(normalizeChallengeScoreSnapshotRow({
      challenge_id: 'challenge-1',
      user_id: 'user-1',
      score_date: '2026-06-18',
      completion_percent: 120,
      completed_rules: 8,
      total_rules: 5,
      published_at: '2026-06-18T10:00:00Z',
    })).toMatchObject({ completionPercent: 100, completedRules: 5, totalRules: 5 })
  })
})
