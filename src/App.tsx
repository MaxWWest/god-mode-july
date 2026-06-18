import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { User } from '@supabase/supabase-js'
import { loadFromStorage, saveToStorage } from './storage'
import {
  buildAccountDataExport as buildAccountDataExportApi,
  deleteCloudAccountData as deleteCloudAccountDataApi,
  fetchCloudSnapshot as fetchCloudSnapshotApi,
  writeCloudSnapshot as writeCloudSnapshotApi,
} from './services/cloudApi'
import {
  createChallenge as createChallengeRecord,
  createSquad as createSquadRecord,
  deleteSquad as deleteSquadRecord,
  ensureFriendProfile as ensureFriendProfileApi,
  inviteChallengeParticipants,
  loadSocialDashboard,
  publishChallengeScore,
  publishLeaderboardSummary,
  recordFriendEvent as recordFriendEventApi,
  requestFriendByInviteCode,
  respondToChallengeInvite,
  respondToFriendRequest as respondToFriendRequestApi,
  updateFriendProfile as updateFriendProfileApi,
  updateSquad as updateSquadRecord,
} from './services/socialApi'
import {
  buildChallengeSettingsForTemplate,
  buildChallengeSummary,
  buildFriendChallengeSnapshots,
  buildFriendChallengeSummary,
} from './socialData'
import {
  DAY_IN_MS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SYNC_META,
  addDays,
  clampDate,
  completionStats,
  countCloudOnlyEntries,
  dayNumber,
  daysBetween,
  downloadTextFile,
  formatDate,
  formatDateTime,
  formatMonthLabel,
  formatShortDate,
  getEnabledRules,
  getExerciseMinutes,
  getLoggedDates,
  getTrackingDates,
  isEntryFinalized,
  isIsoDate,
  makeEmptyEntry,
  makeEmptyWorkout,
  mergeCloudOnlyEntries,
  normalizeEntries,
  normalizePrivacySettings,
  normalizeReminderSettings,
  normalizeSettings,
  normalizeSyncMeta,
  ruleComplete,
  sanitizeFilenamePart,
  selectableEndDate,
  timestampIsAfter,
  todayIso,
} from './tracker'
import {
  isSupabaseConfigured,
  supabase,
} from './supabase'
import type {
  AccountDataExport,
  AppNotice,
  ChallengeSettings,
  ChallengeTemplate,
  CloudSnapshot,
  CreateFriendChallengeInput,
  CreateFriendSquadInput,
  DailyEntry,
  DataStatus,
  EntryMap,
  FriendActivityFeedItem,
  FriendChallengeView,
  FriendEvent,
  FriendEventType,
  FriendProfile,
  FriendRequest,
  FriendSquadView,
  FriendsTab,
  InstallPromptEvent,
  InviteFriendChallengeInput,
  LeaderboardRow,
  PrivacySettings,
  ReminderSettings,
  RuleConfig,
  RuleKey,
  ScoreReaction,
  SyncConflict,
  SyncMeta,
  UpdateFriendSquadInput,
  View,
} from './types'
import {
  AppNoticeToast,
  NavButton,
} from './ui'

const CheckInView = lazy(() => import('./features/CheckInView'))
const FriendsView = lazy(() => import('./features/FriendsView'))
const ProgressView = lazy(() => import('./features/ProgressView'))
const SettingsView = lazy(() => import('./features/SettingsView'))

const ENTRIES_STORAGE_KEY = 'god-mode-july-entries-v1'
const SETTINGS_STORAGE_KEY = 'god-mode-july-settings-v1'
const REMINDER_STORAGE_KEY = 'god-mode-july-reminder-v1'
const SYNC_META_STORAGE_KEY = 'god-mode-july-sync-meta-v1'
const TUTORIAL_STORAGE_KEY = 'god-mode-july-tutorial-seen-v1'
const PRIVACY_STORAGE_KEY = 'god-mode-july-privacy-v1'

const TUTORIAL_STEPS = [
  {
    eyebrow: 'Step 1',
    title: 'Build today from the Home tab.',
    body: 'Tap daily rules as you complete them. Your percent is weighted by non-negotiable and supporting rules.',
  },
  {
    eyebrow: 'Step 2',
    title: 'Use Check-In for the details.',
    body: 'Log workouts, food targets, water, sleep, mood, and short reflections before you finalize the day.',
  },
  {
    eyebrow: 'Step 3',
    title: 'Finalize when the day is done.',
    body: 'Finalizing locks the day so your score feels published. You can still unlock it if you need to fix something.',
  },
  {
    eyebrow: 'Step 4',
    title: 'Tune the tracker in Settings.',
    body: 'Change targets, scored rule categories, active rules, account sync, reminders, exports, and cloud data controls.',
  },
  {
    eyebrow: 'Step 5',
    title: 'Compete from Friends.',
    body: 'Copy your invite code, accept requests, save private squads, publish scores, and create friend challenges.',
  },
]

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

function ruleDetail(rule: RuleConfig, entry: DailyEntry, settings: ChallengeSettings): string | undefined {
  switch (rule.key) {
    case 'exercise':
      return `${getExerciseMinutes(entry)} / ${settings.targets.exerciseMinutes} min`
    case 'calories':
      return `${entry.calories ?? 0} / ${settings.targets.calories} kcal`
    case 'protein':
      return `${entry.proteinGrams ?? 0} / ${settings.targets.proteinGrams} g`
    case 'water':
      return `${entry.waterLiters ?? 0} / ${settings.targets.waterLiters} L`
    case 'sleep':
      return `${entry.sleepHours ?? 0} / ${settings.targets.sleepHours} hr`
    default:
      return undefined
  }
}

function calendarCellLabel(date: string, settings: ChallengeSettings): string {
  const parsed = new Date(`${date}T12:00:00`)
  const day = parsed.getDate()
  if (date === settings.startDate || day === 1) return formatShortDate(date)
  return String(day)
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (!copied) throw new Error('Clipboard copy is not available in this browser.')
}

