import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  isFriendChallengeSchemaError,
  isFriendEventSchemaError,
  isFriendRequestSchemaError,
  isFriendSquadSchemaError,
  isSummarySchemaError,
  normalizeFriendChallengeParticipantRow,
  normalizeFriendChallengeRow,
  normalizeFriendEventRow,
  normalizeFriendProfileRow,
  normalizeFriendSquadMemberRow,
  normalizeFriendSquadRow,
  normalizeFriendshipRow,
  normalizeSummaryRow,
  defaultDisplayName,
  generateInviteCode,
  sortedFriendshipPair,
} from '../socialData'
import {
  SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE,
  SUPABASE_FRIEND_CHALLENGE_TABLE,
  SUPABASE_FRIEND_EVENT_TABLE,
  SUPABASE_FRIENDSHIP_TABLE,
  SUPABASE_PROFILE_TABLE,
  SUPABASE_SQUAD_MEMBER_TABLE,
  SUPABASE_SQUAD_TABLE,
  SUPABASE_SUMMARY_TABLE,
} from '../supabase'
import type {
  ChallengeSummary,
  ChallengeSettings,
  FriendChallenge,
  FriendChallengeScoringMode,
  FriendChallengeParticipant,
  FriendChallengeParticipantView,
  FriendChallengeView,
  FriendEvent,
  FriendEventType,
  FriendProfile,
  FriendRequest,
  FriendSquad,
  FriendSquadMember,
  FriendSquadView,
  FriendshipRow,
  LeaderboardRow,
} from '../types'

export type SocialDashboardData = {
  profile: FriendProfile
  leaderboardRows: LeaderboardRow[]
  requests: FriendRequest[]
  challenges: FriendChallengeView[]
  squads: FriendSquadView[]
  events: FriendEvent[]
  squadSchemaReady: boolean
  acceptedFriendCount: number
}

export type FriendEventInput = {
  targetUserId?: string | null
  challengeId?: string | null
  squadId?: string | null
  metadata?: Record<string, unknown>
}

export async function updateFriendProfile(client: SupabaseClient, userId: string, displayName: string): Promise<FriendProfile> {
  const { data, error } = await client.from(SUPABASE_PROFILE_TABLE)
    .update({ display_name: displayName })
    .eq('user_id', userId)
    .select('user_id, display_name, invite_code')
    .single()
  if (error) throw error
  const profile = normalizeFriendProfileRow(data)
  if (!profile) throw new Error('Could not save friend profile.')
  return profile
}

export async function recordFriendEvent(
  client: SupabaseClient,
  actorId: string,
  eventType: FriendEventType,
  input: FriendEventInput = {},
): Promise<void> {
  try {
    const { error } = await client.from(SUPABASE_FRIEND_EVENT_TABLE).insert({
      actor_id: actorId,
      target_user_id: input.targetUserId ?? null,
      challenge_id: input.challengeId ?? null,
      squad_id: input.squadId ?? null,
      event_type: eventType,
      metadata: input.metadata ?? {},
    })
    if (error && !isFriendEventSchemaError(error)) console.warn('Could not record friend event', error)
  } catch (error) {
    if (!isFriendEventSchemaError(error)) console.warn('Could not record friend event', error)
  }
}

