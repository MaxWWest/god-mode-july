import type { AccountDataExport, ChallengeSummary } from './types'
import { completionStats, selectableEndDate } from './tracker'

type StructuredCsvValue = string | number | boolean | null | undefined

function csvCell(value: StructuredCsvValue): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function formatMealLabel(meal: string): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1)
}

function metadataString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function appendMetricRow(
  rows: StructuredCsvValue[][],
  base: StructuredCsvValue[],
  metric: string,
  value: StructuredCsvValue,
  unit = '',
  details: StructuredCsvValue = '',
) {
  rows.push([...base, metric, value, unit, details])
}

function appendSummaryRows(
  rows: StructuredCsvValue[][],
  base: StructuredCsvValue[],
  summary: ChallengeSummary | null | undefined,
) {
  if (!summary) return
  appendMetricRow(rows, base, 'weekly_completion_percent', summary.weeklyCompletion, '%')
  appendMetricRow(rows, base, 'average_completion_percent', summary.averageCompletion, '%')
  appendMetricRow(rows, base, 'current_streak_days', summary.currentStreak, 'days')
  appendMetricRow(rows, base, 'longest_streak_days', summary.longestStreak, 'days')
  appendMetricRow(rows, base, 'logged_days', summary.loggedDays, 'days', `${summary.loggedDays}/${summary.totalDays}`)
}