function clearAuthRedirectUrl() {
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`)
}

async function consumeAuthRedirectSession(): Promise<User | null> {
  if (!supabase) return null

  const searchParams = new URLSearchParams(window.location.search)
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const authError = searchParams.get('error_description') || hashParams.get('error_description')
  if (authError) throw new Error(authError)

  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (error) throw error
    clearAuthRedirectUrl()
    return data.user ?? data.session?.user ?? null
  }

  const authCode = searchParams.get('code')
  if (authCode) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(authCode)
    if (error) throw error
    clearAuthRedirectUrl()
    return data.user ?? data.session?.user ?? null
  }

  return null
}

function App() {
  const [settings, setSettings] = useState<ChallengeSettings>(() => normalizeSettings(loadFromStorage<unknown>(SETTINGS_STORAGE_KEY, null)))
  const [view, setView] = useState<View>('home')
  const [selectedDate, setSelectedDate] = useState(() => clampDate(todayIso(), settings))
  const [entries, setEntries] = useState<EntryMap>(() => normalizeEntries(loadFromStorage<unknown>(ENTRIES_STORAGE_KEY, {})))
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => normalizeReminderSettings(loadFromStorage<unknown>(REMINDER_STORAGE_KEY, null)))
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(() => normalizeSyncMeta(loadFromStorage<unknown>(SYNC_META_STORAGE_KEY, DEFAULT_SYNC_META)))
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => normalizePrivacySettings(loadFromStorage<unknown>(PRIVACY_STORAGE_KEY, null)))
  const [syncConflict, setSyncConflict] = useState<SyncConflict | null>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [savePulse, setSavePulse] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(() => normalizeSyncMeta(loadFromStorage<unknown>(SYNC_META_STORAGE_KEY, DEFAULT_SYNC_META)).lastCloudUpdatedAt)
  const [cloudStatus, setCloudStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: isSupabaseConfigured ? 'Sign in to sync across devices.' : 'Add Supabase env vars to enable cloud sync.',
  })
  const [reminderStatus, setReminderStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: 'Local reminders run while the app is open.',
  })
  const [friendProfile, setFriendProfile] = useState<FriendProfile | null>(null)
  const [displayNameDraft, setDisplayNameDraft] = useState('')
  const [inviteCodeDraft, setInviteCodeDraft] = useState('')
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [friendChallenges, setFriendChallenges] = useState<FriendChallengeView[]>([])
  const [friendSquads, setFriendSquads] = useState<FriendSquadView[]>([])
  const [friendEvents, setFriendEvents] = useState<FriendEvent[]>([])
  const [friendsBusy, setFriendsBusy] = useState(false)
  const [friendsStatus, setFriendsStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: isSupabaseConfigured ? 'Sign in to compete with friends.' : 'Add Supabase env vars to enable friends.',
  })
  const [appNotice, setAppNotice] = useState<AppNotice | null>(null)
  const [showTutorial, setShowTutorial] = useState(() => {
    return loadFromStorage<unknown>(TUTORIAL_STORAGE_KEY, false) !== true && Object.keys(entries).length === 0
  })
  const [tutorialStep, setTutorialStep] = useState(0)

  const entry = entries[selectedDate] ?? makeEmptyEntry(selectedDate)
  const entryFinalized = isEntryFinalized(entry)
  const stats = completionStats(entry, settings)
  const trackerHasStarted = todayIso() >= settings.startDate
  const latestSelectableDate = selectableEndDate(settings)

  function showAppNotice(message: string, tone: AppNotice['tone'] = 'success') {
    setAppNotice({
      id: Date.now(),
      tone,
      message,
    })
  }

  function openTutorial() {
    setTutorialStep(0)
    setShowTutorial(true)
  }

  function closeTutorial(markSeen = true) {
    if (markSeen) saveToStorage(TUTORIAL_STORAGE_KEY, true)
    setShowTutorial(false)
  }

  useEffect(() => {
    saveToStorage(ENTRIES_STORAGE_KEY, entries)
    setSavePulse(true)
    const timer = window.setTimeout(() => setSavePulse(false), 700)
    return () => window.clearTimeout(timer)
  }, [entries])

  useEffect(() => {
    saveToStorage(SETTINGS_STORAGE_KEY, settings)
    setSelectedDate((date) => clampDate(date, settings))
  }, [settings])

  useEffect(() => {
    saveToStorage(REMINDER_STORAGE_KEY, reminderSettings)
  }, [reminderSettings])

  useEffect(() => {
    saveToStorage(SYNC_META_STORAGE_KEY, syncMeta)
  }, [syncMeta])

  useEffect(() => {
    saveToStorage(PRIVACY_STORAGE_KEY, privacySettings)
  }, [privacySettings])

  useEffect(() => {
    if (!appNotice) return
    const timer = window.setTimeout(() => setAppNotice(null), 3600)
    return () => window.clearTimeout(timer)
  }, [appNotice])

  useEffect(() => {
    if (!supabase) return
    const client = supabase

    let isMounted = true

    async function initializeAuthSession() {
      try {
        const redirectedUser = await consumeAuthRedirectSession()
        if (!isMounted) return

        if (redirectedUser) {
          setUser(redirectedUser)
          setCloudStatus({ tone: 'success', message: 'Signed in. Push local data or pull cloud data.' })
          return
        }

        const { data, error } = await client.auth.getSession()
        if (error) throw error
        if (!isMounted) return
        setUser(data.session?.user ?? null)
      } catch (error) {
        if (!isMounted) return
        setCloudStatus({
          tone: 'error',
          message: error instanceof Error ? `Magic link sign-in failed: ${error.message}` : 'Magic link sign-in failed.',
        })

        const { data } = await client.auth.getSession()
        if (isMounted) setUser(data.session?.user ?? null)
      }
    }

    void initializeAuthSession()

    const { data } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setCloudStatus({
        tone: event === 'PASSWORD_RECOVERY' ? 'success' : 'neutral',
        message: event === 'PASSWORD_RECOVERY'
          ? 'Password reset verified. Enter a new password below and tap Set Password.'
          : session?.user ? 'Signed in. Push local data or pull cloud data.' : 'Sign in to sync across devices.',
      })
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setFriendProfile(null)
      setDisplayNameDraft('')
      setInviteCodeDraft('')
      setLeaderboardRows([])
      setFriendRequests([])
      setFriendChallenges([])
      setFriendSquads([])
      setFriendEvents([])
      setFriendsStatus({
        tone: 'neutral',
        message: isSupabaseConfigured ? 'Sign in to compete with friends.' : 'Add Supabase env vars to enable friends.',
      })
      return
    }

    void refreshFriendsData()
  }, [user])

  useEffect(() => {
    if (!reminderSettings.enabled) return

    if (!('Notification' in window)) {
      setReminderStatus({ tone: 'error', message: 'This browser does not support notifications.' })
      return
    }

    if (Notification.permission !== 'granted') {
      setReminderStatus({ tone: 'neutral', message: 'Allow notifications to activate reminders.' })
      return
    }

    const [hours, minutes] = reminderSettings.time.split(':').map(Number)
    const nextReminder = new Date()
    nextReminder.setHours(hours, minutes, 0, 0)
    if (nextReminder.getTime() <= Date.now()) nextReminder.setDate(nextReminder.getDate() + 1)

    const showReminder = () => {
      new Notification(settings.title, {
        body: reminderSettings.message,
        icon: '/icons/pwa-192.png',
      })
    }

    let intervalId: number | undefined
    const timeoutId = window.setTimeout(() => {
      showReminder()
      intervalId = window.setInterval(showReminder, DAY_IN_MS)
    }, nextReminder.getTime() - Date.now())

    setReminderStatus({ tone: 'success', message: `Reminder scheduled for ${reminderSettings.time}.` })

    return () => {
      window.clearTimeout(timeoutId)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [reminderSettings, settings.title])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const loggedDates = useMemo(() => getLoggedDates(entries, settings), [entries, settings])
  const latestWeight = useMemo(() => {
    return [...loggedDates]
      .reverse()
      .map((date) => entries[date]?.weightPounds)
      .find((weight): weight is number => typeof weight === 'number')
  }, [entries, loggedDates])

  function markLocalChanged() {
    const changedAt = new Date().toISOString()
    setSyncConflict(null)
    setSyncMeta((current) => ({
      ...current,
      lastLocalChangeAt: changedAt,
    }))
  }

  function updateEntry(patch: Partial<DailyEntry>) {
    markLocalChanged()
    setEntries((current) => ({
      ...current,
      [selectedDate]: {
        ...(current[selectedDate] ?? makeEmptyEntry(selectedDate)),
        ...patch,
        date: selectedDate,
      },
    }))
  }

  function updateEntryIfUnlocked(patch: Partial<DailyEntry>) {
    if (isEntryFinalized(entry)) return
    updateEntry(patch)
  }

  function finalizeSelectedDay() {
    markLocalChanged()
    const nextEntries = {
      ...entries,
      [selectedDate]: {
        ...entry,
        date: selectedDate,
        finalizedAt: new Date().toISOString(),
      },
    }

    setEntries(nextEntries)
    if (user) void publishFriendSummary(true, nextEntries, privacySettings)
  }

  function unlockSelectedDay() {
    markLocalChanged()
    const nextEntries = {
      ...entries,
      [selectedDate]: {
        ...entry,
        date: selectedDate,
        finalizedAt: null,
      },
    }

    setEntries(nextEntries)
  }

  function updateSettings(nextSettings: ChallengeSettings) {
    markLocalChanged()
    setSettings(normalizeSettings(nextSettings))
  }

  function replaceData(nextSettings: ChallengeSettings, nextEntries: EntryMap, markChanged = true) {
    if (markChanged) markLocalChanged()
    const normalizedSettings = normalizeSettings(nextSettings)
    setSettings(normalizedSettings)
    setEntries(normalizeEntries(nextEntries))
    setSelectedDate((date) => clampDate(date, normalizedSettings))
  }

  function updateReminder(nextReminderSettings: ReminderSettings) {
    setReminderSettings(normalizeReminderSettings(nextReminderSettings))
  }

  function updatePrivacy(nextPrivacySettings: PrivacySettings) {
    const normalizedPrivacySettings = normalizePrivacySettings(nextPrivacySettings)
    setPrivacySettings(normalizedPrivacySettings)
    if (user) void publishFriendSummary(true, entries, normalizedPrivacySettings)
  }

  function hasLocalUnsyncedChanges(): boolean {
    return timestampIsAfter(syncMeta.lastLocalChangeAt, syncMeta.lastCloudUpdatedAt)
      || (!syncMeta.lastCloudUpdatedAt && Object.keys(entries).length > 0)
  }

  function cloudChangedSinceLastSync(cloud: CloudSnapshot): boolean {
    return timestampIsAfter(cloud.updatedAt, syncMeta.lastCloudUpdatedAt)
  }

  function markSynced(updatedAt: string | null) {
    setCloudUpdatedAt(updatedAt)
    setSyncMeta({
      lastCloudUpdatedAt: updatedAt,
      lastLocalChangeAt: updatedAt,
    })
  }

  function openSyncConflict(cloud: CloudSnapshot, message: string) {
    setCloudUpdatedAt(cloud.updatedAt)
    setSyncConflict({
      cloud,
      localChangedAt: syncMeta.lastLocalChangeAt,
      message,
    })
    setCloudStatus({ tone: 'error', message })
  }

  async function fetchCloudSnapshot(): Promise<CloudSnapshot | null> {
    if (!supabase || !user) return null
    return fetchCloudSnapshotApi(supabase, user.id)
  }

  async function writeCloudSnapshot(nextSettings: ChallengeSettings, nextEntries: EntryMap): Promise<string> {
    if (!supabase || !user) throw new Error('Sign in before syncing.')
    return writeCloudSnapshotApi(supabase, user.id, nextSettings, nextEntries)
  }

  async function buildAccountDataExport(): Promise<AccountDataExport> {
    if (!supabase || !user) throw new Error('Sign in before exporting account data.')
    return buildAccountDataExportApi(supabase, user, {
      settings,
      entries,
      privacy: privacySettings,
    })
  }
  async function sendMagicLink() {
    if (!supabase) return
    const email = authEmail.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter an email address first.' })
      return
    }

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      setCloudStatus({ tone: 'success', message: 'Magic link sent. Password sign-in works better for the iPhone Home Screen app.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send the magic link.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function sendPasswordReset() {
    if (!supabase) return
    const email = authEmail.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter your email address first.' })
      return
    }

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      setCloudStatus({ tone: 'success', message: 'Password reset email sent. Open the link, then set a new password here.' })
      showAppNotice('Password reset email sent.')
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send the password reset email.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function signInWithPassword() {
    if (!supabase) return
    const email = authEmail.trim()
    const password = authPassword.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter your email address first.' })
      return
    }

    if (!password) {
      setCloudStatus({ tone: 'error', message: 'Enter your password.' })
      return
    }

    setCloudBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      setUser(data.user ?? data.session?.user ?? null)
      setCloudStatus({ tone: 'success', message: 'Signed in. Push local data or pull cloud data.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not sign in with that email and password.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function createPasswordAccount() {
    if (!supabase) return
    const email = authEmail.trim()
    const password = authPassword.trim()
    if (!email) {
      setCloudStatus({ tone: 'error', message: 'Enter your email address first.' })
      return
    }

    if (password.length < 6) {
      setCloudStatus({ tone: 'error', message: 'Use a password with at least 6 characters.' })
      return
    }

    setCloudBusy(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error

      if (data.session?.user) {
        setUser(data.session.user)
        setCloudStatus({ tone: 'success', message: 'Account created and signed in.' })
        showAppNotice('Password set. Your account is ready.')
      } else {
        setCloudStatus({ tone: 'success', message: 'Account created. If Supabase asks for email confirmation, confirm it once, then sign in here with your password.' })
        showAppNotice('Password saved. Confirm your email if Supabase asks.')
      }
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not create account.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function setAccountPassword() {
    if (!supabase || !user) return
    const password = authPassword.trim()
    if (password.length < 6) {
      setCloudStatus({ tone: 'error', message: 'Use a password with at least 6 characters.' })
      return
    }

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setAuthPassword('')
      setCloudStatus({ tone: 'success', message: 'Password set. Next time, sign in with email and password.' })
      showAppNotice('Password set. You can use email/password next time.')
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not set the password.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function signOut() {
    if (!supabase) return

    setCloudBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setAuthPassword('')
      setCloudUpdatedAt(null)
      setCloudStatus({ tone: 'neutral', message: 'Signed out. Local data is still saved on this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not sign out.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function pushCloudData() {
    if (!supabase || !user) return

    setCloudBusy(true)
    try {
      const cloud = await fetchCloudSnapshot()
      if (cloud && cloudChangedSinceLastSync(cloud)) {
        openSyncConflict(cloud, 'Cloud has changed since this device last synced. Choose how to resolve before pushing.')
        return
      }

      const updatedAt = await writeCloudSnapshot(settings, entries)
      markSynced(updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Local data pushed to cloud.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not push data to cloud.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function pullCloudData() {
    if (!supabase || !user) return

    setCloudBusy(true)
    try {
      const cloud = await fetchCloudSnapshot()
      if (!cloud) {
        setCloudStatus({ tone: 'neutral', message: 'No cloud data found yet. Push this device first.' })
        return
      }

      if (cloudChangedSinceLastSync(cloud) && hasLocalUnsyncedChanges()) {
        openSyncConflict(cloud, 'Both this device and cloud changed since the last sync. Choose how to resolve.')
        return
      }

      const shouldReplace = window.confirm('Pull cloud data and replace local settings and entries on this device?')
      if (!shouldReplace) {
        setCloudStatus({ tone: 'neutral', message: 'Cloud pull canceled.' })
        return
      }

      replaceData(cloud.settings, cloud.entries, false)
      markSynced(cloud.updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Cloud data pulled onto this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not pull cloud data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function exportAccountData() {
    if (!supabase || !user) return

    setCloudBusy(true)
    try {
      const payload = await buildAccountDataExport()
      const filename = `${sanitizeFilenamePart(settings.title)}-${todayIso()}-account-data.json`
      downloadTextFile(filename, 'application/json;charset=utf-8', JSON.stringify(payload, null, 2))
      setCloudStatus({ tone: 'success', message: 'Account data export downloaded.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not export account data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function deleteCloudAccountData() {
    if (!supabase || !user) return

    const confirmed = window.confirm(
      'Delete your cloud sync snapshot, public friend profile, friend requests/friendships, squads, friend challenges, activity events, and leaderboard summaries from Supabase? Local data on this device will stay.',
    )
    if (!confirmed) {
      setCloudStatus({ tone: 'neutral', message: 'Cloud data deletion canceled.' })
      return
    }

    setCloudBusy(true)
    try {
      await deleteCloudAccountDataApi(supabase, user.id)

      setCloudUpdatedAt(null)
      setSyncConflict(null)
      setSyncMeta(DEFAULT_SYNC_META)
      setFriendProfile(null)
      setDisplayNameDraft('')
      setInviteCodeDraft('')
      setLeaderboardRows([])
      setFriendRequests([])
      setFriendChallenges([])
      setFriendSquads([])
      setFriendEvents([])
      setFriendsStatus({ tone: 'neutral', message: 'Cloud friend data deleted.' })
      setCloudStatus({ tone: 'success', message: 'Cloud account data deleted. Local data remains on this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not delete cloud account data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function useCloudConflictVersion() {
    if (!syncConflict) return

    setCloudBusy(true)
    try {
      replaceData(syncConflict.cloud.settings, syncConflict.cloud.entries, false)
      markSynced(syncConflict.cloud.updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Cloud version applied to this device.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not apply cloud version.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function keepLocalConflictVersion() {
    if (!syncConflict || !supabase || !user) return

    setCloudBusy(true)
    try {
      const updatedAt = await writeCloudSnapshot(settings, entries)
      markSynced(updatedAt)
      setSyncConflict(null)
      setCloudStatus({ tone: 'success', message: 'Local version kept and pushed to cloud.' })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not keep local version.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  async function mergeConflictEntries() {
    if (!syncConflict || !supabase || !user) return

    setCloudBusy(true)
    try {
      const mergedEntries = mergeCloudOnlyEntries(entries, syncConflict.cloud.entries)
      const addedCount = countCloudOnlyEntries(entries, syncConflict.cloud.entries)
      const updatedAt = await writeCloudSnapshot(settings, mergedEntries)
      replaceData(settings, mergedEntries, false)
      markSynced(updatedAt)
      setSyncConflict(null)
      setCloudStatus({
        tone: 'success',
        message: addedCount === 0
          ? 'Merged with no cloud-only days to add; local overlapping days were kept.'
          : `Merged ${addedCount} cloud-only ${addedCount === 1 ? 'day' : 'days'} and kept local overlapping days.`,
      })
    } catch (error) {
      setCloudStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not merge cloud and local data.',
      })
    } finally {
      setCloudBusy(false)
    }
  }

  function dismissSyncConflict() {
    setSyncConflict(null)
    setCloudStatus({ tone: 'neutral', message: 'Sync conflict left unresolved.' })
  }

  async function requestReminderPermission() {
    if (!('Notification' in window)) {
      setReminderStatus({ tone: 'error', message: 'This browser does not support notifications.' })
      return
    }

    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      updateReminder({ ...reminderSettings, enabled: true })
      setReminderStatus({ tone: 'success', message: `Reminder scheduled for ${reminderSettings.time}.` })
    } else {
      setReminderStatus({ tone: 'error', message: 'Notifications were not allowed.' })
    }
  }

  async function ensureFriendProfile(): Promise<FriendProfile | null> {
    if (!supabase || !user) return null

    const profile = await ensureFriendProfileApi(supabase, user)
    setFriendProfile(profile)
    setDisplayNameDraft(profile.displayName)
    return profile
  }

  async function refreshFriendsData() {
    if (!supabase || !user) return

    setFriendsBusy(true)
    try {
      const data = await loadSocialDashboard(supabase, user)
      setFriendProfile(data.profile)
      setDisplayNameDraft(data.profile.displayName)
      setLeaderboardRows(data.leaderboardRows)
      setFriendRequests(data.requests)
      setFriendChallenges(data.challenges)
      setFriendSquads(data.squads)
      setFriendEvents(data.events)
      const schemaReady = data.squadSchemaReady && data.historySchemaReady
      setFriendsStatus({
        tone: schemaReady ? 'success' : 'neutral',
        message: schemaReady
          ? `${data.acceptedFriendCount} ${data.acceptedFriendCount === 1 ? 'friend' : 'friends'} · ${data.squads.length} ${data.squads.length === 1 ? 'squad' : 'squads'} · ${data.requests.length} pending · ${data.challenges.length} challenges.`
          : 'Friends loaded. Run the updated Supabase schema to enable all squad and daily-history features.',
      })
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not load friends.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }
  async function saveFriendProfile() {
    if (!supabase || !user) return

    const displayName = displayNameDraft.trim()
    if (!displayName) {
      setFriendsStatus({ tone: 'error', message: 'Display name cannot be empty.' })
      return
    }

    setFriendsBusy(true)
    try {
      await ensureFriendProfile()
      const profile = await updateFriendProfileApi(supabase, user.id, displayName)
      setFriendProfile(profile)
      setDisplayNameDraft(profile.displayName)
      setFriendsStatus({ tone: 'success', message: 'Friend profile saved.' })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not save friend profile.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function copyOwnInviteCode() {
    const inviteCode = friendProfile?.inviteCode
    if (!inviteCode) {
      setFriendsStatus({ tone: 'error', message: 'Invite code is still loading.' })
      showAppNotice('Invite code is still loading.', 'error')
      return
    }

    try {
      await copyTextToClipboard(inviteCode)
      setFriendsStatus({ tone: 'success', message: 'Invite code copied.' })
      showAppNotice('Invite code copied.')
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not copy invite code.',
      })
      showAppNotice('Could not copy invite code.', 'error')
    }
  }

  function buildOwnInviteMessage(): string | null {
    const inviteCode = friendProfile?.inviteCode
    if (!inviteCode) return null

    const name = friendProfile?.displayName || displayNameDraft.trim() || 'me'
    return `Add ${name} on God Mode: ${inviteCode}\n${window.location.origin}`
  }

  async function shareOwnInviteMessage() {
    const inviteMessage = buildOwnInviteMessage()
    if (!inviteMessage) {
      setFriendsStatus({ tone: 'error', message: 'Invite code is still loading.' })
      showAppNotice('Invite code is still loading.', 'error')
      return
    }

    try {
      if ('share' in navigator && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'God Mode invite',
          text: inviteMessage,
        })
        setFriendsStatus({ tone: 'success', message: 'Invite shared.' })
        return
      }

      await copyTextToClipboard(inviteMessage)
      setFriendsStatus({ tone: 'success', message: 'Invite text copied.' })
      showAppNotice('Invite text copied.')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setFriendsStatus({ tone: 'neutral', message: 'Invite share canceled.' })
        return
      }

      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not share invite.',
      })
      showAppNotice('Could not share invite.', 'error')
    }
  }

  async function recordFriendEvent(
    eventType: FriendEventType,
    options: {
      targetUserId?: string | null
      challengeId?: string | null
      squadId?: string | null
      metadata?: Record<string, unknown>
    } = {},
  ) {
    if (!supabase || !user) return
    await recordFriendEventApi(supabase, user.id, eventType, options)
  }

  async function sendFriendRequestByInviteCode() {
    if (!supabase || !user) return

    const inviteCode = inviteCodeDraft.trim().toUpperCase()
    if (!inviteCode) {
      setFriendsStatus({ tone: 'error', message: 'Enter a friend invite code first.' })
      return
    }

    setFriendsBusy(true)
    try {
      await ensureFriendProfile()
      const result = await requestFriendByInviteCode(supabase, user.id, inviteCode)
      if (result.incomingRequest) {
        await respondToFriendRequestApi(supabase, user.id, result.profile.userId, 'accepted')
        await recordFriendEvent('friend_request_accepted', { targetUserId: result.profile.userId })
        setFriendsStatus({ tone: 'success', message: `${result.profile.displayName} accepted.` })
      } else {
        await recordFriendEvent('friend_request_sent', { targetUserId: result.profile.userId })
        setFriendsStatus({ tone: 'success', message: `Friend request sent to ${result.profile.displayName}.` })
      }
      setInviteCodeDraft('')
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not send friend request.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }
  async function respondToFriendRequest(otherUserId: string, nextStatus: 'accepted' | 'declined', successMessage?: string) {
    if (!supabase || !user) return

    setFriendsBusy(true)
    try {
      await respondToFriendRequestApi(supabase, user.id, otherUserId, nextStatus)

      setFriendsStatus({
        tone: 'success',
        message: successMessage ?? (nextStatus === 'accepted' ? 'Friend request accepted.' : 'Friend request declined.'),
      })
      await recordFriendEvent(nextStatus === 'accepted' ? 'friend_request_accepted' : 'friend_request_declined', {
        targetUserId: otherUserId,
      })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update friend request.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function createFriendSquad(input: CreateFriendSquadInput) {
    if (!supabase || !user) return

    const name = input.name.trim()
    if (!name) {
      setFriendsStatus({ tone: 'error', message: 'Squad name cannot be empty.' })
      return
    }
    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const memberIds = Array.from(new Set(input.memberIds)).filter((memberId) => acceptedFriendIds.has(memberId))
    if (memberIds.length === 0) {
      setFriendsStatus({ tone: 'error', message: 'Choose at least one accepted friend for the squad.' })
      return
    }

    setFriendsBusy(true)
    try {
      const squad = await createSquadRecord(supabase, user.id, name, memberIds)
      await recordFriendEvent('squad_created', {
        squadId: squad.id,
        metadata: { squadName: squad.name, memberCount: memberIds.length },
      })
      setFriendsStatus({ tone: 'success', message: `${squad.name} squad created.` })
      showAppNotice('Squad created.')
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not create the squad.' })
    } finally {
      setFriendsBusy(false)
    }
  }
  async function updateFriendSquad(input: UpdateFriendSquadInput) {
    if (!supabase || !user) return

    const name = input.name.trim()
    if (!name) {
      setFriendsStatus({ tone: 'error', message: 'Squad name cannot be empty.' })
      return
    }
    if (!friendSquads.some((squad) => squad.id === input.squadId)) {
      setFriendsStatus({ tone: 'error', message: 'Could not find that squad.' })
      return
    }
    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const memberIds = Array.from(new Set(input.memberIds)).filter((memberId) => acceptedFriendIds.has(memberId))

    setFriendsBusy(true)
    try {
      await updateSquadRecord(supabase, user.id, input.squadId, name, memberIds)
      await recordFriendEvent('squad_updated', {
        squadId: input.squadId,
        metadata: { squadName: name, memberCount: memberIds.length },
      })
      setFriendsStatus({ tone: 'success', message: `${name} squad updated.` })
      showAppNotice('Squad updated.')
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not update the squad.' })
    } finally {
      setFriendsBusy(false)
    }
  }
  async function deleteFriendSquad(squadId: string) {
    if (!supabase || !user) return

    const squad = friendSquads.find((item) => item.id === squadId)
    const confirmed = window.confirm(`Delete ${squad?.name ?? 'this squad'}? Challenges already created will stay.`)
    if (!confirmed) {
      setFriendsStatus({ tone: 'neutral', message: 'Squad deletion canceled.' })
      return
    }

    setFriendsBusy(true)
    try {
      await deleteSquadRecord(supabase, user.id, squadId)

      await recordFriendEvent('squad_deleted', {
        squadId,
        metadata: {
          squadName: squad?.name ?? 'Squad',
        },
      })
      setFriendsStatus({ tone: 'success', message: 'Squad deleted.' })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not delete the squad.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function createFriendChallenge(input: CreateFriendChallengeInput) {
    if (!supabase || !user) return

    const name = input.name.trim()
    if (!name) {
      setFriendsStatus({ tone: 'error', message: 'Challenge name cannot be empty.' })
      return
    }
    if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate) || input.endDate < input.startDate) {
      setFriendsStatus({ tone: 'error', message: 'Choose a valid challenge date range.' })
      return
    }
    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const inviteeIds = Array.from(new Set(input.inviteeIds)).filter((inviteeId) => acceptedFriendIds.has(inviteeId))

    setFriendsBusy(true)
    try {
      await ensureFriendProfile()
      const challengeSettings = buildChallengeSettingsForTemplate(settings, input.templateId, name, input.startDate, input.endDate)
      const challenge = await createChallengeRecord(supabase, user.id, {
        name,
        startDate: input.startDate,
        endDate: input.endDate,
        scoringMode: input.scoringMode,
        settings: challengeSettings,
        inviteeIds,
        ownerSummary: (createdChallenge) => buildFriendChallengeSummary(user.id, entries, createdChallenge, settings, privacySettings),
      })
      await recordFriendEvent('challenge_created', {
        challengeId: challenge.id,
        metadata: { challengeName: challenge.name, inviteCount: inviteeIds.length, templateId: input.templateId ?? 'custom' },
      })
      setFriendsStatus({
        tone: 'success',
        message: inviteeIds.length === 0
          ? 'Challenge created. Invite friends whenever you are ready.'
          : `Challenge created and ${inviteeIds.length} ${inviteeIds.length === 1 ? 'friend was' : 'friends were'} invited.`,
      })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not create the friend challenge.' })
    } finally {
      setFriendsBusy(false)
    }
  }
  async function inviteFriendChallengeParticipants(input: InviteFriendChallengeInput) {
    if (!supabase || !user) return

    const challenge = friendChallenges.find((item) => item.id === input.challengeId)
    if (!challenge) {
      setFriendsStatus({ tone: 'error', message: 'Could not find that challenge.' })
      return
    }
    if (!challenge.isCreator) {
      setFriendsStatus({ tone: 'error', message: 'Only the challenge owner can invite more friends.' })
      return
    }

    const acceptedFriendIds = new Set(leaderboardRows.filter((row) => !row.isCurrentUser).map((row) => row.userId))
    const existingParticipantIds = new Set(challenge.participants.map((participant) => participant.userId))
    const inviteeIds = Array.from(new Set(input.inviteeIds))
      .filter((inviteeId) => acceptedFriendIds.has(inviteeId) && !existingParticipantIds.has(inviteeId))

    if (inviteeIds.length === 0) {
      setFriendsStatus({ tone: 'error', message: 'Choose accepted friends who are not already in the challenge.' })
      return
    }

    setFriendsBusy(true)
    try {
      await inviteChallengeParticipants(supabase, user.id, challenge.id, inviteeIds)

      await recordFriendEvent('challenge_invites_sent', {
        challengeId: challenge.id,
        metadata: {
          challengeName: challenge.name,
          inviteCount: inviteeIds.length,
        },
      })
      setFriendsStatus({
        tone: 'success',
        message: `${inviteeIds.length} ${inviteeIds.length === 1 ? 'friend was' : 'friends were'} invited to ${challenge.name}.`,
      })
      showAppNotice('Challenge invite sent.')
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not invite friends to the challenge.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function respondToFriendChallenge(challengeId: string, nextStatus: 'accepted' | 'declined') {
    if (!supabase || !user) return

    setFriendsBusy(true)
    try {
      const challenge = friendChallenges.find((item) => item.id === challengeId)
      const summary = challenge && nextStatus === 'accepted'
        ? buildFriendChallengeSummary(user.id, entries, challenge, settings, privacySettings)
        : null
      await respondToChallengeInvite(supabase, user.id, challengeId, nextStatus, summary)

      setFriendsStatus({
        tone: 'success',
        message: nextStatus === 'accepted' ? 'Challenge invite accepted.' : 'Challenge invite declined.',
      })
      await recordFriendEvent(nextStatus === 'accepted' ? 'challenge_invite_accepted' : 'challenge_invite_declined', {
        challengeId,
        metadata: {
          challengeName: challenge?.name ?? 'Challenge',
        },
      })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update the challenge invite.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function publishFriendChallengeScore(challengeId: string, note = '', reaction: ScoreReaction | null = null) {
    if (!supabase || !user) return

    const challenge = friendChallenges.find((item) => item.id === challengeId)
    if (!challenge) {
      setFriendsStatus({ tone: 'error', message: 'Could not find that challenge.' })
      return
    }
    if (challenge.currentUserStatus !== 'accepted') {
      setFriendsStatus({ tone: 'error', message: 'Accept the challenge before publishing a score.' })
      return
    }

    setFriendsBusy(true)
    try {
      const cleanNote = note.trim().slice(0, 180)
      const summary = {
        ...buildFriendChallengeSummary(user.id, entries, challenge, settings, privacySettings),
        note: cleanNote,
        reaction,
      }
      const snapshots = buildFriendChallengeSnapshots(user.id, entries, challenge, settings)
      const historyPublished = await publishChallengeScore(supabase, user.id, challengeId, summary, snapshots)

      await recordFriendEvent('challenge_score_published', {
        challengeId,
        metadata: {
          challengeName: challenge.name,
          note: cleanNote,
          reaction,
        },
      })
      setFriendsStatus({
        tone: historyPublished ? 'success' : 'neutral',
        message: historyPublished
          ? `${challenge.name} score and daily history published.`
          : `${challenge.name} score published. Run the updated Supabase schema to add daily history.`,
      })
      await refreshFriendsData()
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not publish the challenge score.',
      })
    } finally {
      setFriendsBusy(false)
    }
  }

  async function publishFriendSummary(silent = false, sourceEntries = entries, sourcePrivacySettings = privacySettings) {
    if (!supabase || !user) return

    if (!silent) setFriendsBusy(true)
    try {
      const profile = await ensureFriendProfile()
      if (!profile) throw new Error('Could not load your friend profile.')

      const summary = buildChallengeSummary(user.id, sourceEntries, settings, sourcePrivacySettings)
      await publishLeaderboardSummary(supabase, summary)
      if (!silent) {
        await recordFriendEvent('leaderboard_score_published')
      }
      await refreshFriendsData()
      if (!silent) setFriendsStatus({ tone: 'success', message: 'Leaderboard score published.' })
    } catch (error) {
      setFriendsStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not publish leaderboard score.',
      })
    } finally {
      if (!silent) setFriendsBusy(false)
    }
  }

  function toggleRule(key: RuleKey) {
    if (entryFinalized) return
    const next = !ruleComplete(entry, key, settings)
    switch (key) {
      case 'exercise':
        if (next) {
          const workout = {
            ...makeEmptyWorkout(),
            type: 'Workout',
            minutes: settings.targets.exerciseMinutes,
          }
          updateEntry({ exerciseMinutes: workout.minutes, workouts: [workout] })
        } else {
          updateEntry({ exerciseMinutes: 0, workouts: [] })
        }
        break
      case 'sober':
        updateEntry({ sober: next })
        break
      case 'foodLogged':
        updateEntry({ foodLogged: next })
        break
      case 'calories':
        updateEntry({ calories: next ? settings.targets.calories : null })
        break
      case 'protein':
        updateEntry({ proteinGrams: next ? settings.targets.proteinGrams : 0 })
        break
      case 'water':
        updateEntry({ waterLiters: next ? settings.targets.waterLiters : null })
        break
      case 'sleep':
        updateEntry({ sleepHours: next ? settings.targets.sleepHours : null })
        break
      case 'reading':
        updateEntry({ readTenPages: next })
        break
      case 'journal':
        updateEntry({ journaled: next })
        break
      default:
        updateEntry({
          ruleCompletions: {
            ...entry.ruleCompletions,
            [key]: next,
          },
        })
        break
    }
  }

  async function installApp() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const friendsBadgeCount = friendRequests.filter((request) => request.direction === 'incoming').length
    + friendChallenges.filter((challenge) => challenge.currentUserStatus === 'pending' && !challenge.isCreator).length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">⚡</div>
        <div>
          <p className="eyebrow">Daily tracker</p>
          <h1>{settings.title}</h1>
        </div>
        <div className="topbar-actions">
          <span className={`save-status ${savePulse ? 'is-saving' : ''}`}>
            {savePulse ? 'Saved' : 'Local'}
          </span>
          {installPrompt && (
            <button className="install-button" type="button" onClick={installApp}>
              Install
            </button>
          )}
          <button className="install-button" type="button" onClick={openTutorial}>
            Guide
          </button>
        </div>
      </header>
      {appNotice && <AppNoticeToast notice={appNotice} onDismiss={() => setAppNotice(null)} />}

      <main>
        <section className="date-strip" aria-label="Selected day">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setSelectedDate((date) => clampDate(addDays(date, -1), settings))}
            disabled={selectedDate === settings.startDate}
          >
            ‹
          </button>
          <label>
            <span>Tracking day {dayNumber(selectedDate, settings)}</span>
            <input
              type="date"
              min={settings.startDate}
              max={latestSelectableDate}
              value={selectedDate}
              onChange={(event) => setSelectedDate(clampDate(event.target.value, settings))}
            />
          </label>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => setSelectedDate((date) => clampDate(addDays(date, 1), settings))}
            disabled={selectedDate === latestSelectableDate}
          >
            ›
          </button>
        </section>

        {!trackerHasStarted && (
          <section className="prep-banner">
            <span>PREP MODE</span>
            <p>Tracking starts {formatDate(settings.startDate)}.</p>
          </section>
        )}

        {view === 'home' && (
          <Dashboard
            entry={entry}
            entries={entries}
            selectedDate={selectedDate}
            settings={settings}
            completed={stats.completed}
            totalRules={stats.total}
            percent={stats.percent}
            latestWeight={latestWeight}
            isFinalized={entryFinalized}
            onToggleRule={toggleRule}
            onOpenCheckIn={() => setView('check-in')}
            onFinalizeDay={finalizeSelectedDay}
            onUnlockDay={unlockSelectedDay}
          />
        )}

        {view === 'check-in' && (
          <Suspense fallback={(
            <section className="panel focus-panel">
              <p className="eyebrow">Loading</p>
              <h2>Opening Check-In.</h2>
              <p>Preparing today’s inputs.</p>
            </section>
          )}>
            <CheckInView
              entry={entry}
              settings={settings}
              isFinalized={entryFinalized}
              onUpdate={updateEntryIfUnlocked}
              onFinalizeDay={finalizeSelectedDay}
              onUnlockDay={unlockSelectedDay}
            />
          </Suspense>
        )}
        {view === 'calendar' && (
          <CalendarView
            entries={entries}
            selectedDate={selectedDate}
            settings={settings}
            onSelectDate={(date) => {
              setSelectedDate(date)
              setView('home')
            }}
          />
        )}
        {view === 'progress' && (
          <Suspense fallback={(
            <section className="panel focus-panel">
              <p className="eyebrow">Loading</p>
              <h2>Opening Progress.</h2>
              <p>Preparing charts and recaps.</p>
            </section>
          )}>
            <ProgressView entries={entries} settings={settings} />
          </Suspense>
        )}
        {view === 'friends' && (
          <Suspense fallback={(
            <section className="panel focus-panel">
              <p className="eyebrow">Loading</p>
              <h2>Opening Friends.</h2>
              <p>Getting the competition tools ready.</p>
            </section>
          )}>
            <FriendsView
              configured={isSupabaseConfigured}
              user={user}
              profile={friendProfile}
              displayName={displayNameDraft}
              inviteCode={inviteCodeDraft}
              leaderboardRows={leaderboardRows}
              friendRequests={friendRequests}
              friendChallenges={friendChallenges}
              friendSquads={friendSquads}
              friendEvents={friendEvents}
              privacySettings={privacySettings}
              status={friendsStatus}
              busy={friendsBusy}
              onDisplayNameChange={setDisplayNameDraft}
              onInviteCodeChange={setInviteCodeDraft}
              onSaveProfile={saveFriendProfile}
              onCopyInviteCode={copyOwnInviteCode}
              onShareInviteMessage={shareOwnInviteMessage}
              onPrivacyChange={updatePrivacy}
              onAddFriend={sendFriendRequestByInviteCode}
              onAcceptRequest={(userId) => respondToFriendRequest(userId, 'accepted')}
              onDeclineRequest={(userId) => respondToFriendRequest(userId, 'declined')}
              onCreateSquad={createFriendSquad}
              onUpdateSquad={updateFriendSquad}
              onDeleteSquad={deleteFriendSquad}
              onCreateChallenge={createFriendChallenge}
              onInviteChallengeParticipants={inviteFriendChallengeParticipants}
              onAcceptChallenge={(challengeId) => respondToFriendChallenge(challengeId, 'accepted')}
              onDeclineChallenge={(challengeId) => respondToFriendChallenge(challengeId, 'declined')}
              onPublishChallengeScore={publishFriendChallengeScore}
              onPublishSummary={() => publishFriendSummary(false)}
              onRefresh={refreshFriendsData}
              onOpenSettings={() => setView('settings')}
            />
          </Suspense>
        )}
        {view === 'settings' && (
          <Suspense fallback={(
            <section className="panel focus-panel">
              <p className="eyebrow">Loading</p>
              <h2>Opening Settings.</h2>
              <p>Preparing tracker controls.</p>
            </section>
          )}>
            <SettingsView
              settings={settings}
              entries={entries}
              reminderSettings={reminderSettings}
              reminderStatus={reminderStatus}
              cloudConfigured={isSupabaseConfigured}
              cloudStatus={cloudStatus}
              cloudBusy={cloudBusy}
              cloudUpdatedAt={cloudUpdatedAt}
              syncConflict={syncConflict}
              user={user}
              authEmail={authEmail}
              authPassword={authPassword}
              onSettingsChange={updateSettings}
              onDataImport={replaceData}
              onReminderChange={updateReminder}
              onRequestReminderPermission={requestReminderPermission}
              onAuthEmailChange={setAuthEmail}
              onAuthPasswordChange={setAuthPassword}
              onSignInWithPassword={signInWithPassword}
              onCreatePasswordAccount={createPasswordAccount}
              onSetAccountPassword={setAccountPassword}
              onSendMagicLink={sendMagicLink}
              onSendPasswordReset={sendPasswordReset}
              onSignOut={signOut}
              onPushCloud={pushCloudData}
              onPullCloud={pullCloudData}
              onExportAccountData={exportAccountData}
              onDeleteCloudAccountData={deleteCloudAccountData}
              onUseCloudVersion={useCloudConflictVersion}
              onKeepLocalVersion={keepLocalConflictVersion}
              onMergeCloudEntries={mergeConflictEntries}
              onDismissConflict={dismissSyncConflict}
            />
          </Suspense>
        )}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <NavButton label="Home" icon="home" active={view === 'home'} onClick={() => setView('home')} />
        <NavButton label="Check-In" icon="check" active={view === 'check-in'} onClick={() => setView('check-in')} />
        <NavButton label="Calendar" icon="calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
        <NavButton label="Progress" icon="progress" active={view === 'progress'} onClick={() => setView('progress')} />
        <NavButton label="Friends" icon="friends" active={view === 'friends'} onClick={() => setView('friends')} badgeCount={friendsBadgeCount} />
        <NavButton label="Settings" icon="settings" active={view === 'settings'} onClick={() => setView('settings')} />
      </nav>
      {showTutorial && (
        <TutorialOverlay
          step={tutorialStep}
          onStepChange={setTutorialStep}
          onClose={() => closeTutorial(true)}
          onNavigate={(nextView) => {
            setView(nextView)
            closeTutorial(true)
          }}
        />
      )}
    </div>
  )
}

function TutorialOverlay({
  step,
  onStepChange,
  onClose,
  onNavigate,
}: {
  step: number
  onStepChange: (step: number) => void
  onClose: () => void
  onNavigate: (view: View) => void
}) {
  const currentStep = TUTORIAL_STEPS[step] ?? TUTORIAL_STEPS[0]
  const isFirst = step === 0
  const isLast = step === TUTORIAL_STEPS.length - 1
  const targetView: View = step === 1 ? 'check-in' : step === 3 ? 'settings' : step === 4 ? 'friends' : 'home'
  const targetLabel = targetView === 'check-in' ? 'Open Check-In' : `Open ${targetView.charAt(0).toUpperCase()}${targetView.slice(1)}`

  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section className="tutorial-panel">
        <div className="tutorial-header">
          <div>
            <p className="eyebrow">{currentStep.eyebrow}</p>
            <h2 id="tutorial-title">{currentStep.title}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Skip
          </button>
        </div>
        <p>{currentStep.body}</p>
        <div className="tutorial-progress" aria-label="Tutorial progress">
          {TUTORIAL_STEPS.map((tutorialStep, index) => (
            <span className={index === step ? 'active' : ''} key={tutorialStep.title} />
          ))}
        </div>
        <div className="tutorial-actions">
          <button className="ghost-button" type="button" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={isFirst}>
            Back
          </button>
          <button className="secondary-button" type="button" onClick={() => onNavigate(targetView)}>
            {targetLabel}
          </button>
          {isLast ? (
            <button className="primary-button" type="button" onClick={onClose}>
              Finish
            </button>
          ) : (
            <button className="primary-button" type="button" onClick={() => onStepChange(Math.min(TUTORIAL_STEPS.length - 1, step + 1))}>
              Next
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

function Dashboard({
  entry,
  entries,
  selectedDate,
  settings,
  completed,
  totalRules,
  percent,
  latestWeight,
  isFinalized,
  onToggleRule,
  onOpenCheckIn,
  onFinalizeDay,
  onUnlockDay,
}: {
  entry: DailyEntry
  entries: EntryMap
  selectedDate: string
  settings: ChallengeSettings
  completed: number
  totalRules: number
  percent: number
  latestWeight: number | undefined
  isFinalized: boolean
  onToggleRule: (key: RuleKey) => void
  onOpenCheckIn: () => void
  onFinalizeDay: () => void
  onUnlockDay: () => void
}) {
  const activeRules = getEnabledRules(settings)

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">{formatDate(selectedDate)}</p>
          <h2>{isFinalized ? 'Day finalized.' : percent === 100 ? 'God mode secured.' : 'Build the day.'}</h2>
          <p>{completed} of {totalRules} rules complete{isFinalized && entry.finalizedAt ? ` · ${formatDateTime(entry.finalizedAt)}` : ''}</p>
        </div>
        <div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` } as CSSProperties}>
          <div>
            <strong>{percent}%</strong>
            <span>today</span>
          </div>
        </div>
      </section>

      <section className="stats-grid" aria-label="Tracker summary">
        <StatCard label="Current streak" value={`${currentStreak(entries, selectedDate, settings)} days`} icon="🔥" />
        <StatCard label="Longest streak" value={`${longestStreak(entries, settings)} days`} icon="🏆" />
        <StatCard label="Latest weight" value={latestWeight ? `${latestWeight.toFixed(1)} lb` : '—'} icon="◒" />
      </section>

      <section className="panel rules-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Daily standards</p>
            <h2>Today’s Rules</h2>
          </div>
          <span>{completed}/{totalRules}</span>
        </div>

        <div className="rule-list">
          {activeRules.map((rule) => {
            const isComplete = ruleComplete(entry, rule.key, settings)
            const detail = ruleDetail(rule, entry, settings)

            return (
              <button
                className={`rule-row ${isComplete ? 'is-complete' : ''}`}
                type="button"
                key={rule.key}
                onClick={() => onToggleRule(rule.key)}
                disabled={isFinalized}
              >
                <span className="rule-icon">{rule.icon}</span>
                <span className="rule-label">
                  <strong>{rule.label}</strong>
                  <small>{detail ?? (rule.weight === 'nonNegotiable' ? 'Non-negotiable' : 'Supporting')}</small>
                </span>
                <span className="rule-check" aria-label={isComplete ? 'Complete' : 'Incomplete'}>
                  {isComplete ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>

        <button className="primary-button" type="button" onClick={onOpenCheckIn}>
          Open full check-in
        </button>
        {isFinalized ? (
          <button className="secondary-button" type="button" onClick={onUnlockDay}>
            Unlock Day
          </button>
        ) : (
          <button className="secondary-button" type="button" onClick={onFinalizeDay}>
            Finalize Day
          </button>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <article className="stat-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  )
}

function CalendarView({
  entries,
  selectedDate,
  settings,
  onSelectDate,
}: {
  entries: EntryMap
  selectedDate: string
  settings: ChallengeSettings
  onSelectDate: (date: string) => void
}) {
  const monthStart = `${selectedDate.slice(0, 7)}-01`
  const monthEnd = addDays(addDays(monthStart, 32).slice(0, 8) + '01', -1)
  const maxDate = selectableEndDate(settings)
  const startDate = monthStart < settings.startDate ? settings.startDate : monthStart
  const endDate = monthEnd > maxDate ? maxDate : monthEnd
  const dates = endDate >= startDate
    ? Array.from({ length: daysBetween(startDate, endDate) + 1 }, (_, index) => addDays(startDate, index))
    : []
  const leadingBlanks = new Date(`${monthStart}T12:00:00`).getDay()
  const cells = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ type: 'blank' as const, key: `blank-${index}` })),
    ...dates.map((date) => ({ type: 'day' as const, date, key: date })),
  ]

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Consistency map</p>
        <h2>{formatMonthLabel(selectedDate)}</h2>
        <p>Green means 80% or better. Tap any tracked date to open it.</p>
      </section>
      <section className="panel calendar-panel">
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid">
          {cells.map((cell) => {
            if (cell.type === 'blank') return <span className="calendar-blank" key={cell.key} />
            const dayEntry = entries[cell.date]
            const score = dayEntry ? completionStats(dayEntry, settings).percent : null
            const status = score === null ? 'empty' : score >= 80 ? 'great' : score >= 50 ? 'good' : 'low'
            return (
              <button
                type="button"
                key={cell.key}
                className={`calendar-day ${status} ${selectedDate === cell.date ? 'selected' : ''}`}
                onClick={() => onSelectDate(cell.date)}
              >
                <strong>{calendarCellLabel(cell.date, settings)}</strong>
                <small>{score === null ? '—' : `${score}%`}</small>
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span><i className="legend-great" />80–100%</span>
          <span><i className="legend-good" />50–79%</span>
          <span><i className="legend-low" />0–49%</span>
        </div>
      </section>
    </div>
  )
}

export default App
