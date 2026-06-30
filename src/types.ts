export type View = 'home' | 'check-in' | 'progress' | 'friends' | 'settings'

export type BuiltInRuleKey = 'exercise' | 'sober' | 'foodLogged' | 'calories' | 'protein' | 'water' | 'sleep' | 'reading' | 'journal'
export type CustomRuleKey = `custom-${string}`
export type RuleKey = BuiltInRuleKey | CustomRuleKey
export type RuleWeight = 'nonNegotiable' | 'supporting'
export type RuleCategoryKey = string
export type ExerciseCycleDays = 1 | 7 | 30
export type DietGoalType = 'minimum' | 'maximum' | 'avoid'
export type DietTrackingSource = 'manual' | 'calories' | 'protein' | 'carbs' | 'fat' | 'sodium' | 'foodCategory'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type FoodCategory = 'alcohol' | 'dessert' | 'fruit' | 'vegetable' | 'protein' | 'grain' | 'dairy' | 'other'
export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentColor = 'violet' | 'blue' | 'teal' | 'coral' | 'gold'

export type AppearanceSettings = {
  theme: ThemeMode
  accent: AccentColor
}

export type ExerciseRuleSettings = {
  cycleDays: ExerciseCycleDays
  scheduledDays: number[]
  workoutType: string
  targetMinutes: number
}

export type ExercisePatternProgress = {
  cycleStart: string
  cycleEnd: string
  scheduledDates: string[]
  completedDates: string[]
  reachedDates: string[]
  nextScheduledDate: string | null
}

export type DietRuleSettings = {
  goalType: DietGoalType
  goal: number
  unit: string
  trackingSource?: DietTrackingSource
  foodCategory?: FoodCategory
}

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
  exercise?: ExerciseRuleSettings
  diet?: DietRuleSettings
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
  appearance: AppearanceSettings
  targets: ChallengeTargets
  categories: RuleCategoryConfig[]
  rules: RuleConfig[]
}

export type WorkoutLog = {
  id: string
  type: string
  minutes: number
}

export type FoodLog = {
  id: string
  meal: MealType
  name: string
  calories: number
  proteinGrams: number
  carbsGrams: number
  fatGrams: number
  sodiumMg: number
  categories: FoodCategory[]
}

export type FoodNutritionTotals = {
  calories: number
  proteinGrams: number
  carbsGrams: number
  fatGrams: number
  sodiumMg: number
}

export type DailyEntry = {
  date: string
  exerciseMinutes: number
  workouts: WorkoutLog[]
  foods: FoodLog[]
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
  ruleValues: Record<string, number>
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
    challengeScoreSnapshots: ChallengeScoreSnapshot[]
    friendSquads: FriendSquad[]
    friendSquadMembers: FriendSquadMember[]
    friendEvents: FriendEvent[]
    friendEventComments: FriendEventComment[]
    friendEventReactions: FriendEventReaction[]
  }
}

export type DataStatus = {
  tone: 'success' | 'error' | 'neutral'
  message: string
  retryable?: boolean
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

export type FriendChallengeScoringMode = 'personal' | 'shared' | 'softShared' | 'percentOnly'
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

export type ChallengeScoreSnapshot = {
  challengeId: string
  userId: string
  date: string
  completionPercent: number
  completedRules: number
  totalRules: number
  publishedAt: string
}

export type FriendChallengeParticipantView = FriendProfile & {
  invitedBy: string
  status: FriendChallengeParticipantStatus
  summary: ChallengeSummary | null
  createdAt: string
  respondedAt: string | null
  isCurrentUser: boolean
  history: ChallengeScoreSnapshot[]
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
  ruleKeys: RuleKey[]
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

export type FriendsTab = 'overview' | 'friends' | 'squads' | 'challenges' | 'leaderboard'

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
  comments: FriendEventComment[]
  reactions: FriendEventReaction[]
}

export type FriendFeedReaction = 'strong' | 'respect' | 'inspired'

export type FriendEventComment = {
  id: string
  eventId: string
  userId: string
  body: string
  createdAt: string
  updatedAt: string
}

export type FriendEventReaction = {
  eventId: string
  userId: string
  reaction: FriendFeedReaction
  createdAt: string
}

export type FriendActivityComment = FriendEventComment & {
  displayName: string
  isCurrentUser: boolean
}

export type FriendActivityReaction = {
  key: FriendFeedReaction
  label: string
  count: number
  selected: boolean
}

export type FriendActivityFeedItem = {
  id: string
  eventId: string | null
  challengeId?: string | null
  title: string
  detail: string
  meta: string
  tone: 'success' | 'pending' | 'neutral'
  sortAt: string
  shareText: string
  comments: FriendActivityComment[]
  reactions: FriendActivityReaction[]
}

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