export async function requestFriendByInviteCode(
  client: SupabaseClient,
  userId: string,
  inviteCode: string,
): Promise<{ profile: FriendProfile; incomingRequest: boolean }> {
  const { data: profileRow, error: profileError } = await client.from(SUPABASE_PROFILE_TABLE)
    .select('user_id, display_name, invite_code')
    .eq('invite_code', inviteCode)
    .maybeSingle()
  if (profileError) throw profileError
  const profile = normalizeFriendProfileRow(profileRow)
  if (!profile) throw new Error('No friend found with that invite code.')
  if (profile.userId === userId) throw new Error('That is your own invite code.')

  const [userA, userB] = sortedFriendshipPair(userId, profile.userId)
  const { data: friendshipRow, error: friendshipError } = await client.from(SUPABASE_FRIENDSHIP_TABLE)
    .select('user_a, user_b, created_by, requested_by, status, created_at, responded_at')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle()
  if (friendshipError) {
    if (isFriendRequestSchemaError(friendshipError)) throw new Error('Run the updated Supabase schema to enable friend requests.')
    throw friendshipError
  }

  const friendship = normalizeFriendshipRow(friendshipRow)
  if (friendship?.status === 'accepted') throw new Error(`${profile.displayName} is already on your leaderboard.`)
  if (friendship?.status === 'pending' && friendship.requestedBy === userId) {
    throw new Error(`You already sent ${profile.displayName} a request.`)
  }
  if (friendship?.status === 'pending') return { profile, incomingRequest: true }

  const nextRequest = {
    user_a: userA,
    user_b: userB,
    created_by: userId,
    requested_by: userId,
    status: 'pending',
    responded_at: null,
  }
  const result = friendship
    ? await client.from(SUPABASE_FRIENDSHIP_TABLE).update(nextRequest).eq('user_a', userA).eq('user_b', userB)
    : await client.from(SUPABASE_FRIENDSHIP_TABLE).insert({ ...nextRequest, created_at: new Date().toISOString() })
  if (result.error) {
    if (isFriendRequestSchemaError(result.error)) throw new Error('Run the updated Supabase schema to enable friend requests.')
    throw result.error
  }
  return { profile, incomingRequest: false }
}

export async function respondToFriendRequest(
  client: SupabaseClient,
  userId: string,
  otherUserId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const [userA, userB] = sortedFriendshipPair(userId, otherUserId)
  const { data, error } = await client.from(SUPABASE_FRIENDSHIP_TABLE)
    .update({ status, responded_at: new Date().toISOString() })
    .eq('user_a', userA)
    .eq('user_b', userB)
    .eq('status', 'pending')
    .neq('requested_by', userId)
    .select('user_a')
    .maybeSingle()
  if (error) {
    if (isFriendRequestSchemaError(error)) throw new Error('Run the updated Supabase schema to enable friend requests.')
    throw error
  }
  if (!data) throw new Error('No incoming friend request found.')
}

export async function createSquad(client: SupabaseClient, userId: string, name: string, memberIds: string[]): Promise<FriendSquad> {
  const { data, error } = await client.from(SUPABASE_SQUAD_TABLE)
    .insert({ owner_id: userId, name, updated_at: new Date().toISOString() })
    .select('id, owner_id, name, created_at, updated_at')
    .single()
  if (error) {
    if (isFriendSquadSchemaError(error)) throw new Error('Run the updated Supabase schema to enable squads.')
    throw error
  }
  const squad = normalizeFriendSquadRow(data)
  if (!squad) throw new Error('Could not create the squad.')

  const memberResult = await client.from(SUPABASE_SQUAD_MEMBER_TABLE).insert(memberIds.map((memberId) => ({
    squad_id: squad.id,
    user_id: memberId,
    added_by: userId,
  })))
  if (memberResult.error) {
    await client.from(SUPABASE_SQUAD_TABLE).delete().eq('id', squad.id).eq('owner_id', userId)
    if (isFriendSquadSchemaError(memberResult.error)) throw new Error('Run the updated Supabase schema to enable squads.')
    throw memberResult.error
  }
  return squad
}

export async function updateSquad(
  client: SupabaseClient,
  userId: string,
  squadId: string,
  name: string,
  memberIds: string[],
): Promise<void> {
  const squadResult = await client.from(SUPABASE_SQUAD_TABLE)
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', squadId)
    .eq('owner_id', userId)
  if (squadResult.error) {
    if (isFriendSquadSchemaError(squadResult.error)) throw new Error('Run the updated Supabase schema to enable squads.')
    throw squadResult.error
  }
  const deleteResult = await client.from(SUPABASE_SQUAD_MEMBER_TABLE).delete().eq('squad_id', squadId)
  if (deleteResult.error) {
    if (isFriendSquadSchemaError(deleteResult.error)) throw new Error('Run the updated Supabase schema to enable squads.')
    throw deleteResult.error
  }
  if (memberIds.length === 0) return
  const memberResult = await client.from(SUPABASE_SQUAD_MEMBER_TABLE).insert(memberIds.map((memberId) => ({
    squad_id: squadId,
    user_id: memberId,
    added_by: userId,
  })))
  if (memberResult.error) {
    if (isFriendSquadSchemaError(memberResult.error)) throw new Error('Run the updated Supabase schema to enable squads.')
    throw memberResult.error
  }
}