export function accountDataToStructuredCsv(payload: AccountDataExport): string {
  const headers = [
    'row_type',
    'date',
    'user_id',
    'user_email',
    'display_name',
    'challenge_id',
    'challenge_name',
    'squad_id',
    'squad_name',
    'status',
    'created_at',
    'updated_at',
    'metric',
    'value',
    'unit',
    'details',
  ]
  const rows: StructuredCsvValue[][] = []
  const profileByUserId = new Map((payload.cloud.friendProfiles ?? []).map((profile) => [profile.userId, profile.displayName]))
  if (payload.cloud.profile) profileByUserId.set(payload.cloud.profile.userId, payload.cloud.profile.displayName)
  const displayName = (userId: string | null | undefined) => userId ? profileByUserId.get(userId) ?? userId : ''
  const challengeById = new Map(payload.cloud.friendChallenges.map((challenge) => [challenge.id, challenge]))
  const squadById = new Map(payload.cloud.friendSquads.map((squad) => [squad.id, squad]))
  const currentUserBase = (rowType: string, date = '', createdAt = '', updatedAt = ''): StructuredCsvValue[] => [
    rowType,
    date,
    payload.user.id,
    payload.user.email,
    displayName(payload.user.id),
    '',
    '',
    '',
    '',
    '',
    createdAt,
    updatedAt,
  ]

  for (const date of Object.keys(payload.local.entries).sort()) {
    const entry = payload.local.entries[date]
    const inChallenge = date >= payload.local.settings.startDate && date <= selectableEndDate(payload.local.settings)
    const stats = inChallenge ? completionStats(entry, payload.local.settings) : null
    const base = currentUserBase('daily_completion', entry.date, '', entry.finalizedAt ?? '')
    appendMetricRow(rows, base, 'completion_percent', stats?.percent ?? '', '%', stats ? `${stats.completed}/${stats.total} rules` : '')
    appendMetricRow(rows, base, 'mood', entry.mood)
    appendMetricRow(rows, base, 'energy', entry.energy)
    appendMetricRow(rows, base, 'hunger', entry.hunger)
    appendMetricRow(rows, base, 'sleep_hours', entry.sleepHours, 'hours')
    appendMetricRow(rows, base, 'water_liters', entry.waterLiters, 'liters')
    appendMetricRow(rows, base, 'weight_pounds', entry.weightPounds, 'lb')
    appendMetricRow(rows, base, 'calories', entry.calories, 'kcal')
    appendMetricRow(rows, base, 'protein_grams', entry.proteinGrams, 'g')

    for (const workout of entry.workouts) {
      appendMetricRow(rows, currentUserBase('daily_workout', entry.date), 'workout_minutes', workout.minutes, 'minutes', workout.type)
    }

    for (const food of entry.foods) {
      const foodBase = currentUserBase('daily_food_macro', entry.date)
      const details = `${formatMealLabel(food.meal)}: ${food.name}${food.categories.length > 0 ? ` (${food.categories.join('|')})` : ''}`
      appendMetricRow(rows, foodBase, 'food_calories', food.calories, 'kcal', details)
      appendMetricRow(rows, foodBase, 'food_protein_grams', food.proteinGrams, 'g', details)
      appendMetricRow(rows, foodBase, 'food_carbs_grams', food.carbsGrams, 'g', details)
      appendMetricRow(rows, foodBase, 'food_fat_grams', food.fatGrams, 'g', details)
      appendMetricRow(rows, foodBase, 'food_sodium_mg', food.sodiumMg, 'mg', details)
    }
  }

  for (const friendship of payload.cloud.friendships) {
    const friendId = friendship.userA === payload.user.id ? friendship.userB : friendship.userA
    rows.push([
      'friendship',
      '',
      friendId,
      '',
      displayName(friendId),
      '',
      '',
      '',
      '',
      friendship.status,
      friendship.createdAt,
      friendship.respondedAt,
      'friendship_status',
      friendship.status,
      '',
      `requested_by=${displayName(friendship.requestedBy)}`,
    ])
  }

  appendSummaryRows(rows, currentUserBase('leaderboard_summary', payload.cloud.summary?.lastLoggedDate ?? '', '', payload.cloud.summary?.updatedAt ?? ''), payload.cloud.summary)

  for (const challenge of payload.cloud.friendChallenges) {
    rows.push([
      'challenge',
      challenge.startDate,
      challenge.creatorId,
      '',
      displayName(challenge.creatorId),
      challenge.id,
      challenge.name,
      '',
      '',
      challenge.scoringMode,
      challenge.createdAt,
      challenge.updatedAt,
      'duration_days',
      Math.round((new Date(`${challenge.endDate}T12:00:00`).getTime() - new Date(`${challenge.startDate}T12:00:00`).getTime()) / 86_400_000) + 1,
      'days',
      `${challenge.startDate} to ${challenge.endDate}`,
    ])
  }

  for (const participant of payload.cloud.friendChallengeParticipants) {
    const challenge = challengeById.get(participant.challengeId)
    const base: StructuredCsvValue[] = [
      'challenge_participant_summary',
      participant.summary?.lastLoggedDate ?? '',
      participant.userId,
      '',
      displayName(participant.userId),
      participant.challengeId,
      challenge?.name ?? participant.summary?.challengeTitle ?? '',
      '',
      '',
      participant.status,
      participant.createdAt,
      participant.respondedAt,
    ]
    appendMetricRow(rows, base, 'participant_status', participant.status, '', `invited_by=${displayName(participant.invitedBy)}`)
    appendSummaryRows(rows, base, participant.summary)
  }

  for (const snapshot of payload.cloud.challengeScoreSnapshots) {
    const challenge = challengeById.get(snapshot.challengeId)
    rows.push([
      'challenge_score',
      snapshot.date,
      snapshot.userId,
      '',
      displayName(snapshot.userId),
      snapshot.challengeId,
      challenge?.name ?? '',
      '',
      '',
      '',
      snapshot.publishedAt,
      snapshot.publishedAt,
      'completion_percent',
      snapshot.completionPercent,
      '%',
      `${snapshot.completedRules}/${snapshot.totalRules} rules`,
    ])
  }

  for (const member of payload.cloud.friendSquadMembers) {
    const squad = squadById.get(member.squadId)
    rows.push([
      'squad_member',
      '',
      member.userId,
      '',
      displayName(member.userId),
      '',
      '',
      member.squadId,
      squad?.name ?? '',
      'member',
      member.createdAt,
      squad?.updatedAt ?? member.createdAt,
      'squad_membership',
      1,
      '',
      `added_by=${displayName(member.addedBy)}`,
    ])
  }

  for (const event of payload.cloud.friendEvents) {
    const challenge = event.challengeId ? challengeById.get(event.challengeId) : null
    const squad = event.squadId ? squadById.get(event.squadId) : null
    rows.push([
      'friend_event',
      event.createdAt.slice(0, 10),
      event.actorId,
      '',
      displayName(event.actorId),
      event.challengeId,
      challenge?.name ?? '',
      event.squadId,
      squad?.name ?? '',
      event.eventType,
      event.createdAt,
      event.createdAt,
      event.eventType,
      1,
      '',
      metadataString(event.metadata),
    ])
  }

  for (const comment of payload.cloud.friendEventComments) {
    rows.push([
      'friend_event_comment',
      comment.createdAt.slice(0, 10),
      comment.userId,
      '',
      displayName(comment.userId),
      '',
      '',
      '',
      '',
      '',
      comment.createdAt,
      comment.updatedAt,
      'comment',
      1,
      '',
      `event_id=${comment.eventId}; body=${comment.body}`,
    ])
  }

  for (const reaction of payload.cloud.friendEventReactions) {
    rows.push([
      'friend_event_reaction',
      reaction.createdAt.slice(0, 10),
      reaction.userId,
      '',
      displayName(reaction.userId),
      '',
      '',
      '',
      '',
      reaction.reaction,
      reaction.createdAt,
      reaction.createdAt,
      'reaction',
      1,
      '',
      `event_id=${reaction.eventId}; reaction=${reaction.reaction}`,
    ])
  }

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
}
