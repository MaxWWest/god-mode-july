import type {
  ChallengeTemplate,
  FriendChallenge,
  FriendChallengeParticipantStatus,
  FriendFeedReaction,
  FriendsTab,
  ScoreReaction,
} from './types'

export const SCORE_REACTIONS: { key: ScoreReaction; label: string }[] = [
  { key: 'locked-in', label: 'Locked in' },
  { key: 'comeback', label: 'Comeback' },
  { key: 'streak', label: 'Streak' },
  { key: 'respect', label: 'Respect' },
]

export const FRIEND_FEED_REACTIONS: { key: FriendFeedReaction; label: string }[] = [
  { key: 'strong', label: 'Strong' },
  { key: 'respect', label: 'Respect' },
  { key: 'inspired', label: 'Inspired' },
]

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'custom',
    name: 'Custom',
    durationDays: 7,
    scoringMode: 'softShared',
    note: 'Pick shared minimums while everyone can keep personal goals.',
  },
  {
    id: 'no-zero-days',
    name: 'No Zero Days',
    durationDays: 7,
    scoringMode: 'percentOnly',
    note: 'One-week push comparing everyone’s own daily percent.',
    ruleOverrides: {
      exercise: { enabled: true, weight: 'nonNegotiable' },
      protein: { enabled: true, weight: 'nonNegotiable' },
      reading: { enabled: true, weight: 'supporting' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
  {
    id: 'lock-in-week',
    name: 'Lock-In Week',
    durationDays: 7,
    scoringMode: 'shared',
    note: 'Shared rules for a clean head-to-head week.',
    targetOverrides: {
      exerciseMinutes: 90,
      proteinGrams: 140,
      waterLiters: 3,
      sleepHours: 7.5,
    },
    ruleOverrides: {
      exercise: { enabled: true, weight: 'nonNegotiable' },
      sober: { enabled: true, weight: 'nonNegotiable' },
      protein: { enabled: true, weight: 'nonNegotiable' },
      water: { enabled: true, weight: 'supporting' },
      sleep: { enabled: true, weight: 'supporting' },
      reading: { enabled: true, weight: 'supporting' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
  {
    id: 'month-sprint',
    name: '30-Day Sprint',
    durationDays: 30,
    scoringMode: 'softShared',
    note: 'Longer challenge with shared minimums plus personal goals.',
    ruleOverrides: {
      exercise: { enabled: true, weight: 'nonNegotiable' },
      protein: { enabled: true, weight: 'nonNegotiable' },
      water: { enabled: true, weight: 'supporting' },
      sleep: { enabled: true, weight: 'supporting' },
      reading: { enabled: true, weight: 'supporting' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
  {
    id: 'sleep-reset',
    name: 'Sleep Reset',
    durationDays: 10,
    scoringMode: 'shared',
    note: 'Short shared-rule reset challenge.',
    targetOverrides: {
      exerciseMinutes: 45,
      waterLiters: 3,
      sleepHours: 8,
    },
    ruleOverrides: {
      exercise: { enabled: true, weight: 'supporting' },
      sober: { enabled: true, weight: 'supporting' },
      water: { enabled: true, weight: 'supporting' },
      sleep: { enabled: true, weight: 'nonNegotiable' },
      journal: { enabled: true, weight: 'supporting' },
    },
  },
]

export const FRIENDS_TABS: { key: FriendsTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'friends', label: 'Friends' },
  { key: 'squads', label: 'Squads' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'leaderboard', label: 'Leaderboard' },
]

export function challengeScoringModeLabel(mode: FriendChallenge['scoringMode']): string {
  switch (mode) {
    case 'shared': return 'Shared rules'
    case 'personal': return 'Matched metrics'
    case 'softShared': return 'Soft shared metrics'
    case 'percentOnly': return 'Percent only'
  }
}

export function challengeScoringModeDescription(mode: FriendChallenge['scoringMode']): string {
  switch (mode) {
    case 'shared': return 'Everyone uses the exact same selected rules and targets.'
    case 'personal': return 'Everyone scores the same selected metrics, using their own targets where available.'
    case 'softShared': return 'Selected metrics are mandatory minimums, and each person’s extra active goals also count.'
    case 'percentOnly': return 'Everyone publishes their own daily percent complete with no required overlap.'
  }
}

export function normalizeScoreReaction(value: unknown): ScoreReaction | null {
  return SCORE_REACTIONS.some((reaction) => reaction.key === value) ? value as ScoreReaction : null
}

export function normalizeFriendFeedReaction(value: unknown): FriendFeedReaction | null {
  return FRIEND_FEED_REACTIONS.some((reaction) => reaction.key === value) ? value as FriendFeedReaction : null
}

export function challengeTemplateById(templateId?: string): ChallengeTemplate {
  return CHALLENGE_TEMPLATES.find((template) => template.id === templateId) ?? CHALLENGE_TEMPLATES[0]
}

export function describeTemplateOverrides(template: ChallengeTemplate): string {
  const targetCount = Object.keys(template.targetOverrides ?? {}).length
  const activeRuleCount = Object.values(template.ruleOverrides ?? {}).filter((override) => override?.enabled === true).length
  if (targetCount === 0 && activeRuleCount === 0) return template.note
  const pieces = [
    targetCount > 0 ? `${targetCount} target ${targetCount === 1 ? 'override' : 'overrides'}` : '',
    activeRuleCount > 0 ? `${activeRuleCount} rule ${activeRuleCount === 1 ? 'preset' : 'presets'}` : '',
  ].filter(Boolean)
  return `${template.note} ${pieces.join(' · ')}.`
}

export function isChallengeCompleted(challenge: Pick<FriendChallenge, 'endDate'>): boolean {
  return challenge.endDate < todayIso()
}

export function statusLabel(status: FriendChallengeParticipantStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function reactionLabel(reaction: ScoreReaction | null | undefined): string | null {
  return SCORE_REACTIONS.find((item) => item.key === reaction)?.label ?? null
}

function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
