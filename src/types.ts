export type View = 'home' | 'check-in' | 'calendar' | 'progress' | 'friends' | 'settings'

export type BuiltInRuleKey = 'exercise' | 'sober' | 'foodLogged' | 'calories' | 'protein' | 'water' | 'sleep' | 'reading' | 'journal'
export type CustomRuleKey = `custom-${string}`
export type RuleKey = BuiltInRuleKey | CustomRuleKey
export type RuleWeight = 'nonNegotiable' | 'supporting'
export type RuleCategoryKey = string

export type RuleCategoryConfig = {
  key: RuleCategoryKey
  label: string
}

export type RuleConfig = {
  key: RuleKey
  label: string
  icon: string
  enabled: boolean
  weight: RuleWeight
  category: RuleCategoryKey
  deleted?: boolean
}

export type ChallengeTargets = {
  exerciseMinutes: number
  calories: number
  proteinGrams: number
  waterLiters: number
  sleepHours: number
}

export type ChallengeSettings = {
  title: string
  startDate: string
  endDate: string
  targets: ChallengeTargets
  categories: RuleCategoryConfig[]
  rules: RuleConfig[]
}

export type WorkoutLog = {
  id: string
  type: string
  minutes: number
}

export type DailyEntry = {
  date: string
  exerciseMinutes: number
  workouts: WorkoutLog[]
  sober: boolean
  foodLogged: boolean
  finalizedAt: string | null
  calories: number | null
  proteinGrams: number | null
  waterLiters: number | null
  weightPounds: number | null
  readTenPages: boolean
  journaled: boolean
  ruleCompletions: Record<string, boolean>
  mood: number
  energy: number
  hunger: number
  sleepHours: number | null
  wentWell: string
  difficult: string
}

export type EntryMap = Record<string, DailyEntry>

export type BackupPayload = {
  app: 'god-mode-july'
  version: 1
  exportedAt: string
  settings: ChallengeSettings
  entries: EntryMap
}

export type SyncMeta = {
  lastCloudUpdatedAt: string | null
  lastLocalChangeAt: string | null
}

export type CloudSnapshot = {
  settings: ChallengeSettings
  entries: EntryMap
  updatedAt: string | null
}

export type SyncConflict = {
  cloud: CloudSnapshot
  localChangedAt: string | null
  message: string
}

export type AccountDataExport = {
  app: 'god-mode-july'
  exportType: 'account-data'
  exportedAt: string
  user: {
    id: string
    email: string | null
  }
  local: {
    settings: ChallengeSettings
    entries: EntryMap
    privacy: PrivacySettings
  }
  cloud: {
    snapshot: CloudSnapshot | null
    profile: FriendProfile | null
    friendships: FriendshipRow[]
    summary: ChallengeSummary | null
    friendChallenges: FriendChallenge[]
    friendChallengeParticipants: FriendChallengeParticipant[]
    friendSquads: FriendSquad[]
    friendSquadMembers: FriendSquadMember[]
    friendEvents: FriendEvent[]
  }
}

export type DataStatus = {
  tone: 'success' | 'error' | 'neutral'
  message: string
}

export type AppNotice = {
  id: number
  tone: 'success' | 'error' | 'neutral'
  message: string
}

export type PrivacySettings = {
  showWeeklyCompletion: boolean
  showAverageCompletion: boolean
  showStreak: boolean
  showLoggedDays: boolean
}

export type RuleRate = RuleConfig & {
  rate: number
}

export type ProgressPeriod = 'week' | 'month'

export type PeriodRecap = {
  label: string
  startDate: string
  endDate: string
  totalDays: number
  loggedDays: number
  averageCompletion: number
  bestRule: RuleRate | null
  weakestRule: RuleRate | null
  averageSleep: number | null
  averageCalories: number | null
  averageMood: number | null
  weightChange: number | null
  reflectionCount: number
}

export type TrendMetricKey = 'weight' | 'sleep' | 'calories' | 'mood'

export type TrendMetric = {
  key: TrendMetricKey
  label: string
  unit: string
  color: string
  emptyLabel: string
  format: (value: number) => string
  getValue: (entry: DailyEntry) => number | null
}

export type TrendPoint = {
  date: string
  value: number
}