export async function deleteSquad(client: SupabaseClient, userId: string, squadId: string): Promise<void> {
  const { error } = await client.from(SUPABASE_SQUAD_TABLE).delete().eq('id', squadId).eq('owner_id', userId)
  if (error) {
    if (isFriendSquadSchemaError(error)) throw new Error('Run the updated Supabase schema to enable squads.')
    throw error
  }
}

export async function createChallenge(
  client: SupabaseClient,
  userId: string,
  input: {
    name: string
    startDate: string
    endDate: string
    scoringMode: FriendChallengeScoringMode
    settings: ChallengeSettings
    inviteeIds: string[]
    ownerSummary: (challenge: FriendChallenge) => ChallengeSummary
  },
): Promise<FriendChallenge> {
  const { data, error } = await client.from(SUPABASE_FRIEND_CHALLENGE_TABLE).insert({
    creator_id: userId,
    name: input.name,
    start_date: input.startDate,
    end_date: input.endDate,
    scoring_mode: input.scoringMode,
    settings: input.settings,
    updated_at: new Date().toISOString(),
  }).select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at').single()
  if (error) {
    if (isFriendChallengeSchemaError(error)) throw new Error('Run the updated Supabase schema to enable friend challenges.')
    throw error
  }
  const challenge = normalizeFriendChallengeRow(data)
  if (!challenge) throw new Error('Could not create the challenge.')
  const now = new Date().toISOString()
  const participantResult = await client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE).insert([
    { challenge_id: challenge.id, user_id: userId, invited_by: userId, status: 'accepted', summary: input.ownerSummary(challenge), responded_at: now },
    ...input.inviteeIds.map((inviteeId) => ({
      challenge_id: challenge.id,
      user_id: inviteeId,
      invited_by: userId,
      status: 'pending',
      summary: null,
      responded_at: null,
    })),
  ])
  if (participantResult.error) {
    if (isFriendChallengeSchemaError(participantResult.error)) throw new Error('Run the updated Supabase schema to enable friend challenges.')
    throw participantResult.error
  }
  return challenge
}

export async function inviteChallengeParticipants(client: SupabaseClient, userId: string, challengeId: string, inviteeIds: string[]): Promise<void> {
  const { error } = await client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE).insert(inviteeIds.map((inviteeId) => ({
    challenge_id: challengeId,
    user_id: inviteeId,
    invited_by: userId,
    status: 'pending',
    summary: null,
    responded_at: null,
  })))
  if (error) {
    if (isFriendChallengeSchemaError(error)) throw new Error('Run the updated Supabase schema to enable friend challenges.')
    throw error
  }
}

export async function respondToChallengeInvite(
  client: SupabaseClient,
  userId: string,
  challengeId: string,
  status: 'accepted' | 'declined',
  summary: ChallengeSummary | null,
): Promise<void> {
  const payload: Record<string, unknown> = { status, responded_at: new Date().toISOString() }
  if (status === 'accepted') payload.summary = summary
  const { data, error } = await client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
    .update(payload)
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('challenge_id')
    .maybeSingle()
  if (error) {
    if (isFriendChallengeSchemaError(error)) throw new Error('Run the updated Supabase schema to enable friend challenges.')
    throw error
  }
  if (!data) throw new Error('No pending challenge invite found.')
}

export async function publishChallengeScore(
  client: SupabaseClient,
  userId: string,
  challengeId: string,
  summary: ChallengeSummary,
): Promise<void> {
  const { error } = await client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
    .update({ summary, responded_at: new Date().toISOString() })
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
  if (error) {
    if (isFriendChallengeSchemaError(error)) throw new Error('Run the updated Supabase schema to enable friend challenges.')
    throw error
  }
}

