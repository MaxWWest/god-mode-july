import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE,
  SUPABASE_FRIEND_CHALLENGE_TABLE,
  SUPABASE_FRIEND_EVENT_COMMENT_TABLE,
  SUPABASE_FRIEND_EVENT_REACTION_TABLE,
  SUPABASE_FRIENDSHIP_TABLE,
  SUPABASE_SQUAD_MEMBER_TABLE,
  SUPABASE_SQUAD_TABLE,
} from '../supabase'
import { DEFAULT_PRIVACY_SETTINGS, DEFAULT_SETTINGS } from '../tracker'
import type { ChallengeSummary } from '../types'
import { addFriendEventComment, createChallenge, deleteChallenge, removeChallengeParticipant, respondToFriendRequest, setFriendEventReaction, updateSquad } from './socialApi'

function resultChain(data: unknown = null) {
  const chain: Record<string, unknown> = { data, error: null }
  chain.update = vi.fn(() => chain)
  chain.delete = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.neq = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({ data, error: null }))
  return chain
}

describe('social service mutations', () => {
  it('stores trimmed feed comments for the signed-in user', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient

    await addFriendEventComment(client, 'user-1', 'event-1', '  Keep going  ')

    expect(client.from).toHaveBeenCalledWith(SUPABASE_FRIEND_EVENT_COMMENT_TABLE)
    expect(insert).toHaveBeenCalledWith({ event_id: 'event-1', user_id: 'user-1', body: 'Keep going' })
  })

  it('upserts one reaction per user and event', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    const client = { from: vi.fn(() => ({ upsert })) } as unknown as SupabaseClient

    await setFriendEventReaction(client, 'user-1', 'event-1', 'respect')

    expect(client.from).toHaveBeenCalledWith(SUPABASE_FRIEND_EVENT_REACTION_TABLE)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      event_id: 'event-1',
      user_id: 'user-1',
      reaction: 'respect',
    }), { onConflict: 'event_id,user_id' })
  })

  it('accepts only an incoming pending friend request', async () => {
    const query = resultChain({ user_a: 'friend-1' })
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe(SUPABASE_FRIENDSHIP_TABLE)
        return query
      }),
    } as unknown as SupabaseClient

    await respondToFriendRequest(client, 'user-2', 'friend-1', 'accepted')

    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'accepted' }))
    expect(query.neq).toHaveBeenCalledWith('requested_by', 'user-2')
  })

  it('updates a squad and replaces its member list', async () => {
    const squadQuery = resultChain()
    const memberQuery = resultChain()
    memberQuery.insert = vi.fn(async () => ({ error: null }))
    const client = {
      from: vi.fn((table: string) => table === SUPABASE_SQUAD_TABLE ? squadQuery : memberQuery),
    } as unknown as SupabaseClient

    await updateSquad(client, 'owner-1', 'squad-1', 'Morning Crew', ['friend-1', 'friend-2'])

    expect(client.from).toHaveBeenCalledWith(SUPABASE_SQUAD_MEMBER_TABLE)
    expect(memberQuery.insert).toHaveBeenCalledWith([
      { squad_id: 'squad-1', user_id: 'friend-1', added_by: 'owner-1' },
      { squad_id: 'squad-1', user_id: 'friend-2', added_by: 'owner-1' },
    ])
  })

  it('creates a challenge with owner and pending invitees', async () => {
    const challengeRow = {
      id: 'challenge-1',
      creator_id: 'owner-1',
      name: 'Seven Strong',
      start_date: '2026-06-18',
      end_date: '2026-06-24',
      scoring_mode: 'personal',
      settings: DEFAULT_SETTINGS,
      created_at: '2026-06-18T08:00:00.000Z',
      updated_at: '2026-06-18T08:00:00.000Z',
    }
    const challengeQuery = {
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: challengeRow, error: null })),
        })),
      })),
    }
    const participantInsert = vi.fn(async () => ({ error: null }))
    const client = {
      from: vi.fn((table: string) => table === SUPABASE_FRIEND_CHALLENGE_TABLE
        ? challengeQuery
        : { insert: participantInsert }),
    } as unknown as SupabaseClient
    const ownerSummary = vi.fn((): ChallengeSummary => ({
      userId: 'owner-1',
      challengeTitle: 'Seven Strong',
      startDate: '2026-06-18',
      endDate: '2026-06-24',
      loggedDays: 0,
      totalDays: 7,
      averageCompletion: 0,
      weeklyCompletion: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastLoggedDate: null,
      updatedAt: '2026-06-18T08:00:00.000Z',
      privacy: DEFAULT_PRIVACY_SETTINGS,
    }))

    await createChallenge(client, 'owner-1', {
      name: 'Seven Strong',
      startDate: '2026-06-18',
      endDate: '2026-06-24',
      scoringMode: 'personal',
      settings: DEFAULT_SETTINGS,
      inviteeIds: ['friend-1'],
      ownerSummary,
    })

    expect(ownerSummary).toHaveBeenCalledOnce()
    expect(participantInsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ user_id: 'owner-1', status: 'accepted' }),
      expect.objectContaining({ user_id: 'friend-1', status: 'pending' }),
    ]))
    expect(client.from).toHaveBeenCalledWith(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
  })

  it('removes a challenge participant row by challenge and user', async () => {
    const query = resultChain()
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe(SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE)
        return query
      }),
    } as unknown as SupabaseClient

    await removeChallengeParticipant(client, 'challenge-1', 'friend-1')

    expect(query.delete).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith('challenge_id', 'challenge-1')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'friend-1')
  })

  it('deletes an owned challenge by id and creator', async () => {
    const query = resultChain()
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe(SUPABASE_FRIEND_CHALLENGE_TABLE)
        return query
      }),
    } as unknown as SupabaseClient

    await deleteChallenge(client, 'owner-1', 'challenge-1')

    expect(query.delete).toHaveBeenCalledOnce()
    expect(query.eq).toHaveBeenCalledWith('id', 'challenge-1')
    expect(query.eq).toHaveBeenCalledWith('creator_id', 'owner-1')
  })
})
