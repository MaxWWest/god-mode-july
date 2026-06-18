import { createClient } from '@supabase/supabase-js'

export const SUPABASE_TABLE = 'god_mode_challenge_snapshots'
export const SUPABASE_PROFILE_TABLE = 'god_mode_profiles'
export const SUPABASE_FRIENDSHIP_TABLE = 'god_mode_friendships'
export const SUPABASE_SUMMARY_TABLE = 'god_mode_challenge_summaries'
export const SUPABASE_FRIEND_CHALLENGE_TABLE = 'god_mode_friend_challenges'
export const SUPABASE_FRIEND_CHALLENGE_PARTICIPANT_TABLE = 'god_mode_friend_challenge_participants'
export const SUPABASE_CHALLENGE_SCORE_HISTORY_TABLE = 'god_mode_challenge_score_history'
export const SUPABASE_SQUAD_TABLE = 'god_mode_squads'
export const SUPABASE_SQUAD_MEMBER_TABLE = 'god_mode_squad_members'
export const SUPABASE_FRIEND_EVENT_TABLE = 'god_mode_friend_events'
export const SUPABASE_FRIEND_EVENT_COMMENT_TABLE = 'god_mode_friend_event_comments'
export const SUPABASE_FRIEND_EVENT_REACTION_TABLE = 'god_mode_friend_event_reactions'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
      persistSession: true,
      storageKey: 'god-mode-july-auth-session',
    },
  })
  : null