export async function publishLeaderboardSummary(client: SupabaseClient, summary: ChallengeSummary): Promise<void> {
  const { error } = await client.from(SUPABASE_SUMMARY_TABLE).upsert({
    user_id: summary.userId,
    challenge_title: summary.challengeTitle,
    start_date: summary.startDate,
    end_date: summary.endDate,
    logged_days: summary.loggedDays,
    total_days: summary.totalDays,
    average_completion: summary.averageCompletion,
    weekly_completion: summary.weeklyCompletion,
    current_streak: summary.currentStreak,
    longest_streak: summary.longestStreak,
    last_logged_date: summary.lastLoggedDate,
    privacy: summary.privacy,
    updated_at: summary.updatedAt,
  }, { onConflict: 'user_id' })
  if (error) {
    if (isSummarySchemaError(error)) throw new Error('Run the updated Supabase schema to enable privacy settings.')
    throw error
  }
}

export async function ensureFriendProfile(client: SupabaseClient, user: User): Promise<FriendProfile> {
  const { data: existingProfile, error: selectError } = await client
    .from(SUPABASE_PROFILE_TABLE)
    .select('user_id, display_name, invite_code')
    .eq('user_id', user.id)
    .maybeSingle()

  if (selectError) throw selectError
  const normalizedExistingProfile = normalizeFriendProfileRow(existingProfile)
  if (normalizedExistingProfile) return normalizedExistingProfile

  const { data: createdProfile, error: createError } = await client
    .from(SUPABASE_PROFILE_TABLE)
    .upsert({
      user_id: user.id,
      display_name: defaultDisplayName(user),
      invite_code: generateInviteCode(user.id),
    }, { onConflict: 'user_id' })
    .select('user_id, display_name, invite_code')
    .single()

  if (createError) throw createError
  const profile = normalizeFriendProfileRow(createdProfile)
  if (!profile) throw new Error('Could not load your friend profile.')
  return profile
}

export async function loadSocialDashboard(client: SupabaseClient, user: User): Promise<SocialDashboardData> {
  const profile = await ensureFriendProfile(client, user)
  const { data: friendships, error: friendshipError } = await client
    .from(SUPABASE_FRIENDSHIP_TABLE)
    .select('user_a, user_b, created_by, requested_by, status, created_at, responded_at')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

  if (friendshipError) {
    if (isFriendRequestSchemaError(friendshipError)) throw new Error('Run the updated Supabase schema to enable friend requests.')
    throw friendshipError
  }

  const friendshipRows = (friendships ?? [])
    .map(normalizeFriendshipRow)
    .filter((row): row is FriendshipRow => row !== null)
  const acceptedFriendIds = friendshipRows
    .filter((friendship) => friendship.status === 'accepted')
    .map((friendship) => friendship.userA === user.id ? friendship.userB : friendship.userA)
  const pendingFriendships = friendshipRows.filter((friendship) => friendship.status === 'pending')
  const pendingUserIds = pendingFriendships
    .map((friendship) => friendship.userA === user.id ? friendship.userB : friendship.userA)
  const visibleUserIds = Array.from(new Set([user.id, ...acceptedFriendIds, ...pendingUserIds]))

  const [profileResult, summaryResult] = await Promise.all([
    client.from(SUPABASE_PROFILE_TABLE).select('user_id, display_name, invite_code').in('user_id', visibleUserIds),
    client.from(SUPABASE_SUMMARY_TABLE).select('*').in('user_id', Array.from(new Set([user.id, ...acceptedFriendIds]))),
  ])
  if (profileResult.error) throw profileResult.error
  if (summaryResult.error) throw summaryResult.error

  const profiles = (profileResult.data ?? [])
    .map(normalizeFriendProfileRow)
    .filter((row): row is FriendProfile => row !== null)
  if (!profiles.some((row) => row.userId === profile.userId)) profiles.push(profile)
  const profilesByUserId = new Map(profiles.map((row) => [row.userId, row]))
  const summariesByUserId = new Map(
    (summaryResult.data ?? [])
      .map(normalizeSummaryRow)
      .filter((row): row is ChallengeSummary => row !== null)
      .map((summary) => [summary.userId, summary]),
  )

  const leaderboardRows = profiles
    .filter((row) => row.userId === user.id || acceptedFriendIds.includes(row.userId))
    .map((row) => ({
      ...row,
      summary: summariesByUserId.get(row.userId) ?? null,
      isCurrentUser: row.userId === user.id,
    }))
    .sort((a, b) => (b.summary?.weeklyCompletion ?? 0) - (a.summary?.weeklyCompletion ?? 0)
      || (b.summary?.averageCompletion ?? 0) - (a.summary?.averageCompletion ?? 0)
      || (b.summary?.currentStreak ?? 0) - (a.summary?.currentStreak ?? 0)
      || a.displayName.localeCompare(b.displayName))

  const requests = pendingFriendships
    .map((friendship) => {
      const otherUserId = friendship.userA === user.id ? friendship.userB : friendship.userA
      const requestProfile = profilesByUserId.get(otherUserId)
      if (!requestProfile) return null
      return {
        ...requestProfile,
        userA: friendship.userA,
        userB: friendship.userB,
        requestedBy: friendship.requestedBy,
        direction: friendship.requestedBy === user.id ? 'outgoing' : 'incoming',
        createdAt: friendship.createdAt,
      } satisfies FriendRequest
    })
    .filter((request): request is FriendRequest => request !== null)
    .sort((a, b) => a.direction.localeCompare(b.direction) || a.displayName.localeCompare(b.displayName))

  const challenges = await loadChallenges(client, user.id, profilesByUserId)
  const squadResult = await loadSquads(client, user.id, acceptedFriendIds, profilesByUserId)
  const events = await loadFriendEvents(client, user.id, acceptedFriendIds)

  return {
    profile,
    leaderboardRows,
    requests,
    challenges,
    squads: squadResult.squads,
    events,
    squadSchemaReady: squadResult.schemaReady,
    acceptedFriendCount: acceptedFriendIds.length,
  }
}

