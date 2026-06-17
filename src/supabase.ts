import { createClient } from '@supabase/supabase-js'

export const SUPABASE_TABLE = 'god_mode_challenge_snapshots'
export const SUPABASE_PROFILE_TABLE = 'god_mode_profiles'
export const SUPABASE_FRIENDSHIP_TABLE = 'god_mode_friendships'
export const SUPABASE_SUMMARY_TABLE = 'god_mode_challenge_summaries'

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
