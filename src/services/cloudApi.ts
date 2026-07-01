import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  isChallengeScoreHistorySchemaError,
  isFriendChallengeSchemaError,
  isFriendEventSchemaError,
  isFriendSquadSchemaError,
  normalizeFriendChallengeParticipantRow,
  normalizeFriendChallengeRow,
  normalizeChallengeScoreSnapshotRow,
  normalizeFriendEventRow,
  normalizeFriendEventCommentRow,
  normalizeFriendEventReactionRow,
  normalizeFriendProfileRow,
  normalizeFriendSquadMemberRow,
  normalizeFriendSquadRow,
  normalizeFriendshipRow,
  normalizeSummaryRow,
} from '../socialData'
import {
  SUPABASE_CHALLENGE_SCORE_HISTORY_TABLE,
  SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE,
  SUPABASE_FRIEND_CHALLENGE_TABLE,
  SUPABASE_FRIEND_EVENT_TABLE,
  SUPABASE_FRIEND_EVENT_COMMENT_TABLE,
  SUPABASE_FRIEND_EVENT_REACTION_TABLE,
  SUPABASE_FRIENDSHIP_TABLE,
  SUPABASE_PROFILE_TABLE,
  SUPABASE_SQUAD_MEMBER_TABLE,
  SUPABASE_SQUAD_TABLE,
  SUPABASE_SUMMARY_TABLE,
  SUPABASE_TABLE,
} from '../supabase'
import { normalizeCloudSnapshot, normalizeEntries, normalizeSettings } from '../tracker'
import type {
  AccountDataExport,
  ChallengeScoreSnapshot,
  ChallengeSettings,
  CloudSnapshot,
  EntryMap,
  FriendChallenge,
  FriendChallengeParticipant,
  FriendEvent,
  FriendEventComment,
  FriendEventReaction,
  FriendProfile,
  FriendSquad,
  FriendSquadMember,
  FriendshipRow,
  PrivacySettings,
} from '../types'

export async function fetchCloudSnapshot(client: SupabaseClient, userId: string): Promise<CloudSnapshot | null> {
  const { data, error } = await client.from(SUPABASE_TABLE)
    .select('settings, entries, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return normalizeCloudSnapshot(data)
}

export async function writeCloudSnapshot(
  client: SupabaseClient,
  userId: string,
  settings: ChallengeSettings,
  entries: EntryMap,
): Promise<string> {
  const updatedAt = new Date().toISOString()
  const { error } = await client.from(SUPABASE_TABLE).upsert({
    user_id: userId,
    settings: normalizeSettings(settings),
    entries: normalizeEntries(entries),
    updated_at: updatedAt,
  }, { onConflict: 'user_id' })
  if (error) throw error
  return updatedAt
}

export async function buildAccountDataExport(
  client: SupabaseClient,
  user: User,
  local: { settings: ChallengeSettings; entries: EntryMap; privacy: PrivacySettings },
): Promise<AccountDataExport> {
  const [snapshotResult, profileResult, friendshipResult, summaryResult] = await Promise.all([
    client.from(SUPABASE_TABLE).select('settings, entries, updated_at').eq('user_id', user.id).maybeSingle(),
    client.from(SUPABASE_PROFILE_TABLE).select('user_id, display_name, invite_code').eq('user_id', user.id).maybeSingle(),
    client.from(SUPABASE_FRIENDSHIP_TABLE)
      .select('user_a, user_b, created_by, requested_by, status, created_at, responded_at')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    client.from(SUPABASE_SUMMARY_TABLE).select('*').eq('user_id', user.id).maybeSingle(),
  ])

  for (const result of [snapshotResult, profileResult, friendshipResult, summaryResult]) {
    if (result.error) throw result.error
  }

  const challengeData = await loadChallengeExportData(client, user.id)
  const squadData = await loadSquadExportData(client, user.id)
  const eventData = await loadEventExportData(client, user.id)
  const friendProfiles = await loadProfileExportData(client, collectVisibleProfileIds({
    userId: user.id,
    friendships: (friendshipResult.data ?? [])
      .map(normalizeFriendshipRow)
      .filter((row): row is FriendshipRow => row !== null),
    challenges: challengeData.challenges,
    participants: challengeData.participants,
    squads: squadData.squads,
    squadMembers: squadData.members,
    events: eventData.events,
    comments: eventData.comments,
    reactions: eventData.reactions,
  }))

  return {
    app: 'god-mode-july',
    exportType: 'account-data',
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email ?? null },
    local,
    cloud: {
      snapshot: normalizeCloudSnapshot(snapshotResult.data),
      profile: normalizeFriendProfileRow(profileResult.data),
      friendProfiles,
      friendships: (friendshipResult.data ?? [])
        .map(normalizeFriendshipRow)
        .filter((row): row is FriendshipRow => row !== null),
      summary: normalizeSummaryRow(summaryResult.data),
      friendChallenges: challengeData.challenges,
      friendChallengeParticipants: challengeData.participants,
      challengeScoreSnapshots: challengeData.history,
      friendSquads: squadData.squads,
      friendSquadMembers: squadData.members,
      friendEvents: eventData.events,
      friendEventComments: eventData.comments,
      friendEventReactions: eventData.reactions,
    },
  }
}