async function loadChallenges(
  client: SupabaseClient,
  userId: string,
  profilesByUserId: Map<string, FriendProfile>,
): Promise<FriendChallengeView[]> {
  const [participantResult, createdResult] = await Promise.all([
    client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
      .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'accepted']),
    client.from(SUPABASE_FRIEND_CHALLENGE_TABLE)
      .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
      .eq('creator_id', userId),
  ])

  for (const error of [participantResult.error, createdResult.error]) {
    if (!error) continue
    if (isFriendChallengeSchemaError(error)) throw new Error('Run the updated Supabase schema to enable friend challenges.')
    throw error
  }

  const mine = (participantResult.data ?? [])
    .map(normalizeFriendChallengeParticipantRow)
    .filter((row): row is FriendChallengeParticipant => row !== null)
  const created = (createdResult.data ?? [])
    .map(normalizeFriendChallengeRow)
    .filter((row): row is FriendChallenge => row !== null)
  const challengeIds = Array.from(new Set([...mine.map((row) => row.challengeId), ...created.map((row) => row.id)]))
  if (challengeIds.length === 0) return []

  const [challengeResult, allParticipantResult] = await Promise.all([
    client.from(SUPABASE_FRIEND_CHALLENGE_TABLE)
      .select('id, creator_id, name, start_date, end_date, scoring_mode, settings, created_at, updated_at')
      .in('id', challengeIds),
    client.from(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
      .select('challenge_id, user_id, invited_by, status, summary, created_at, responded_at')
      .in('challenge_id', challengeIds),
  ])

  for (const error of [challengeResult.error, allParticipantResult.error]) {
    if (!error) continue
    if (isFriendChallengeSchemaError(error)) throw new Error('Run the updated Supabase schema to enable friend challenges.')
    throw error
  }

  const challengeRows = (challengeResult.data ?? [])
    .map(normalizeFriendChallengeRow)
    .filter((row): row is FriendChallenge => row !== null)
  const participants = (allParticipantResult.data ?? [])
    .map(normalizeFriendChallengeParticipantRow)
    .filter((row): row is FriendChallengeParticipant => row !== null)
  const missingProfileIds = Array.from(new Set(participants.map((row) => row.userId)))
    .filter((participantId) => !profilesByUserId.has(participantId))

  if (missingProfileIds.length > 0) {
    const { data, error } = await client.from(SUPABASE_PROFILE_TABLE)
      .select('user_id, display_name, invite_code')
      .in('user_id', missingProfileIds)
    if (error) throw error
    for (const row of (data ?? []).map(normalizeFriendProfileRow).filter((item): item is FriendProfile => item !== null)) {
      profilesByUserId.set(row.userId, row)
    }
  }

  return challengeRows.map((challenge) => {
    const participantViews = participants
      .filter((participant) => participant.challengeId === challenge.id)
      .map((participant) => {
        const participantProfile = profilesByUserId.get(participant.userId)
        return {
          userId: participant.userId,
          displayName: participantProfile?.displayName ?? 'Challenger',
          inviteCode: participantProfile?.inviteCode ?? '',
          invitedBy: participant.invitedBy,
          status: participant.status,
          summary: participant.summary,
          createdAt: participant.createdAt,
          respondedAt: participant.respondedAt,
          isCurrentUser: participant.userId === userId,
        } satisfies FriendChallengeParticipantView
      })
      .sort((a, b) => a.status !== b.status
        ? (a.status === 'accepted' ? -1 : 1)
        : (b.summary?.weeklyCompletion ?? 0) - (a.summary?.weeklyCompletion ?? 0)
          || (b.summary?.averageCompletion ?? 0) - (a.summary?.averageCompletion ?? 0)
          || a.displayName.localeCompare(b.displayName))
    const currentParticipant = participants.find((row) => row.challengeId === challenge.id && row.userId === userId)
    return {
      ...challenge,
      currentUserStatus: currentParticipant?.status ?? 'pending',
      isCreator: challenge.creatorId === userId,
      participants: participantViews,
    } satisfies FriendChallengeView
  }).sort((a, b) => a.currentUserStatus !== b.currentUserStatus
    ? (a.currentUserStatus === 'pending' ? -1 : 1)
    : b.startDate.localeCompare(a.startDate) || a.name.localeCompare(b.name))
}