export type ReminderSettings = {
  enabled: boolean
  time: string
  message: string
}

export type FriendProfile = {
  userId: string
  displayName: string
  inviteCode: string
}

export type ScoreReaction = 'locked-in' | 'comeback' | 'streak' | 'respect'

export type ChallengeSummary = {
  userId: string
  challengeTitle: string
  startDate: string
  endDate: string
  loggedDays: number
  totalDays: number
  averageCompletion: number
  weeklyCompletion: number
  currentStreak: number
  longestStreak: number
  lastLoggedDate: string | null
  updatedAt: string
  privacy: PrivacySettings
  note?: string
  reaction?: ScoreReaction | null
}

export type LeaderboardRow = FriendProfile & {
  summary: ChallengeSummary | null
  isCurrentUser: boolean
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined'

export type FriendshipRow = {
  userA: string
  userB: string
  createdBy: string
  requestedBy: string
  status: FriendshipStatus
  createdAt: string
  respondedAt: string | null
}

export type FriendRequest = FriendProfile & {
  userA: string
  userB: string
  requestedBy: string
  direction: 'incoming' | 'outgoing'
  createdAt: string
}

export type FriendChallengeScoringMode = 'personal' | 'shared'
export type FriendChallengeParticipantStatus = 'pending' | 'accepted' | 'declined'

export type FriendChallenge = {
  id: string
  creatorId: string
  name: string
  startDate: string
  endDate: string
  scoringMode: FriendChallengeScoringMode
  settings: ChallengeSettings
  createdAt: string
  updatedAt: string
}

export type FriendChallengeParticipant = {
  challengeId: string
  userId: string
  invitedBy: string
  status: FriendChallengeParticipantStatus
  summary: ChallengeSummary | null
  createdAt: string
  respondedAt: string | null
}

export type FriendChallengeParticipantView = FriendProfile & {
  invitedBy: string
  status: FriendChallengeParticipantStatus
  summary: ChallengeSummary | null
  createdAt: string
  respondedAt: string | null
  isCurrentUser: boolean
}

export type FriendChallengeView = FriendChallenge & {
  currentUserStatus: FriendChallengeParticipantStatus
  isCreator: boolean
  participants: FriendChallengeParticipantView[]
}

export type FriendSquad = {
  id: string
  ownerId: string
  name: string
  createdAt: string
  updatedAt: string
}

export type FriendSquadMember = {
  squadId: string
  userId: string
  addedBy: string
  createdAt: string
}

export type FriendSquadView = FriendSquad & {
  members: FriendProfile[]
}

export type CreateFriendChallengeInput = {
  name: string
  startDate: string
  endDate: string
  scoringMode: FriendChallengeScoringMode
  inviteeIds: string[]
  templateId?: string
}

export type CreateFriendSquadInput = {
  name: string
  memberIds: string[]
}

export type UpdateFriendSquadInput = CreateFriendSquadInput & {
  squadId: string
}

export type InviteFriendChallengeInput = {
  challengeId: string
  inviteeIds: string[]
}

export type ChallengeTemplate = {
  id: string
  name: string
  durationDays: number
  scoringMode: FriendChallengeScoringMode
  note: string
  targetOverrides?: Partial<ChallengeTargets>
  ruleOverrides?: Partial<Record<BuiltInRuleKey, Partial<Pick<RuleConfig, 'enabled' | 'weight' | 'category'>>>>
}

export type FriendsTab = 'overview' | 'network' | 'squads' | 'challenges' | 'leaderboard'

export type FriendEventType =
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_request_declined'
  | 'squad_created'
  | 'squad_updated'
  | 'squad_deleted'
  | 'challenge_created'
  | 'challenge_invites_sent'
  | 'challenge_invite_accepted'
  | 'challenge_invite_declined'
  | 'challenge_score_published'
  | 'leaderboard_score_published'

export type FriendEvent = {
  id: string
  actorId: string
  targetUserId: string | null
  challengeId: string | null
  squadId: string | null
  eventType: FriendEventType
  metadata: Record<string, unknown>
  createdAt: string
}

export type FriendActivityFeedItem = {
  id: string
  title: string
  detail: string
  meta: string
  tone: 'success' | 'pending' | 'neutral'
  sortAt: string
}

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
