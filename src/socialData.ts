import type { User } from '@supabase/supabase-js'
import { challengeTemplateById, normalizeFriendFeedReaction, normalizeScoreReaction } from './social'
import {
  BUILT_IN_RULE_KEYS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_SETTINGS,
  MAX_TRACKING_DAYS,
  addDays,
  clampDate,
  completionStats,
  daysBetween,
  getLoggedDates,
  getTrackingDates,
  isIsoDate,
  normalizeBoundedNumber,
  normalizePrivacySettings,
  normalizeSettings,
  normalizeText,
  todayIso,
  trackingLength,
} from './tracker'
import type {
  BuiltInRuleKey,
  ChallengeScoreSnapshot,
  ChallengeSettings,
  ChallengeSummary,
  EntryMap,
  FriendChallenge,
  FriendChallengeParticipant,
  FriendChallengeParticipantStatus,
  FriendChallengeScoringMode,
  FriendEvent,
  FriendEventComment,
  FriendEventReaction,
  FriendEventType,
  FriendProfile,
  FriendSquad,
  FriendSquadMember,
  FriendshipRow,
  FriendshipStatus,
  PrivacySettings,
  RuleKey,
} from './types'

function currentStreak(entries: EntryMap, throughDate: string, settings: ChallengeSettings): number {
  let streak = 0
  let cursor = clampDate(throughDate, settings)

  while (cursor >= settings.startDate) {
    const entry = entries[cursor]
    if (!entry || completionStats(entry, settings).percent < 100) break
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function longestStreak(entries: EntryMap, settings: ChallengeSettings): number {
  let longest = 0
  let running = 0

  for (const date of getTrackingDates(settings)) {
    const entry = entries[date]
    if (entry && completionStats(entry, settings).percent === 100) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }

  return longest
}

function leaderboardThroughDate(entries: EntryMap, settings: ChallengeSettings): string {
  const today = todayIso()
  if (today >= settings.startDate) return today

  const loggedDates = getLoggedDates(entries, settings)
  return loggedDates[loggedDates.length - 1] ?? settings.startDate
}

export function buildChallengeSummary(
  userId: string,
  entries: EntryMap,
  settings: ChallengeSettings,
  privacySettings = DEFAULT_PRIVACY_SETTINGS,
): ChallengeSummary {
  const privacy = normalizePrivacySettings(privacySettings)
  const loggedDates = getLoggedDates(entries, settings)
  const throughDate = leaderboardThroughDate(entries, settings)
  const weekStart = addDays(throughDate, -6) < settings.startDate ? settings.startDate : addDays(throughDate, -6)
  const weekDates = loggedDates.filter((date) => date >= weekStart && date <= throughDate)
  const averageCompletion = loggedDates.length === 0
    ? 0
    : Math.round(loggedDates.reduce((sum, date) => sum + completionStats(entries[date], settings).percent, 0) / loggedDates.length)
  const weeklyCompletion = weekDates.length === 0
    ? 0
    : Math.round(weekDates.reduce((sum, date) => sum + completionStats(entries[date], settings).percent, 0) / weekDates.length)

  return {
    userId,
    challengeTitle: settings.title,
    startDate: settings.startDate,
    endDate: throughDate,
    loggedDays: privacy.showLoggedDays ? loggedDates.length : 0,
    totalDays: trackingLength(settings, throughDate),
    averageCompletion: privacy.showAverageCompletion ? averageCompletion : 0,
    weeklyCompletion: privacy.showWeeklyCompletion ? weeklyCompletion : 0,
    currentStreak: privacy.showStreak ? currentStreak(entries, throughDate, settings) : 0,
    longestStreak: privacy.showStreak ? longestStreak(entries, settings) : 0,
    lastLoggedDate: privacy.showLoggedDays ? loggedDates[loggedDates.length - 1] ?? null : null,
    updatedAt: new Date().toISOString(),
    privacy,
  }
}

function getChallengeElapsedDates(challenge: Pick<FriendChallenge, 'startDate' | 'endDate'>): string[] {
  const today = todayIso()
  if (today < challenge.startDate) return []
  const throughDate = today > challenge.endDate ? challenge.endDate : today
  if (throughDate < challenge.startDate) return []
  return Array.from({ length: daysBetween(challenge.startDate, throughDate) + 1 }, (_, index) => addDays(challenge.startDate, index))
}

function settingsForFriendChallenge(challenge: FriendChallenge, personalSettings: ChallengeSettings): ChallengeSettings {
  const selectedRuleKeys = new Set(challenge.settings.rules.filter((rule) => rule.enabled && !rule.deleted).map((rule) => rule.key))
  const sourceSettings = challenge.scoringMode === 'shared'
    ? challenge.settings
    : {
      ...personalSettings,
      rules: personalSettings.rules.map((rule) => ({ ...rule, enabled: selectedRuleKeys.has(rule.key) })),
    }
  return normalizeSettings({
    ...sourceSettings,
    title: challenge.name,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
  })
}

function streakForChallengeDates(dates: string[], entries: EntryMap, settings: ChallengeSettings) {
  let current = 0
  for (let index = dates.length - 1; index >= 0; index -= 1) {
    const entry = entries[dates[index]]
    if (!entry || completionStats(entry, settings).percent < 100) break
    current += 1
  }

  let running = 0
  let longest = 0
  for (const date of dates) {
    const entry = entries[date]
    if (entry && completionStats(entry, settings).percent === 100) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }

  return { current, longest }
}

export function buildFriendChallengeSummary(
  userId: string,
  entries: EntryMap,
  challenge: FriendChallenge,
  personalSettings: ChallengeSettings,
  privacySettings = DEFAULT_PRIVACY_SETTINGS,
): ChallengeSummary {
  const privacy = normalizePrivacySettings(privacySettings)
  const challengeSettings = settingsForFriendChallenge(challenge, personalSettings)
  const elapsedDates = getChallengeElapsedDates(challenge)
  const loggedDates = elapsedDates.filter((date) => Boolean(entries[date]))
  const weekStart = elapsedDates.length === 0 ? challenge.startDate : addDays(elapsedDates[elapsedDates.length - 1], -6)
  const weekDates = loggedDates.filter((date) => date >= weekStart)
  const averageCompletion = loggedDates.length === 0
    ? 0
    : Math.round(loggedDates.reduce((sum, date) => sum + completionStats(entries[date], challengeSettings).percent, 0) / loggedDates.length)
  const weeklyCompletion = weekDates.length === 0
    ? 0
    : Math.round(weekDates.reduce((sum, date) => sum + completionStats(entries[date], challengeSettings).percent, 0) / weekDates.length)
  const streaks = streakForChallengeDates(elapsedDates, entries, challengeSettings)

  return {
    userId,
    challengeTitle: challenge.name,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    loggedDays: privacy.showLoggedDays ? loggedDates.length : 0,
    totalDays: elapsedDates.length,
    averageCompletion: privacy.showAverageCompletion ? averageCompletion : 0,
    weeklyCompletion: privacy.showWeeklyCompletion ? weeklyCompletion : 0,
    currentStreak: privacy.showStreak ? streaks.current : 0,
    longestStreak: privacy.showStreak ? streaks.longest : 0,
    lastLoggedDate: privacy.showLoggedDays ? loggedDates[loggedDates.length - 1] ?? null : null,
    updatedAt: new Date().toISOString(),
    privacy,
  }
}

export function buildFriendChallengeSnapshots(
  userId: string,
  entries: EntryMap,
  challenge: FriendChallenge,
  personalSettings: ChallengeSettings,
): ChallengeScoreSnapshot[] {
  const settings = settingsForFriendChallenge(challenge, personalSettings)
  const publishedAt = new Date().toISOString()
  return getChallengeElapsedDates(challenge)
    .filter((date) => Boolean(entries[date]))
    .map((date) => {
      const stats = completionStats(entries[date], settings)
      return {
        challengeId: challenge.id,
        userId,
        date,
        completionPercent: stats.percent,
        completedRules: stats.completed,
        totalRules: stats.total,
        publishedAt,
      }
    })
}

export function buildChallengeSettingsForTemplate(
  baseSettings: ChallengeSettings,
  templateId: string | undefined,
  title: string,
  startDate: string,
  endDate: string,
  selectedRuleKeys?: RuleKey[],
): ChallengeSettings {
  const template = challengeTemplateById(templateId)
  const targets = { ...baseSettings.targets, ...(template.targetOverrides ?? {}) }
  const selectedRules = selectedRuleKeys ? new Set(selectedRuleKeys) : null
  const rules = baseSettings.rules.map((rule) => {
    const builtInKey = BUILT_IN_RULE_KEYS.includes(rule.key as BuiltInRuleKey) ? rule.key as BuiltInRuleKey : null
    const override = builtInKey ? template.ruleOverrides?.[builtInKey] : undefined
    const nextRule = override ? { ...rule, ...override } : { ...rule }
    if (rule.key === 'exercise' && rule.exercise && template.targetOverrides?.exerciseMinutes !== undefined) {
      nextRule.exercise = { ...rule.exercise, targetMinutes: template.targetOverrides.exerciseMinutes }
    }
    if (rule.diet) {
      if (rule.key === 'calories' && template.targetOverrides?.calories !== undefined) {
        nextRule.diet = { ...rule.diet, goal: template.targetOverrides.calories }
      }
      if (rule.key === 'protein' && template.targetOverrides?.proteinGrams !== undefined) {
        nextRule.diet = { ...rule.diet, goal: template.targetOverrides.proteinGrams }
      }
      if (rule.key === 'water' && template.targetOverrides?.waterLiters !== undefined) {
        nextRule.diet = { ...rule.diet, goal: template.targetOverrides.waterLiters }
      }
    }
    return selectedRules ? { ...nextRule, enabled: selectedRules.has(rule.key) } : nextRule
  })

  return normalizeSettings({ ...baseSettings, title, startDate, endDate, targets, rules })
}

export function mergeChallengeRulesIntoSettings(
  personalSettings: ChallengeSettings,
  challengeSettings: ChallengeSettings,
): ChallengeSettings {
  const selectedRules = challengeSettings.rules.filter((rule) => rule.enabled && !rule.deleted)
  const selectedByKey = new Map(selectedRules.map((rule) => [rule.key, rule]))
  const personalRuleKeys = new Set(personalSettings.rules.map((rule) => rule.key))
  const rules = personalSettings.rules.map((rule) => (
    selectedByKey.has(rule.key) && !rule.enabled ? { ...rule, enabled: true, deleted: false } : rule
  ))
  for (const rule of selectedRules) {
    if (!personalRuleKeys.has(rule.key)) rules.push({ ...rule, enabled: true, deleted: false })
  }

  const categoryKeys = new Set(personalSettings.categories.map((category) => category.key))
  const categories = [...personalSettings.categories]
  for (const category of challengeSettings.categories) {
    if (!categoryKeys.has(category.key) && selectedRules.some((rule) => rule.category === category.key)) {
      categories.push(category)
      categoryKeys.add(category.key)
    }
  }

  return normalizeSettings({ ...personalSettings, categories, rules })
}

export function generateInviteCode(userId: string): string {
  return `GM-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export function sortedFriendshipPair(userId: string, friendId: string): [string, string] {
  return [userId, friendId].sort() as [string, string]
}

export function defaultDisplayName(user: User): string {
  return user.email?.split('@')[0] || 'New challenger'
}

export function normalizeFriendProfileRow(row: unknown): FriendProfile | null {
  const candidate = row && typeof row === 'object'
    ? row as { user_id?: unknown; display_name?: unknown; invite_code?: unknown }
    : null
  if (!candidate || typeof candidate.user_id !== 'string') return null

  return {
    userId: candidate.user_id,
    displayName: typeof candidate.display_name === 'string' && candidate.display_name.trim()
      ? candidate.display_name.trim()
      : 'Challenger',
    inviteCode: typeof candidate.invite_code === 'string' ? candidate.invite_code : '',
  }
}

function normalizeFriendshipStatus(value: unknown): FriendshipStatus {
  return value === 'pending' || value === 'accepted' || value === 'declined' ? value : 'accepted'
}

function normalizeFriendChallengeParticipantStatus(value: unknown): FriendChallengeParticipantStatus {
  return value === 'pending' || value === 'accepted' || value === 'declined' ? value : 'pending'
}

function normalizeFriendChallengeScoringMode(value: unknown): FriendChallengeScoringMode {
  return value === 'shared' || value === 'personal' ? value : 'personal'
}

function normalizeFriendEventType(value: unknown): FriendEventType {
  switch (value) {
    case 'friend_request_sent':
    case 'friend_request_accepted':
    case 'friend_request_declined':
    case 'squad_created':
    case 'squad_updated':
    case 'squad_deleted':
    case 'challenge_created':
    case 'challenge_invites_sent':
    case 'challenge_invite_accepted':
    case 'challenge_invite_declined':
    case 'challenge_score_published':
    case 'leaderboard_score_published':
      return value
    default:
      return 'leaderboard_score_published'
  }
}

export function normalizeFriendshipRow(row: unknown): FriendshipRow | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate || typeof candidate.user_a !== 'string' || typeof candidate.user_b !== 'string') return null

  const createdBy = typeof candidate.created_by === 'string' ? candidate.created_by : candidate.user_a
  const requestedBy = typeof candidate.requested_by === 'string' ? candidate.requested_by : createdBy
  return {
    userA: candidate.user_a,
    userB: candidate.user_b,
    createdBy,
    requestedBy,
    status: normalizeFriendshipStatus(candidate.status),
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    respondedAt: typeof candidate.responded_at === 'string' ? candidate.responded_at : null,
  }
}

function schemaErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  return 'message' in error && typeof error.message === 'string' ? error.message : ''
}

export function isFriendRequestSchemaError(error: unknown): boolean {
  const message = schemaErrorMessage(error)
  return message.includes('status') || message.includes('requested_by') || message.includes('responded_at') || message.includes('column')
}

export function isFriendChallengeSchemaError(error: unknown): boolean {
  const message = schemaErrorMessage(error)
  return message.includes('god_mode_friend_challenges')
    || message.includes('god_mode_friend_challenge_participants')
    || message.includes('scoring_mode')
    || message.includes('summary')
    || message.includes('relation')
    || message.includes('column')
}

export function isChallengeScoreHistorySchemaError(error: unknown): boolean {
  const message = schemaErrorMessage(error)
  return message.includes('god_mode_challenge_score_history')
    || message.includes('score_date')
    || message.includes('completion_percent')
}

export function isFriendSquadSchemaError(error: unknown): boolean {
  const message = schemaErrorMessage(error)
  return message.includes('god_mode_squads') || message.includes('god_mode_squad_members') || message.includes('relation') || message.includes('column')
}

export function isFriendEventSchemaError(error: unknown): boolean {
  const message = schemaErrorMessage(error)
  return message.includes('god_mode_friend_event') || message.includes('event_type') || message.includes('metadata') || message.includes('reaction') || message.includes('relation') || message.includes('column')
}

export function isSummarySchemaError(error: unknown): boolean {
  const message = schemaErrorMessage(error)
  return message.includes('god_mode_challenge_summaries') || message.includes('privacy') || message.includes('column')
}

export function normalizeSummaryRow(row: unknown): ChallengeSummary | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  const userId = typeof candidate?.user_id === 'string'
    ? candidate.user_id
    : typeof candidate?.userId === 'string' ? candidate.userId : null
  if (!candidate || !userId) return null

  return {
    userId,
    challengeTitle: normalizeText(candidate.challenge_title ?? candidate.challengeTitle) || DEFAULT_SETTINGS.title,
    startDate: isIsoDate(candidate.start_date) ? candidate.start_date : isIsoDate(candidate.startDate) ? candidate.startDate : DEFAULT_SETTINGS.startDate,
    endDate: isIsoDate(candidate.end_date) ? candidate.end_date : isIsoDate(candidate.endDate) ? candidate.endDate : DEFAULT_SETTINGS.endDate,
    loggedDays: normalizeBoundedNumber(candidate.logged_days ?? candidate.loggedDays, 0, 0, MAX_TRACKING_DAYS),
    totalDays: normalizeBoundedNumber(candidate.total_days ?? candidate.totalDays, 0, 0, MAX_TRACKING_DAYS),
    averageCompletion: normalizeBoundedNumber(candidate.average_completion ?? candidate.averageCompletion, 0, 0, 100),
    weeklyCompletion: normalizeBoundedNumber(candidate.weekly_completion ?? candidate.weeklyCompletion, 0, 0, 100),
    currentStreak: normalizeBoundedNumber(candidate.current_streak ?? candidate.currentStreak, 0, 0, MAX_TRACKING_DAYS),
    longestStreak: normalizeBoundedNumber(candidate.longest_streak ?? candidate.longestStreak, 0, 0, MAX_TRACKING_DAYS),
    lastLoggedDate: isIsoDate(candidate.last_logged_date) ? candidate.last_logged_date : isIsoDate(candidate.lastLoggedDate) ? candidate.lastLoggedDate : null,
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
    privacy: normalizePrivacySettings(candidate.privacy),
    note: normalizeText(candidate.note).slice(0, 180),
    reaction: normalizeScoreReaction(candidate.reaction),
  }
}

export function normalizeFriendChallengeRow(row: unknown): FriendChallenge | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.creator_id !== 'string') return null

  const startDate = isIsoDate(candidate.start_date) ? candidate.start_date : todayIso()
  const endDate = isIsoDate(candidate.end_date) && candidate.end_date >= startDate ? candidate.end_date : addDays(startDate, 6)
  return {
    id: candidate.id,
    creatorId: candidate.creator_id,
    name: normalizeText(candidate.name).trim() || 'Friend Challenge',
    startDate,
    endDate,
    scoringMode: normalizeFriendChallengeScoringMode(candidate.scoring_mode),
    settings: normalizeSettings(candidate.settings),
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : new Date().toISOString(),
  }
}

export function normalizeFriendChallengeParticipantRow(row: unknown): FriendChallengeParticipant | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate || typeof candidate.challenge_id !== 'string' || typeof candidate.user_id !== 'string') return null
  return {
    challengeId: candidate.challenge_id,
    userId: candidate.user_id,
    invitedBy: typeof candidate.invited_by === 'string' ? candidate.invited_by : candidate.user_id,
    status: normalizeFriendChallengeParticipantStatus(candidate.status),
    summary: normalizeSummaryRow(candidate.summary),
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    respondedAt: typeof candidate.responded_at === 'string' ? candidate.responded_at : null,
  }
}

export function normalizeChallengeScoreSnapshotRow(row: unknown): ChallengeScoreSnapshot | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate
    || typeof candidate.challenge_id !== 'string'
    || typeof candidate.user_id !== 'string'
    || !isIsoDate(candidate.score_date)) return null

  const totalRules = normalizeBoundedNumber(candidate.total_rules, 0, 0, 100)
  const completedRules = Math.min(totalRules, normalizeBoundedNumber(candidate.completed_rules, 0, 0, 100))
  return {
    challengeId: candidate.challenge_id,
    userId: candidate.user_id,
    date: candidate.score_date,
    completionPercent: normalizeBoundedNumber(candidate.completion_percent, 0, 0, 100),
    completedRules,
    totalRules,
    publishedAt: typeof candidate.published_at === 'string' ? candidate.published_at : new Date().toISOString(),
  }
}

export function normalizeFriendSquadRow(row: unknown): FriendSquad | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.owner_id !== 'string') return null
  return {
    id: candidate.id,
    ownerId: candidate.owner_id,
    name: normalizeText(candidate.name).trim() || 'Challenge Squad',
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : new Date().toISOString(),
  }
}

export function normalizeFriendSquadMemberRow(row: unknown): FriendSquadMember | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate || typeof candidate.squad_id !== 'string' || typeof candidate.user_id !== 'string') return null
  return {
    squadId: candidate.squad_id,
    userId: candidate.user_id,
    addedBy: typeof candidate.added_by === 'string' ? candidate.added_by : candidate.user_id,
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
  }
}

export function normalizeFriendEventRow(row: unknown): FriendEvent | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.actor_id !== 'string') return null
  const metadata = candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata)
    ? candidate.metadata as Record<string, unknown>
    : {}
  return {
    id: candidate.id,
    actorId: candidate.actor_id,
    targetUserId: typeof candidate.target_user_id === 'string' ? candidate.target_user_id : null,
    challengeId: typeof candidate.challenge_id === 'string' ? candidate.challenge_id : null,
    squadId: typeof candidate.squad_id === 'string' ? candidate.squad_id : null,
    eventType: normalizeFriendEventType(candidate.event_type),
    metadata,
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    comments: [],
    reactions: [],
  }
}

export function normalizeFriendEventCommentRow(row: unknown): FriendEventComment | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  if (!candidate || typeof candidate.id !== 'string' || typeof candidate.event_id !== 'string' || typeof candidate.user_id !== 'string') return null
  const body = normalizeText(candidate.body).trim().slice(0, 400)
  if (!body) return null
  return {
    id: candidate.id,
    eventId: candidate.event_id,
    userId: candidate.user_id,
    body,
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
    updatedAt: typeof candidate.updated_at === 'string' ? candidate.updated_at : new Date().toISOString(),
  }
}

export function normalizeFriendEventReactionRow(row: unknown): FriendEventReaction | null {
  const candidate = row && typeof row === 'object' ? row as Record<string, unknown> : null
  const reaction = normalizeFriendFeedReaction(candidate?.reaction)
  if (!candidate || typeof candidate.event_id !== 'string' || typeof candidate.user_id !== 'string' || !reaction) return null
  return {
    eventId: candidate.event_id,
    userId: candidate.user_id,
    reaction,
    createdAt: typeof candidate.created_at === 'string' ? candidate.created_at : new Date().toISOString(),
  }
}