function collectVisibleProfileIds({
  userId,
  friendships,
  challenges,
  participants,
  squads,
  squadMembers,
  events,
  comments,
  reactions,
}: {
  userId: string
  friendships: FriendshipRow[]
  challenges: FriendChallenge[]
  participants: FriendChallengeParticipant[]
  squads: FriendSquad[]
  squadMembers: FriendSquadMember[]
  events: FriendEvent[]
  comments: FriendEventComment[]
  reactions: FriendEventReaction[]
}): string[] {
  const ids = new Set<string>([userId])
  for (const friendship of friendships) {
    ids.add(friendship.userA)
    ids.add(friendship.userB)
    ids.add(friendship.createdBy)
    ids.add(friendship.requestedBy)
  }
  for (const challenge of challenges) ids.add(challenge.creatorId)
  for (const participant of participants) {
    ids.add(participant.userId)
    ids.add(participant.invitedBy)
  }
  for (const squad of squads) ids.add(squad.ownerId)
  for (const member of squadMembers) {
    ids.add(member.userId)
    ids.add(member.addedBy)
  }
  for (const event of events) {
    ids.add(event.actorId)
    if (event.targetUserId) ids.add(event.targetUserId)
  }
  for (const comment of comments) ids.add(comment.userId)
  for (const reaction of reactions) ids.add(reaction.userId)
  return Array.from(ids)
}

async function loadProfileExportData(client: SupabaseClient, userIds: string[]): Promise<FriendProfile[]> {
  if (userIds.length === 0) return []
  const { data, error } = await client.from(SUPABASE_PROFILE_TABLE)
    .select('user_id, display_name, invite_code')
    .in('user_id', userIds)
  if (error) throw error
  return (data ?? []).map(normalizeFriendProfileRow).filter((row): row is FriendProfile => row !== null)
}

async function loadChallengeExportData(client: SupabaseClient, userId: string) {
  const [mineResult, createdResult] = await Promise.all([
    client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
      .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
      .eq('user_id', userId),
    client.from(SUPABASE_FRIEND_CHALLENGE_TABLE)
      .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
      .eq('creator_id', userId),
  ])
  if (mineResult.error || createdResult.error) {
    const error = mineResult.error ?? createdResult.error
    if (isFriendChallengeSchemaError(error)) return { challenges: [], participants: [], history: [] }
    throw error
  }

  const mine = (mineResult.data ?? [])
    .map(normalizeFriendChallengeParticipantRow)
    .filter((row): row is FriendChallengeParticipant => row !== null)
  const created = (createdResult.data ?? [])
    .map(normalizeFriendChallengeRow)
    .filter((row): row is FriendChallenge => row !== null)
  const challengeIds = Array.from(new Set([...mine.map((row) => row.challengeId), ...created.map((row) => row.id)]))
  if (challengeIds.length === 0) return { challenges: [], participants: [], history: [] }

  const [challengeResult, participantResult, historyResult] = await Promise.all([
    client.from(SUPABASE_FRIEND_CHALLENGE_TABLE)
      .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
      .in('id', challengeIds),
    client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
      .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
      .in('challenge_id', challengeIds),
    client.from(SUPABASE_CHALLENGE_SCORE_HISTORY_TABLE)
      .select('challenge_id, user_id, score_date, completion_percent, completed_rules, total_rules, published_at')
      .in('challenge_id', challengeIds),
  ])
  if (challengeResult.error && !isFriendChallengeSchemaError(challengeResult.error)) throw challengeResult.error
  if (participantResult.error && !isFriendChallengeSchemaError(participantResult.error)) throw participantResult.error
  if (historyResult.error && !isChallengeScoreHistorySchemaError(historyResult.error)) throw historyResult.error
  return {
    challenges: (challengeResult.data ?? []).map(normalizeFriendChallengeRow).filter((row): row is FriendChallenge => row !== null),
    participants: (participantResult.data ?? [])
      .map(normalizeFriendChallengeParticipantRow)
      .filter((row): row is FriendChallengeParticipant => row !== null),
    history: (historyResult.data ?? [])
      .map(normalizeChallengeScoreSnapshotRow)
      .filter((row): row is ChallengeScoreSnapshot => row !== null),
  }
}