async function loadSquads(
  client: SupabaseClient,
  userId: string,
  acceptedFriendIds: string[],
  profilesByUserId: Map<string, FriendProfile>,
): Promise<{ squads: FriendSquadView[]; schemaReady: boolean }> {
  const { data, error } = await client.from(SUPABASE_SQUAD_TABLE)
    .select('id, owner_id, name, created_at, updated_at')
    .eq('owner_id', userId)
  if (error) {
    if (isFriendSquadSchemaError(error)) return { squads: [], schemaReady: false }
    throw error
  }

  const squads = (data ?? []).map(normalizeFriendSquadRow).filter((row): row is FriendSquad => row !== null)
  if (squads.length === 0) return { squads: [], schemaReady: true }
  const memberResult = await client.from(SUPABASE_SQUAD_MEMBER_TABLE)
    .select('squad_id, user_id, added_by, created_at')
    .in('squad_id', squads.map((squad) => squad.id))
  if (memberResult.error) {
    if (isFriendSquadSchemaError(memberResult.error)) return { squads: [], schemaReady: false }
    throw memberResult.error
  }

  const members = (memberResult.data ?? [])
    .map(normalizeFriendSquadMemberRow)
    .filter((row): row is FriendSquadMember => row !== null)
  return {
    squads: squads.map((squad) => ({
      ...squad,
      members: members
        .filter((member) => member.squadId === squad.id && acceptedFriendIds.includes(member.userId))
        .map((member) => profilesByUserId.get(member.userId))
        .filter((row): row is FriendProfile => row !== undefined)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    schemaReady: true,
  }
}

async function loadFriendEvents(client: SupabaseClient, userId: string, acceptedFriendIds: string[]): Promise<FriendEvent[]> {
  const actorIds = Array.from(new Set([userId, ...acceptedFriendIds]))
  const { data, error } = await client.from(SUPABASE_FRIEND_EVENT_TABLE)
    .select('id, actor_id, target_user_id, challenge_id, squad_id, event_type, metadata, created_at')
    .or(`actor_id.in.(${actorIds.join(',')}),target_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) {
    if (isFriendEventSchemaError(error)) return []
    throw error
  }
  return (data ?? []).map(normalizeFriendEventRow).filter((row): row is FriendEvent => row !== null)
}