async function loadSquadExportData(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from(SUPABASE_SQUAD_TABLE)
    .select('id, owner_id, name, created_at, updated_at')
    .eq('owner_id', userId)
  if (error) {
    if (isFriendSquadSchemaError(error)) return { squads: [], members: [] }
    throw error
  }
  const squads = (data ?? []).map(normalizeFriendSquadRow).filter((row): row is FriendSquad => row !== null)
  if (squads.length === 0) return { squads, members: [] }
  const memberResult = await client.from(SUPABASE_SQUAD_MEMBER_TABLE)
    .select('squad_id, user_id, added_by, created_at')
    .in('squad_id', squads.map((squad) => squad.id))
  if (memberResult.error) {
    if (isFriendSquadSchemaError(memberResult.error)) return { squads, members: [] }
    throw memberResult.error
  }
  return {
    squads,
    members: (memberResult.data ?? [])
      .map(normalizeFriendSquadMemberRow)
      .filter((row): row is FriendSquadMember => row !== null),
  }
}

async function loadEventExportData(client: SupabaseClient, userId: string): Promise<{
  events: FriendEvent[]
  comments: FriendEventComment[]
  reactions: FriendEventReaction[]
}> {
  const [eventResult, commentResult, reactionResult] = await Promise.all([
    client.from(SUPABASE_FRIEND_EVENT_TABLE)
      .select('id, actor_id, target_user_id, challenge_id, squad_id, event_type, metadata, created_at')
      .or(`actor_id.eq.${userId},target_user_id.eq.${userId}`),
    client.from(SUPABASE_FRIEND_EVENT_COMMENT_TABLE)
      .select('id, event_id, user_id, body, created_at, updated_at')
      .eq('user_id', userId),
    client.from(SUPABASE_FRIEND_EVENT_REACTION_TABLE)
      .select('event_id, user_id, reaction, created_at')
      .eq('user_id', userId),
  ])
  if (eventResult.error) {
    if (isFriendEventSchemaError(eventResult.error)) return { events: [], comments: [], reactions: [] }
    throw eventResult.error
  }
  for (const interactionError of [commentResult.error, reactionResult.error]) {
    if (interactionError && !isFriendEventSchemaError(interactionError)) throw interactionError
  }
  return {
    events: (eventResult.data ?? []).map(normalizeFriendEventRow).filter((row): row is FriendEvent => row !== null),
    comments: (commentResult.error ? [] : commentResult.data ?? [])
      .map(normalizeFriendEventCommentRow)
      .filter((row): row is FriendEventComment => row !== null),
    reactions: (reactionResult.error ? [] : reactionResult.data ?? [])
      .map(normalizeFriendEventReactionRow)
      .filter((row): row is FriendEventReaction => row !== null),
  }
}

export async function deleteCloudAccountData(client: SupabaseClient, userId: string): Promise<void> {
  const deletions = [
    { query: client.from(SUPABASE_FRIEND_EVENT_COMMENT_TABLE).delete().eq('user_id', userId), optional: isFriendEventSchemaError },
    { query: client.from(SUPABASE_FRIEND_EVENT_REACTION_TABLE).delete().eq('user_id', userId), optional: isFriendEventSchemaError },
    { query: client.from(SUPABASE_FRIEND_EVENT_TABLE).delete().or(`actor_id.eq.${userId},target_user_id.eq.${userId}`), optional: isFriendEventSchemaError },
    { query: client.from(SUPABASE_CHALLENGE_SCORE_HISTORY_TABLE).delete().eq('user_id', userId), optional: isChallengeScoreHistorySchemaError },
    { query: client.from(SUPABASE_FRIEND_CHALLENGE_TABLE).delete().eq('creator_id', userId), optional: isFriendChallengeSchemaError },
    { query: client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE).delete().eq('user_id', userId), optional: isFriendChallengeSchemaError },
    { query: client.from(SUPABASE_SQUAD_TABLE).delete().eq('owner_id', userId), optional: isFriendSquadSchemaError },
    { query: client.from(SUPABASE_SQUAD_MEMBER_TABLE).delete().eq('user_id', userId), optional: isFriendSquadSchemaError },
  ]
  for (const deletion of deletions) {
    const { error } = await deletion.query
    if (error && !deletion.optional(error)) throw error
  }

  for (const query of [
    client.from(SUPABASE_FRIENDSHIP_TABLE).delete().or(`user_a.eq.${userId},user_b.eq.${userId}`),
    client.from(SUPABASE_SUMMARY_TABLE).delete().eq('user_id', userId),
    client.from(SUPABASE_PROFILE_TABLE).delete().eq('user_id', userId),
    client.from(SUPABASE_TABLE).delete().eq('user_id', userId),
  ]) {
    const { error } = await query
    if (error) throw error
  }
}
