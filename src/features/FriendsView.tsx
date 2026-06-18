import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  CHALLENGE_TEMPLATES,
  FRIEND_FEED_REACTIONS,
  FRIENDS_TABS,
  SCORE_REACTIONS,
  challengeTemplateById,
  describeTemplateOverrides,
  isChallengeCompleted,
  normalizeScoreReaction,
  reactionLabel,
  statusLabel,
} from '../social'
import type {
  ChallengeSettings,
  ChallengeSummary,
  CreateFriendChallengeInput,
  CreateFriendSquadInput,
  DataStatus,
  FriendActivityFeedItem,
  FriendChallengeScoringMode,
  FriendChallengeView,
  FriendEvent,
  FriendFeedReaction,
  FriendProfile,
  FriendRequest,
  FriendSquadView,
  FriendsTab,
  InviteFriendChallengeInput,
  LeaderboardRow,
  PrivacySettings,
  RuleConfig,
  RuleKey,
  ScoreReaction,
  UpdateFriendSquadInput,
} from '../types'
import { buildChallengeSettingsForTemplate } from '../socialData'
import { CheckField, TextArea, TextField } from '../ui'

function addDays(date: string, amount: number): string {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + amount)
  return next.toISOString().slice(0, 10)
}

function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function getEnabledRules(settings: ChallengeSettings): RuleConfig[] {
  return settings.rules.filter((rule) => rule.enabled && !rule.deleted)
}

function sortLeaderboardRows(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    const aSummary = a.summary
    const bSummary = b.summary
    return (bSummary?.weeklyCompletion ?? 0) - (aSummary?.weeklyCompletion ?? 0)
      || (bSummary?.averageCompletion ?? 0) - (aSummary?.averageCompletion ?? 0)
      || (bSummary?.currentStreak ?? 0) - (aSummary?.currentStreak ?? 0)
      || a.displayName.localeCompare(b.displayName)
  })
}

function getSquadLeaderboardRows(squad: FriendSquadView, leaderboardRows: LeaderboardRow[]): LeaderboardRow[] {
  const squadMemberIds = new Set(squad.members.map((member) => member.userId))
  return sortLeaderboardRows(
    leaderboardRows.filter((row) => row.isCurrentUser || squadMemberIds.has(row.userId)),
  )
}

function formatActivityDate(value: string): string {
  const date = value.slice(0, 10)
  return isIsoDate(date) ? formatShortDate(date) : 'Recently'
}

function buildFriendActivityFeed({
  leaderboardRows,
  friendRequests,
  friendChallenges,
  friendSquads,
}: {
  leaderboardRows: LeaderboardRow[]
  friendRequests: FriendRequest[]
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
}): FriendActivityFeedItem[] {
  const feed: FriendActivityFeedItem[] = []

  for (const request of friendRequests) {
    feed.push({
      id: `request-${request.userA}-${request.userB}`,
      eventId: null,
      title: request.direction === 'incoming' ? 'Friend request received' : 'Friend request sent',
      detail: request.direction === 'incoming'
        ? `${request.displayName} wants to connect.`
        : `Waiting for ${request.displayName} to respond.`,
      meta: formatActivityDate(request.createdAt),
      tone: 'pending',
      sortAt: request.createdAt,
      shareText: `${request.displayName} joined your God Mode network.`,
      comments: [],
      reactions: [],
    })
  }

  for (const squad of friendSquads) {
    feed.push({
      id: `squad-${squad.id}`,
      eventId: null,
      title: `${squad.name} squad`,
      detail: squad.members.length === 0
        ? 'No active members yet.'
        : `${squad.members.length} ${squad.members.length === 1 ? 'member' : 'members'} ready for challenges.`,
      meta: formatActivityDate(squad.updatedAt),
      tone: squad.members.length > 0 ? 'success' : 'neutral',
      sortAt: squad.updatedAt,
      shareText: `${squad.name} is getting ready in God Mode.`,
      comments: [],
      reactions: [],
    })
  }

  for (const challenge of friendChallenges) {
    const acceptedCount = challenge.participants.filter((participant) => participant.status === 'accepted').length
    const pendingCount = challenge.participants.filter((participant) => participant.status === 'pending').length
    feed.push({
      id: `challenge-${challenge.id}`,
      eventId: null,
      title: challenge.currentUserStatus === 'pending' && !challenge.isCreator ? 'Challenge invite waiting' : challenge.name,
      detail: challenge.currentUserStatus === 'pending' && !challenge.isCreator
        ? `Accept or decline ${challenge.name}.`
        : `${acceptedCount} active · ${pendingCount} invited.`,
      meta: `${formatShortDate(challenge.startDate)} - ${formatShortDate(challenge.endDate)}`,
      tone: challenge.currentUserStatus === 'pending' && !challenge.isCreator ? 'pending' : 'neutral',
      sortAt: challenge.updatedAt,
      shareText: `${challenge.name} runs ${formatShortDate(challenge.startDate)} - ${formatShortDate(challenge.endDate)} in God Mode.`,
      comments: [],
      reactions: [],
    })
  }

  for (const row of leaderboardRows) {
    if (row.isCurrentUser || !row.summary) continue
    feed.push({
      id: `summary-${row.userId}-${row.summary.updatedAt}`,
      eventId: null,
      title: `${row.displayName} published a score`,
      detail: `${formatSummaryMetric(row.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)} last 7 days.`,
      meta: formatActivityDate(row.summary.updatedAt),
      tone: 'success',
      sortAt: row.summary.updatedAt,
      shareText: `${row.displayName} published a ${row.summary.weeklyCompletion}% 7-day score in God Mode.`,
      comments: [],
      reactions: [],
    })
  }

  return feed
    .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime())
    .slice(0, 10)
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function eventProfileName(userId: string | null, profilesByUserId: Map<string, FriendProfile>, currentUserId: string | null): string {
  if (!userId) return 'Someone'
  if (currentUserId && userId === currentUserId) return 'You'
  return profilesByUserId.get(userId)?.displayName ?? 'A friend'
}

function buildStoredFriendActivityFeed({
  friendEvents,
  leaderboardRows,
  friendChallenges,
  friendSquads,
  currentUserId,
}: {
  friendEvents: FriendEvent[]
  leaderboardRows: LeaderboardRow[]
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
  currentUserId: string | null
}): FriendActivityFeedItem[] {
  const profilesByUserId = new Map<string, FriendProfile>(
    leaderboardRows.map((row) => [row.userId, {
      userId: row.userId,
      displayName: row.displayName,
      inviteCode: row.inviteCode,
    }]),
  )
  const challengesById = new Map(friendChallenges.map((challenge) => [challenge.id, challenge]))
  const squadsById = new Map(friendSquads.map((squad) => [squad.id, squad]))

  return friendEvents.map((event) => {
    const actor = eventProfileName(event.actorId, profilesByUserId, currentUserId)
    const target = eventProfileName(event.targetUserId, profilesByUserId, currentUserId)
    const eventChallengeName = event.challengeId ? challengesById.get(event.challengeId)?.name ?? '' : ''
    const eventSquadName = event.squadId ? squadsById.get(event.squadId)?.name ?? '' : ''
    const challengeName = eventChallengeName || metadataString(event.metadata, 'challengeName') || 'Challenge'
    const squadName = eventSquadName || metadataString(event.metadata, 'squadName') || 'Squad'
    const inviteCount = metadataNumber(event.metadata, 'inviteCount')
    const note = metadataString(event.metadata, 'note')
    const reaction = reactionLabel(normalizeScoreReaction(event.metadata.reaction))
    let title = 'Friend activity'
    let detail = `${actor} updated something.`
    let tone: FriendActivityFeedItem['tone'] = 'neutral'

    switch (event.eventType) {
      case 'friend_request_sent':
        title = 'Friend request sent'
        detail = `${actor} sent ${target} a friend request.`
        tone = 'pending'
        break
      case 'friend_request_accepted':
        title = 'Friend request accepted'
        detail = `${actor} and ${target} are connected.`
        tone = 'success'
        break
      case 'friend_request_declined':
        title = 'Friend request declined'
        detail = `${actor} declined a friend request.`
        break
      case 'squad_created':
        title = `${squadName} squad created`
        detail = `${actor} saved a private squad.`
        tone = 'success'
        break
      case 'squad_updated':
        title = `${squadName} squad updated`
        detail = `${actor} changed the squad roster.`
        tone = 'success'
        break
      case 'squad_deleted':
        title = 'Squad deleted'
        detail = `${actor} deleted ${squadName}.`
        break
      case 'challenge_created':
        title = `${challengeName} created`
        detail = inviteCount && inviteCount > 0
          ? `${actor} invited ${inviteCount} ${inviteCount === 1 ? 'friend' : 'friends'}.`
          : `${actor} created a friend challenge.`
        tone = inviteCount && inviteCount > 0 ? 'pending' : 'success'
        break
      case 'challenge_invites_sent':
        title = 'Challenge invites sent'
        detail = `${actor} invited ${inviteCount ?? 0} ${inviteCount === 1 ? 'friend' : 'friends'} to ${challengeName}.`
        tone = 'pending'
        break
      case 'challenge_invite_accepted':
        title = 'Challenge invite accepted'
        detail = `${actor} joined ${challengeName}.`
        tone = 'success'
        break
      case 'challenge_invite_declined':
        title = 'Challenge invite declined'
        detail = `${actor} declined ${challengeName}.`
        break
      case 'challenge_score_published':
        title = `${actor} published a challenge score`
        detail = `${challengeName}${reaction ? ` · ${reaction}` : ''}${note ? ` · ${note}` : ''}`
        tone = 'success'
        break
      case 'leaderboard_score_published':
        title = `${actor} published a leaderboard score`
        detail = 'Leaderboard stats were refreshed.'
        tone = 'success'
        break
    }

    const comments = event.comments.map((comment) => ({
      ...comment,
      displayName: eventProfileName(comment.userId, profilesByUserId, currentUserId),
      isCurrentUser: comment.userId === currentUserId,
    }))
    const reactions = FRIEND_FEED_REACTIONS.map((feedReaction) => ({
      ...feedReaction,
      count: event.reactions.filter((reaction) => reaction.reaction === feedReaction.key).length,
      selected: event.reactions.some((reaction) => reaction.userId === currentUserId && reaction.reaction === feedReaction.key),
    }))

    return {
      id: `event-${event.id}`,
      eventId: event.id,
      title,
      detail,
      meta: formatActivityDate(event.createdAt),
      tone,
      sortAt: event.createdAt,
      shareText: `${title}\n${detail}\nShared from God Mode`,
      comments,
      reactions,
    }
  }).sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()).slice(0, 20)
}

export default function FriendsView({
  configured,
  user,
  profile,
  displayName,
  inviteCode,
  leaderboardRows,
  friendRequests,
  friendChallenges,
  friendSquads,
  friendEvents,
  settings,
  privacySettings,
  status,
  busy,
  online,
  onDisplayNameChange,
  onInviteCodeChange,
  onSaveProfile,
  onCopyInviteCode,
  onShareInviteMessage,
  onPrivacyChange,
  onAddFriend,
  onAcceptRequest,
  onDeclineRequest,
  onCreateSquad,
  onUpdateSquad,
  onDeleteSquad,
  onCreateChallenge,
  onInviteChallengeParticipants,
  onAcceptChallenge,
  onDeclineChallenge,
  onPublishChallengeScore,
  onCommentEvent,
  onDeleteEventComment,
  onReactEvent,
  onShareEvent,
  onPublishSummary,
  onRefresh,
  onOpenSettings,
}: {
  configured: boolean
  user: User | null
  profile: FriendProfile | null
  displayName: string
  inviteCode: string
  leaderboardRows: LeaderboardRow[]
  friendRequests: FriendRequest[]
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
  friendEvents: FriendEvent[]
  settings: ChallengeSettings
  privacySettings: PrivacySettings
  status: DataStatus
  busy: boolean
  online: boolean
  onDisplayNameChange: (value: string) => void
  onInviteCodeChange: (value: string) => void
  onSaveProfile: () => void
  onCopyInviteCode: () => void
  onShareInviteMessage: () => void
  onPrivacyChange: (privacySettings: PrivacySettings) => void
  onAddFriend: () => void
  onAcceptRequest: (userId: string) => void
  onDeclineRequest: (userId: string) => void
  onCreateSquad: (input: CreateFriendSquadInput) => void
  onUpdateSquad: (input: UpdateFriendSquadInput) => void
  onDeleteSquad: (squadId: string) => void
  onCreateChallenge: (input: CreateFriendChallengeInput) => void
  onInviteChallengeParticipants: (input: InviteFriendChallengeInput) => void
  onAcceptChallenge: (challengeId: string) => void
  onDeclineChallenge: (challengeId: string) => void
  onPublishChallengeScore: (challengeId: string, note?: string, reaction?: ScoreReaction | null) => void
  onCommentEvent: (eventId: string, body: string) => void
  onDeleteEventComment: (commentId: string) => void
  onReactEvent: (eventId: string, reaction: FriendFeedReaction | null) => void
  onShareEvent: (text: string) => void
  onPublishSummary: () => void
  onRefresh: () => void
  onOpenSettings: () => void
}) {
  const incomingRequests = friendRequests.filter((request) => request.direction === 'incoming')
  const outgoingRequests = friendRequests.filter((request) => request.direction === 'outgoing')
  const acceptedFriends = leaderboardRows.filter((row) => !row.isCurrentUser)
  const [activeFriendsTab, setActiveFriendsTab] = useState<FriendsTab>('overview')
  const [challengeTemplateId, setChallengeTemplateId] = useState(CHALLENGE_TEMPLATES[1]?.id ?? 'custom')
  const [challengeName, setChallengeName] = useState('No Zero Days')
  const [challengeStartDate, setChallengeStartDate] = useState(todayIso())
  const [challengeEndDate, setChallengeEndDate] = useState(addDays(todayIso(), 6))
  const [challengeScoringMode, setChallengeScoringMode] = useState<FriendChallengeScoringMode>('personal')
  const [challengeInviteIds, setChallengeInviteIds] = useState<string[]>([])
  const [challengeRuleKeys, setChallengeRuleKeys] = useState<RuleKey[]>(() => getEnabledRules(settings).map((rule) => rule.key))
  const [squadName, setSquadName] = useState('Training Squad')
  const [squadMemberIds, setSquadMemberIds] = useState<string[]>([])
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null)
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const currentUserId = user?.id ?? null
  const activityFeed = useMemo(() => (
    friendEvents.length > 0
      ? buildStoredFriendActivityFeed({
        friendEvents,
        leaderboardRows,
        friendChallenges,
        friendSquads,
        currentUserId,
      })
      : buildFriendActivityFeed({
        leaderboardRows,
        friendRequests,
        friendChallenges,
        friendSquads,
      })
  ), [friendEvents, leaderboardRows, friendRequests, friendChallenges, friendSquads, currentUserId])
  const pendingCount = incomingRequests.length + friendChallenges.filter((challenge) => challenge.currentUserStatus === 'pending' && !challenge.isCreator).length
  const networkBadgeCount = incomingRequests.length
  const challengeBadgeCount = friendChallenges.filter((challenge) => challenge.currentUserStatus === 'pending' && !challenge.isCreator).length
  const activeChallenges = friendChallenges.filter((challenge) => !isChallengeCompleted(challenge))
  const completedChallenges = friendChallenges.filter(isChallengeCompleted)
  const selectedChallenge = selectedChallengeId ? friendChallenges.find((challenge) => challenge.id === selectedChallengeId) ?? null : null
  const selectedFriend = selectedFriendId ? acceptedFriends.find((friend) => friend.userId === selectedFriendId) ?? null : null
  const currentUserRow = leaderboardRows.find((row) => row.isCurrentUser) ?? null
  const availableChallengeRules = settings.rules.filter((rule) => !rule.deleted)

  useEffect(() => {
    const availableKeys = new Set(availableChallengeRules.map((rule) => rule.key))
    setChallengeRuleKeys((current) => {
      const valid = current.filter((key) => availableKeys.has(key))
      return valid.length > 0 ? valid : getEnabledRules(settings).map((rule) => rule.key)
    })
  }, [settings.rules])

  function toggleChallengeInvite(userId: string) {
    setChallengeInviteIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function toggleChallengeRule(ruleKey: RuleKey) {
    setChallengeRuleKeys((current) => (
      current.includes(ruleKey)
        ? current.filter((key) => key !== ruleKey)
        : [...current, ruleKey]
    ))
  }

  function toggleSquadMember(userId: string) {
    setSquadMemberIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function applySquadToChallenge(squad: FriendSquadView) {
    const memberIds = squad.members.map((member) => member.userId)
    setChallengeInviteIds((current) => Array.from(new Set([...current, ...memberIds])))
  }

  function applyChallengeTemplate(templateId: string) {
    const template = CHALLENGE_TEMPLATES.find((item) => item.id === templateId) ?? CHALLENGE_TEMPLATES[0]
    setChallengeTemplateId(template.id)
    if (template.id === 'custom') {
      setChallengeRuleKeys(getEnabledRules(settings).map((rule) => rule.key))
      return
    }

    setChallengeName(template.name)
    setChallengeScoringMode(template.scoringMode)
    const previewSettings = buildChallengeSettingsForTemplate(
      settings,
      template.id,
      template.name,
      challengeStartDate,
      challengeEndDate,
    )
    setChallengeRuleKeys(getEnabledRules(previewSettings).map((rule) => rule.key))
    if (isIsoDate(challengeStartDate)) setChallengeEndDate(addDays(challengeStartDate, template.durationDays - 1))
  }

  function updateChallengeStartDate(startDate: string) {
    setChallengeStartDate(startDate)
    const template = CHALLENGE_TEMPLATES.find((item) => item.id === challengeTemplateId)
    if (template && template.id !== 'custom' && isIsoDate(startDate)) {
      setChallengeEndDate(addDays(startDate, template.durationDays - 1))
    }
  }

  function submitSquad() {
    const acceptedFriendIds = new Set(acceptedFriends.map((friend) => friend.userId))
    onCreateSquad({
      name: squadName,
      memberIds: squadMemberIds.filter((userId) => acceptedFriendIds.has(userId)),
    })
  }

  function submitChallenge() {
    const acceptedFriendIds = new Set(acceptedFriends.map((friend) => friend.userId))
    onCreateChallenge({
      name: challengeName,
      startDate: challengeStartDate,
      endDate: challengeEndDate,
      scoringMode: challengeScoringMode,
      inviteeIds: challengeInviteIds.filter((userId) => acceptedFriendIds.has(userId)),
      ruleKeys: challengeRuleKeys,
      templateId: challengeTemplateId,
    })
  }

  if (!configured) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <p className="eyebrow">Friends v2</p>
          <h2>Friends</h2>
          <p>Supabase is required for friends, invite codes, and leaderboards.</p>
        </section>
        <section className="panel focus-panel">
          <p className="eyebrow">Cloud required</p>
          <h2>Configure Supabase first.</h2>
          <p>Run the schema, add the Vite env vars, and redeploy. Local tracking still works while social features are offline.</p>
        </section>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <p className="eyebrow">Friends v2</p>
          <h2>Friends</h2>
          <p>Sign in to send friend requests and compare daily scores.</p>
        </section>
        <section className="panel focus-panel">
          <p className="eyebrow">Account needed</p>
          <h2>Sign in from Settings.</h2>
          <p>Friends only see share-safe stats like completion, streaks, and logged days.</p>
          <button className="primary-button" type="button" onClick={onOpenSettings}>
            Open Settings
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Friends v2</p>
        <h2>Friends</h2>
        <p>Accept requests, then compare last-7-day completion, average score, streaks, and logged days.</p>
      </section>

      <section className="friends-command-center" aria-label="Friends sections">
        <div className="friends-tabs" role="tablist" aria-label="Friends sections">
          {FRIENDS_TABS.map((tab) => {
            const tabBadge = tab.key === 'network' ? networkBadgeCount : tab.key === 'challenges' ? challengeBadgeCount : 0
            return (
              <button
                className={activeFriendsTab === tab.key ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeFriendsTab === tab.key}
                key={tab.key}
                onClick={() => setActiveFriendsTab(tab.key)}
              >
                {tab.label}
                {tabBadge > 0 && <b className="inline-badge">{tabBadge}</b>}
              </button>
            )
          })}
        </div>
        <div className="friends-stat-grid">
          <span><small>Friends</small><strong>{acceptedFriends.length}</strong></span>
          <span><small>Squads</small><strong>{friendSquads.length}</strong></span>
          <span><small>Challenges</small><strong>{friendChallenges.length}</strong></span>
          <span><small>Needs action</small><strong>{pendingCount}</strong></span>
        </div>
      </section>

      {activeFriendsTab === 'overview' && (
        <>
      <section className="panel friends-profile-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your profile</p>
            <h2>Invite + identity</h2>
          </div>
        </div>
        <div className="friends-profile-grid">
          <TextField label="Display name" value={displayName} onChange={onDisplayNameChange} />
          <div className="invite-code-card">
            <small>Invite code</small>
            <strong>{profile?.inviteCode || 'Loading...'}</strong>
            <button className="ghost-button" type="button" onClick={onCopyInviteCode} disabled={busy || !profile?.inviteCode}>
              Copy Code
            </button>
          </div>
        </div>
        <div className="data-actions">
          <button className="secondary-button" type="button" onClick={onSaveProfile} disabled={busy}>
            Save Profile
          </button>
          <button className="secondary-button" type="button" onClick={onPublishSummary} disabled={busy}>
            Publish Score
          </button>
          <button className="secondary-button" type="button" onClick={onShareInviteMessage} disabled={busy || !profile?.inviteCode}>
            Share Invite
          </button>
          <button className="secondary-button" type="button" onClick={onRefresh} disabled={busy}>
            Refresh
          </button>
        </div>
        <div className="privacy-panel">
          <div>
            <small>Privacy settings</small>
            <p>Choose which stats are visible when you publish leaderboard and challenge scores.</p>
          </div>
          <div className="privacy-grid">
            <CheckField
              label="Show 7-day score"
              checked={privacySettings.showWeeklyCompletion}
              disabled={busy}
              onChange={(showWeeklyCompletion) => onPrivacyChange({ ...privacySettings, showWeeklyCompletion })}
            />
            <CheckField
              label="Show average"
              checked={privacySettings.showAverageCompletion}
              disabled={busy}
              onChange={(showAverageCompletion) => onPrivacyChange({ ...privacySettings, showAverageCompletion })}
            />
            <CheckField
              label="Show streak"
              checked={privacySettings.showStreak}
              disabled={busy}
              onChange={(showStreak) => onPrivacyChange({ ...privacySettings, showStreak })}
            />
            <CheckField
              label="Show logged days"
              checked={privacySettings.showLoggedDays}
              disabled={busy}
              onChange={(showLoggedDays) => onPrivacyChange({ ...privacySettings, showLoggedDays })}
            />
          </div>
        </div>
        <div className="status-with-action">
          <p className={`data-status ${status.tone}`}>{busy ? 'Working...' : status.message}</p>
          {status.retryable && (
            <button className="ghost-button compact-button" type="button" onClick={onRefresh} disabled={busy || !online}>
              Retry Connection
            </button>
          )}
        </div>
      </section>

      <section className="panel friend-activity-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Activity</p>
            <h2>Squad feed</h2>
          </div>
          <span>{activityFeed.length}</span>
        </div>
        <FriendActivityFeed
          items={activityFeed}
          busy={busy}
          onComment={onCommentEvent}
          onDeleteComment={onDeleteEventComment}
          onReact={onReactEvent}
          onShare={onShareEvent}
        />
      </section>
        </>
      )}

      {activeFriendsTab === 'network' && (
        <>
      <section className="panel add-friend-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Add friend</p>
            <h2>Invite code</h2>
          </div>
        </div>
        <div className="auth-form">
          <TextField label="Friend code" value={inviteCode} onChange={(value) => onInviteCodeChange(value.toUpperCase())} />
          <button className="secondary-button" type="button" onClick={onAddFriend} disabled={busy}>
            Send Request
          </button>
        </div>
      </section>

      <section className="panel friend-requests-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Requests</p>
            <h2>Friend requests</h2>
          </div>
          <span>{friendRequests.length}</span>
        </div>
        {friendRequests.length === 0 ? (
          <p className="empty-leaderboard">No pending requests.</p>
        ) : (
          <div className="friend-request-list">
            {incomingRequests.map((request) => (
              <FriendRequestCard
                key={`${request.userA}-${request.userB}`}
                request={request}
                busy={busy}
                onAccept={() => onAcceptRequest(request.userId)}
                onDecline={() => onDeclineRequest(request.userId)}
              />
            ))}
            {outgoingRequests.map((request) => (
              <FriendRequestCard
                key={`${request.userA}-${request.userB}`}
                request={request}
                busy={busy}
                onAccept={() => {}}
                onDecline={() => {}}
              />
            ))}
          </div>
        )}
      </section>
        </>
      )}

      {activeFriendsTab === 'squads' && (
        <>
      <section className="panel friend-squads-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Challenge squads</p>
            <h2>Small private groups</h2>
          </div>
          <span>{friendSquads.length}</span>
        </div>
        <div className="challenge-create-panel">
          <div className="field-grid">
            <TextField label="Squad name" value={squadName} onChange={setSquadName} />
          </div>
          <div className="challenge-invite-picker">
            <small>Squad members</small>
            {acceptedFriends.length === 0 ? (
              <p>No accepted friends yet.</p>
            ) : (
              <div>
                {acceptedFriends.map((friend) => (
                  <label className="challenge-invite-option" key={friend.userId}>
                    <input
                      type="checkbox"
                      checked={squadMemberIds.includes(friend.userId)}
                      onChange={() => toggleSquadMember(friend.userId)}
                    />
                    <span>{friend.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="secondary-button" type="button" onClick={submitSquad} disabled={busy || !squadName.trim() || squadMemberIds.length === 0}>
            Create Squad
          </button>
        </div>
        {friendSquads.length === 0 ? (
          <p className="empty-leaderboard">No squads yet. Save a group once, then use it when creating challenges.</p>
        ) : (
          <div className="squad-list">
            {friendSquads.map((squad) => (
              <FriendSquadCard
                key={squad.id}
                squad={squad}
                leaderboardRows={leaderboardRows}
                acceptedFriends={acceptedFriends}
                busy={busy}
                onUpdate={(input) => onUpdateSquad(input)}
                onUseForChallenge={() => applySquadToChallenge(squad)}
                onDelete={() => onDeleteSquad(squad.id)}
              />
            ))}
          </div>
        )}
      </section>
        </>
      )}

      {activeFriendsTab === 'challenges' && (
        <>
      <section className="panel friend-challenges-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Friend challenges</p>
            <h2>Custom competitions</h2>
          </div>
          <span>{friendChallenges.length}</span>
        </div>
        <div className="challenge-create-panel">
          <div className="template-picker">
            <label className="select-field">
              <span>Template</span>
              <select value={challengeTemplateId} onChange={(event) => applyChallengeTemplate(event.target.value)}>
                {CHALLENGE_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <p>{describeTemplateOverrides(challengeTemplateById(challengeTemplateId))}</p>
          </div>
          <div className="field-grid">
            <TextField label="Challenge name" value={challengeName} onChange={setChallengeName} />
            <label className="select-field">
              <span>Scoring</span>
              <select value={challengeScoringMode} onChange={(event) => setChallengeScoringMode(event.target.value as FriendChallengeScoringMode)}>
                <option value="personal">Personal targets</option>
                <option value="shared">Shared rules</option>
              </select>
            </label>
            <TextField label="Start" type="date" value={challengeStartDate} onChange={updateChallengeStartDate} />
            <TextField label="End" type="date" value={challengeEndDate} onChange={setChallengeEndDate} />
          </div>
          <div className="challenge-rule-picker">
            <div className="challenge-rule-picker-heading">
              <div>
                <small>Challenge rules</small>
                <p>Choose what counts. Custom rules from your tracker are available here too.</p>
              </div>
              <strong>{challengeRuleKeys.length} selected</strong>
            </div>
            <div className="challenge-rule-options">
              {availableChallengeRules.map((rule) => (
                <label className="challenge-rule-option" key={rule.key}>
                  <input
                    type="checkbox"
                    checked={challengeRuleKeys.includes(rule.key)}
                    onChange={() => toggleChallengeRule(rule.key)}
                  />
                  <span>
                    <strong>{rule.label}</strong>
                    <small>{settings.categories.find((category) => category.key === rule.category)?.label ?? rule.category}{rule.key.startsWith('custom-') ? ' · Custom' : ''}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="challenge-invite-picker">
            <small>Invite friends</small>
            {friendSquads.length > 0 && (
              <div className="squad-shortcuts">
                {friendSquads.map((squad) => (
                  <button className="ghost-button" type="button" key={squad.id} onClick={() => applySquadToChallenge(squad)} disabled={busy || squad.members.length === 0}>
                    Use {squad.name}
                  </button>
                ))}
              </div>
            )}
            {acceptedFriends.length === 0 ? (
              <p>No accepted friends yet.</p>
            ) : (
              <div>
                {acceptedFriends.map((friend) => (
                  <label className="challenge-invite-option" key={friend.userId}>
                    <input
                      type="checkbox"
                      checked={challengeInviteIds.includes(friend.userId)}
                      onChange={() => toggleChallengeInvite(friend.userId)}
                    />
                    <span>{friend.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button className="secondary-button" type="button" onClick={submitChallenge} disabled={busy || !challengeName.trim() || challengeRuleKeys.length === 0}>
            Create Challenge
          </button>
        </div>
        {selectedChallenge && (
          <FriendChallengeDetail
            challenge={selectedChallenge}
            acceptedFriends={acceptedFriends}
            busy={busy}
            onClose={() => setSelectedChallengeId(null)}
            onInviteMore={(inviteeIds) => onInviteChallengeParticipants({
              challengeId: selectedChallenge.id,
              inviteeIds,
            })}
            onPublish={(note, reaction) => onPublishChallengeScore(selectedChallenge.id, note, reaction)}
          />
        )}
        {friendChallenges.length === 0 ? (
          <p className="empty-leaderboard">No friend challenges yet.</p>
        ) : (
          <>
            <div className="challenge-section">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">Active</p>
                  <h3>Current challenges</h3>
                </div>
                <span>{activeChallenges.length}</span>
              </div>
              {activeChallenges.length === 0 ? (
                <p className="empty-leaderboard">No active challenges right now.</p>
              ) : (
                <div className="challenge-list">
                  {activeChallenges.map((challenge) => (
                    <FriendChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={busy}
                      onSelect={() => setSelectedChallengeId(challenge.id)}
                      onAccept={() => onAcceptChallenge(challenge.id)}
                      onDecline={() => onDeclineChallenge(challenge.id)}
                      onPublish={() => onPublishChallengeScore(challenge.id)}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="challenge-section">
              <div className="section-heading compact-heading">
                <div>
                  <p className="eyebrow">Archive</p>
                  <h3>Completed challenges</h3>
                </div>
                <span>{completedChallenges.length}</span>
              </div>
              {completedChallenges.length === 0 ? (
                <p className="empty-leaderboard">Completed friend-versus-friend history will collect here.</p>
              ) : (
                <div className="challenge-list">
                  {completedChallenges.map((challenge) => (
                    <FriendChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      busy={busy}
                      onSelect={() => setSelectedChallengeId(challenge.id)}
                      onAccept={() => onAcceptChallenge(challenge.id)}
                      onDecline={() => onDeclineChallenge(challenge.id)}
                      onPublish={() => onPublishChallengeScore(challenge.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
        </>
      )}

      {activeFriendsTab === 'leaderboard' && (
      <section className="panel leaderboard-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Competition</p>
            <h2>Leaderboard</h2>
          </div>
          <span>{leaderboardRows.length}</span>
        </div>
        {selectedFriend && (
          <FriendProfileDetail
            friend={selectedFriend}
            currentUser={currentUserRow}
            friendChallenges={friendChallenges}
            friendSquads={friendSquads}
            onClose={() => setSelectedFriendId(null)}
          />
        )}
        {leaderboardRows.length === 0 ? (
          <p className="empty-leaderboard">Publish your score to start the leaderboard.</p>
        ) : (
          <div className="leaderboard-list">
            {leaderboardRows.map((row, index) => (
              <LeaderboardCard
                key={row.userId}
                row={row}
                rank={index + 1}
                onOpenProfile={row.isCurrentUser ? undefined : () => setSelectedFriendId(row.userId)}
              />
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  )
}

function FriendRequestCard({
  request,
  busy,
  onAccept,
  onDecline,
}: {
  request: FriendRequest
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  const isIncoming = request.direction === 'incoming'

  return (
    <article className="friend-request-card">
      <div className="friend-request-main">
        <strong>{request.displayName}</strong>
        <span>{isIncoming ? 'Wants to compete with you' : 'Waiting for response'}</span>
      </div>
      {isIncoming ? (
        <div className="friend-request-actions">
          <button className="secondary-button compact-button" type="button" onClick={onAccept} disabled={busy}>
            Accept
          </button>
          <button className="ghost-button" type="button" onClick={onDecline} disabled={busy}>
            Decline
          </button>
        </div>
      ) : (
        <span className="request-badge">Pending</span>
      )}
    </article>
  )
}

function FriendActivityFeed({
  items,
  busy,
  onComment,
  onDeleteComment,
  onReact,
  onShare,
}: {
  items: FriendActivityFeedItem[]
  busy: boolean
  onComment: (eventId: string, body: string) => void
  onDeleteComment: (commentId: string) => void
  onReact: (eventId: string, reaction: FriendFeedReaction | null) => void
  onShare: (text: string) => void
}) {
  if (items.length === 0) {
    return <p className="empty-leaderboard">No squad or friend activity yet.</p>
  }

  return (
    <div className="activity-list">
      {items.map((item) => (
        <FriendActivityCard
          key={item.id}
          item={item}
          busy={busy}
          onComment={onComment}
          onDeleteComment={onDeleteComment}
          onReact={onReact}
          onShare={onShare}
        />
      ))}
    </div>
  )
}

function FriendActivityCard({
  item,
  busy,
  onComment,
  onDeleteComment,
  onReact,
  onShare,
}: {
  item: FriendActivityFeedItem
  busy: boolean
  onComment: (eventId: string, body: string) => void
  onDeleteComment: (commentId: string) => void
  onReact: (eventId: string, reaction: FriendFeedReaction | null) => void
  onShare: (text: string) => void
}) {
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')

  function submitComment() {
    if (!item.eventId || !commentDraft.trim()) return
    onComment(item.eventId, commentDraft)
    setCommentDraft('')
    setCommentOpen(false)
  }

  return (
    <article className={`activity-card ${item.tone}`}>
      <div className="activity-card-main">
        <div className="activity-dot" />
        <div className="activity-copy">
          <strong>{item.title}</strong>
          <p>{item.detail}</p>
        </div>
        <small>{item.meta}</small>
      </div>

      {item.eventId && (
        <div className="activity-reaction-row" aria-label="Reactions">
          {item.reactions.map((reaction) => (
            <button
              className={reaction.selected ? 'selected' : ''}
              type="button"
              key={reaction.key}
              disabled={busy}
              aria-pressed={reaction.selected}
              onClick={() => onReact(item.eventId!, reaction.selected ? null : reaction.key)}
            >
              {reaction.label}{reaction.count > 0 ? ` ${reaction.count}` : ''}
            </button>
          ))}
        </div>
      )}

      <div className="activity-action-row">
        {item.eventId && (
          <button type="button" onClick={() => setCommentOpen((open) => !open)} disabled={busy}>
            Comment{item.comments.length > 0 ? ` ${item.comments.length}` : ''}
          </button>
        )}
        <button type="button" onClick={() => onShare(item.shareText)} disabled={busy}>Share</button>
      </div>

      {item.comments.length > 0 && (
        <div className="activity-comments">
          {item.comments.map((comment) => (
            <div className="activity-comment" key={comment.id}>
              <div>
                <strong>{comment.displayName}</strong>
                <p>{comment.body}</p>
              </div>
              {comment.isCurrentUser && (
                <button type="button" onClick={() => onDeleteComment(comment.id)} disabled={busy}>Delete</button>
              )}
            </div>
          ))}
        </div>
      )}

      {commentOpen && item.eventId && (
        <div className="activity-comment-form">
          <TextField
            label="Add a comment"
            value={commentDraft}
            onChange={(value) => setCommentDraft(value.slice(0, 400))}
          />
          <button className="secondary-button compact-button" type="button" onClick={submitComment} disabled={busy || !commentDraft.trim()}>
            Post
          </button>
        </div>
      )}
    </article>
  )
}

function FriendSquadCard({
  squad,
  leaderboardRows,
  acceptedFriends,
  busy,
  onUpdate,
  onUseForChallenge,
  onDelete,
}: {
  squad: FriendSquadView
  leaderboardRows: LeaderboardRow[]
  acceptedFriends: LeaderboardRow[]
  busy: boolean
  onUpdate: (input: UpdateFriendSquadInput) => void
  onUseForChallenge: () => void
  onDelete: () => void
}) {
  const squadLeaderboardRows = getSquadLeaderboardRows(squad, leaderboardRows)
  const [isEditing, setIsEditing] = useState(false)
  const [draftName, setDraftName] = useState(squad.name)
  const [draftMemberIds, setDraftMemberIds] = useState(squad.members.map((member) => member.userId))

  function startEditing() {
    setDraftName(squad.name)
    setDraftMemberIds(squad.members.map((member) => member.userId))
    setIsEditing(true)
  }

  function toggleDraftMember(userId: string) {
    setDraftMemberIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function saveSquad() {
    onUpdate({
      squadId: squad.id,
      name: draftName,
      memberIds: draftMemberIds,
    })
    setIsEditing(false)
  }

  return (
    <article className="squad-card">
      {isEditing ? (
        <div className="squad-edit-panel">
          <TextField label="Squad name" value={draftName} onChange={setDraftName} />
          <div className="challenge-invite-picker">
            <small>Members</small>
            {acceptedFriends.length === 0 ? (
              <p>No accepted friends yet.</p>
            ) : (
              <div>
                {acceptedFriends.map((friend) => (
                  <label className="challenge-invite-option" key={friend.userId}>
                    <input
                      type="checkbox"
                      checked={draftMemberIds.includes(friend.userId)}
                      onChange={() => toggleDraftMember(friend.userId)}
                    />
                    <span>{friend.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="squad-card-actions">
            <button className="secondary-button compact-button" type="button" onClick={saveSquad} disabled={busy || !draftName.trim()}>
              Save Squad
            </button>
            <button className="ghost-button" type="button" onClick={() => setIsEditing(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="squad-card-main">
          <div>
            <strong>{squad.name}</strong>
            <span>{squad.members.length} {squad.members.length === 1 ? 'member' : 'members'}</span>
          </div>
          {squad.members.length === 0 ? (
            <p>No active members. Add accepted friends by editing this squad.</p>
          ) : (
            <div className="squad-member-list">
              {squad.members.map((member) => (
                <span key={member.userId}>{member.displayName}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {squadLeaderboardRows.length > 0 && (
        <div className="squad-leaderboard">
          <small>Squad leaderboard</small>
          {squadLeaderboardRows.map((row, index) => (
            <article className={`squad-leaderboard-row ${row.isCurrentUser ? 'is-you' : ''}`} key={row.userId}>
              <b>{index + 1}</b>
              <div>
                <strong>{row.displayName}</strong>
                <span>{formatSummaryMetric(row.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)} last 7 days</span>
              </div>
              <em>{formatSummaryMetric(row.summary, 'showStreak', (summary) => `${summary.currentStreak} streak`)}</em>
            </article>
          ))}
        </div>
      )}
      <div className="squad-card-actions">
        {!isEditing && (
          <button className="secondary-button compact-button" type="button" onClick={startEditing} disabled={busy}>
            Edit Squad
          </button>
        )}
        <button className="secondary-button compact-button" type="button" onClick={onUseForChallenge} disabled={busy || squad.members.length === 0}>
          Use for Challenge
        </button>
        <button className="ghost-button" type="button" onClick={onDelete} disabled={busy}>
          Delete
        </button>
      </div>
    </article>
  )
}

function FriendChallengeCard({
  challenge,
  busy,
  onSelect,
  onAccept,
  onDecline,
  onPublish,
}: {
  challenge: FriendChallengeView
  busy: boolean
  onSelect: () => void
  onAccept: () => void
  onDecline: () => void
  onPublish: () => void
}) {
  const modeLabel = challenge.scoringMode === 'shared' ? 'Shared rules' : 'Personal targets'
  const acceptedParticipants = challenge.participants.filter((participant) => participant.status === 'accepted')
  const pendingParticipants = challenge.participants.filter((participant) => participant.status === 'pending')
  const rankedParticipants = [...acceptedParticipants].sort((a, b) => (
    (b.summary?.weeklyCompletion ?? 0) - (a.summary?.weeklyCompletion ?? 0)
    || (b.summary?.averageCompletion ?? 0) - (a.summary?.averageCompletion ?? 0)
    || (b.summary?.currentStreak ?? 0) - (a.summary?.currentStreak ?? 0)
    || a.displayName.localeCompare(b.displayName)
  ))

  return (
    <article className={`challenge-card ${challenge.currentUserStatus === 'pending' ? 'has-pending-invite' : ''}`}>
      <div className="challenge-card-header">
        <div>
          <small>{modeLabel} · {formatShortDate(challenge.startDate)} - {formatShortDate(challenge.endDate)}</small>
          <h3>{challenge.name}</h3>
          <p>{acceptedParticipants.length} active · {pendingParticipants.length} invited</p>
        </div>
        <span className="request-badge">{challenge.isCreator ? 'Owner' : challenge.currentUserStatus}</span>
      </div>

      <div className="challenge-card-actions">
        <button className="secondary-button compact-button" type="button" onClick={onSelect} disabled={busy}>
          Details
        </button>
        {challenge.currentUserStatus === 'pending' && !challenge.isCreator && (
          <>
            <button className="secondary-button compact-button" type="button" onClick={onAccept} disabled={busy}>
              Accept
            </button>
            <button className="ghost-button" type="button" onClick={onDecline} disabled={busy}>
              Decline
            </button>
          </>
        )}
        {challenge.currentUserStatus === 'accepted' && (
          <button className="secondary-button compact-button" type="button" onClick={onPublish} disabled={busy}>
            Publish Challenge Score
          </button>
        )}
      </div>

      {rankedParticipants.length === 0 ? (
        <p className="empty-leaderboard">No accepted participants yet.</p>
      ) : (
        <div className="leaderboard-list">
          {rankedParticipants.map((participant, index) => (
            <article className={`leaderboard-card ${participant.isCurrentUser ? 'is-you' : ''}`} key={participant.userId}>
              <div className="leaderboard-rank">{index + 1}</div>
              <div className="leaderboard-main">
                <div className="leaderboard-name-row">
                  <strong>{participant.displayName}</strong>
                  {participant.isCurrentUser && <span>You</span>}
                </div>
                <small>{participant.summary ? `Updated ${formatShortDate(participant.summary.updatedAt.slice(0, 10))}` : 'No score published yet'}</small>
              </div>
              <div className="leaderboard-stats">
                <span><small>7-day</small><strong>{formatSummaryMetric(participant.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)}</strong></span>
                <span><small>Avg</small><strong>{formatSummaryMetric(participant.summary, 'showAverageCompletion', (summary) => `${summary.averageCompletion}%`)}</strong></span>
                <span><small>Streak</small><strong>{formatSummaryMetric(participant.summary, 'showStreak', (summary) => String(summary.currentStreak))}</strong></span>
                <span><small>Logged</small><strong>{formatSummaryMetric(participant.summary, 'showLoggedDays', (summary) => `${summary.loggedDays}/${summary.totalDays}`)}</strong></span>
              </div>
              {(participant.summary?.note || participant.summary?.reaction) && (
                <p className="score-note">
                  {reactionLabel(participant.summary.reaction) ?? 'Note'}{participant.summary.note ? ` · ${participant.summary.note}` : ''}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </article>
  )
}

function FriendChallengeDetail({
  challenge,
  acceptedFriends,
  busy,
  onClose,
  onInviteMore,
  onPublish,
}: {
  challenge: FriendChallengeView
  acceptedFriends: LeaderboardRow[]
  busy: boolean
  onClose: () => void
  onInviteMore: (inviteeIds: string[]) => void
  onPublish: (note: string, reaction: ScoreReaction | null) => void
}) {
  const participantIds = new Set(challenge.participants.map((participant) => participant.userId))
  const availableFriends = acceptedFriends.filter((friend) => !participantIds.has(friend.userId))
  const acceptedParticipants = challenge.participants.filter((participant) => participant.status === 'accepted')
  const pendingParticipants = challenge.participants.filter((participant) => participant.status === 'pending')
  const declinedParticipants = challenge.participants.filter((participant) => participant.status === 'declined')
  const rankedParticipants = [...acceptedParticipants].sort((a, b) => (
    (b.summary?.weeklyCompletion ?? 0) - (a.summary?.weeklyCompletion ?? 0)
    || (b.summary?.averageCompletion ?? 0) - (a.summary?.averageCompletion ?? 0)
    || (b.summary?.currentStreak ?? 0) - (a.summary?.currentStreak ?? 0)
    || a.displayName.localeCompare(b.displayName)
  ))
  const myParticipant = challenge.participants.find((participant) => participant.isCurrentUser) ?? null
  const activeRules = getEnabledRules(challenge.settings)
  const completed = isChallengeCompleted(challenge)
  const [inviteIds, setInviteIds] = useState<string[]>([])
  const [scoreNote, setScoreNote] = useState(myParticipant?.summary?.note ?? '')
  const [scoreReaction, setScoreReaction] = useState<ScoreReaction | null>(myParticipant?.summary?.reaction ?? null)

  useEffect(() => {
    setInviteIds([])
    setScoreNote(myParticipant?.summary?.note ?? '')
    setScoreReaction(myParticipant?.summary?.reaction ?? null)
  }, [challenge.id])

  function toggleInvite(userId: string) {
    setInviteIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ))
  }

  function submitInvites() {
    onInviteMore(inviteIds)
    setInviteIds([])
  }

  return (
    <article className="challenge-detail-card">
      <div className="challenge-detail-header">
        <div>
          <small>{completed ? 'Completed archive' : 'Challenge detail'}</small>
          <h3>{challenge.name}</h3>
          <p>{formatShortDate(challenge.startDate)} - {formatShortDate(challenge.endDate)} · {challenge.scoringMode === 'shared' ? 'Shared rules' : 'Personal targets'}</p>
        </div>
        <div className="challenge-detail-actions">
          <span className="request-badge">{challenge.isCreator ? 'Owner' : statusLabel(challenge.currentUserStatus)}</span>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="challenge-detail-grid">
        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Publishing</p>
              <h3>Your score</h3>
            </div>
          </div>
          <div className="publish-state">
            <span><small>Status</small><strong>{myParticipant ? statusLabel(myParticipant.status) : 'Not joined'}</strong></span>
            <span><small>Last publish</small><strong>{myParticipant?.summary ? formatShortDate(myParticipant.summary.updatedAt.slice(0, 10)) : 'None'}</strong></span>
          </div>
          {challenge.currentUserStatus === 'accepted' ? (
            <div className="score-publish-form">
              <TextArea
                label="Score note"
                value={scoreNote}
                placeholder="Optional: what made this score happen?"
                disabled={busy}
                onChange={(value) => setScoreNote(value.slice(0, 180))}
              />
              <label className="select-field">
                <span>Reaction</span>
                <select value={scoreReaction ?? ''} disabled={busy} onChange={(event) => setScoreReaction(normalizeScoreReaction(event.target.value))}>
                  <option value="">No reaction</option>
                  {SCORE_REACTIONS.map((reaction) => (
                    <option key={reaction.key} value={reaction.key}>{reaction.label}</option>
                  ))}
                </select>
              </label>
              <button className="secondary-button compact-button" type="button" onClick={() => onPublish(scoreNote, scoreReaction)} disabled={busy}>
                Publish Score & History
              </button>
            </div>
          ) : (
            <p className="empty-leaderboard">Accept this challenge before publishing a score.</p>
          )}
        </section>

        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Participants</p>
              <h3>Roster state</h3>
            </div>
          </div>
          <div className="challenge-roster-grid">
            <span><small>Accepted</small><strong>{acceptedParticipants.length}</strong></span>
            <span><small>Pending</small><strong>{pendingParticipants.length}</strong></span>
            <span><small>Declined</small><strong>{declinedParticipants.length}</strong></span>
          </div>
          <div className="participant-history-list">
            {challenge.participants.map((participant) => (
              <article className="participant-history-row" key={participant.userId}>
                <div>
                  <strong>{participant.displayName}{participant.isCurrentUser ? ' · You' : ''}</strong>
                  <span>Invited {formatActivityDate(participant.createdAt)}{participant.respondedAt ? ` · Responded ${formatActivityDate(participant.respondedAt)}` : ''}</span>
                </div>
                <b>{statusLabel(participant.status)}</b>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Daily timeline</p>
            <h3>Published score history</h3>
          </div>
          <span>{acceptedParticipants.reduce((count, participant) => count + participant.history.length, 0)} days</span>
        </div>
        {acceptedParticipants.some((participant) => participant.history.length > 0) ? (
          <div className="daily-history-grid">
            {acceptedParticipants.map((participant) => (
              <article className="daily-history-person" key={participant.userId}>
                <div className="daily-history-person-heading">
                  <strong>{participant.displayName}{participant.isCurrentUser ? ' · You' : ''}</strong>
                  <small>{participant.history.length} published {participant.history.length === 1 ? 'day' : 'days'}</small>
                </div>
                {participant.history.length === 0 ? (
                  <p>No daily scores published yet.</p>
                ) : (
                  <div className="daily-score-list">
                    {participant.history.map((snapshot) => (
                      <div className="daily-score-row" key={snapshot.date}>
                        <span>{formatShortDate(snapshot.date)}</span>
                        <progress max="100" value={snapshot.completionPercent} aria-label={`${snapshot.completionPercent}% complete`} />
                        <strong>{snapshot.completionPercent}%</strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-leaderboard">Daily scores appear here after participants publish their challenge score.</p>
        )}
      </section>

      {challenge.isCreator && (
        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Invite management</p>
              <h3>Add friends</h3>
            </div>
            <span>{availableFriends.length}</span>
          </div>
          {availableFriends.length === 0 ? (
            <p className="empty-leaderboard">All accepted friends are already in this challenge.</p>
          ) : (
            <>
              <div className="challenge-invite-picker">
                <div>
                  {availableFriends.map((friend) => (
                    <label className="challenge-invite-option" key={friend.userId}>
                      <input
                        type="checkbox"
                        checked={inviteIds.includes(friend.userId)}
                        onChange={() => toggleInvite(friend.userId)}
                      />
                      <span>{friend.displayName}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="secondary-button compact-button" type="button" onClick={submitInvites} disabled={busy || inviteIds.length === 0}>
                Send Challenge Invites
              </button>
            </>
          )}
        </section>
      )}

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Settings</p>
            <h3>Rules and targets</h3>
          </div>
        </div>
        <div className="challenge-settings-grid">
          <span><small>Exercise</small><strong>{challenge.settings.targets.exerciseMinutes} min</strong></span>
          <span><small>Protein</small><strong>{challenge.settings.targets.proteinGrams} g</strong></span>
          <span><small>Water</small><strong>{challenge.settings.targets.waterLiters} L</strong></span>
          <span><small>Sleep</small><strong>{challenge.settings.targets.sleepHours} hr</strong></span>
        </div>
        <div className="squad-member-list">
          {activeRules.map((rule) => (
            <span key={rule.key}>{rule.label} · {rule.weight === 'nonNegotiable' ? 'Non-negotiable' : 'Supporting'}</span>
          ))}
        </div>
      </section>

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Weekly comparison</h3>
          </div>
        </div>
        {rankedParticipants.length === 0 ? (
          <p className="empty-leaderboard">No accepted participants have published yet.</p>
        ) : (
          <div className="leaderboard-list">
            {rankedParticipants.map((participant, index) => (
              <article className={`leaderboard-card ${participant.isCurrentUser ? 'is-you' : ''}`} key={participant.userId}>
                <div className="leaderboard-rank">{index + 1}</div>
                <div className="leaderboard-main">
                  <div className="leaderboard-name-row">
                    <strong>{participant.displayName}</strong>
                    {participant.isCurrentUser && <span>You</span>}
                  </div>
                  <small>{participant.summary?.lastLoggedDate ? `Last log ${formatShortDate(participant.summary.lastLoggedDate)}` : 'No logged score yet'}</small>
                </div>
                <div className="leaderboard-stats">
                  <span><small>7-day</small><strong>{formatSummaryMetric(participant.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)}</strong></span>
                  <span><small>Avg</small><strong>{formatSummaryMetric(participant.summary, 'showAverageCompletion', (summary) => `${summary.averageCompletion}%`)}</strong></span>
                  <span><small>Streak</small><strong>{formatSummaryMetric(participant.summary, 'showStreak', (summary) => String(summary.currentStreak))}</strong></span>
                  <span><small>Logged</small><strong>{formatSummaryMetric(participant.summary, 'showLoggedDays', (summary) => `${summary.loggedDays}/${summary.totalDays}`)}</strong></span>
                </div>
                {(participant.summary?.note || participant.summary?.reaction) && (
                  <p className="score-note">
                    {reactionLabel(participant.summary.reaction) ?? 'Note'}{participant.summary.note ? ` · ${participant.summary.note}` : ''}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}

function FriendProfileDetail({
  friend,
  currentUser,
  friendChallenges,
  friendSquads,
  onClose,
}: {
  friend: LeaderboardRow
  currentUser: LeaderboardRow | null
  friendChallenges: FriendChallengeView[]
  friendSquads: FriendSquadView[]
  onClose: () => void
}) {
  const sharedSquads = friendSquads.filter((squad) => squad.members.some((member) => member.userId === friend.userId))
  const sharedChallenges = friendChallenges.filter((challenge) => {
    const friendParticipant = challenge.participants.find((participant) => participant.userId === friend.userId)
    const currentParticipant = challenge.participants.find((participant) => participant.isCurrentUser)
    return friendParticipant?.status === 'accepted' && currentParticipant?.status === 'accepted'
  })
  const headToHead = sharedChallenges.reduce((record, challenge) => {
    const friendParticipant = challenge.participants.find((participant) => participant.userId === friend.userId)
    const currentParticipant = challenge.participants.find((participant) => participant.isCurrentUser)
    const friendScore = friendParticipant?.summary?.weeklyCompletion ?? null
    const currentScore = currentParticipant?.summary?.weeklyCompletion ?? null
    if (friendScore === null || currentScore === null || friendScore === currentScore) return record
    return friendScore > currentScore
      ? { ...record, friendWins: record.friendWins + 1 }
      : { ...record, yourWins: record.yourWins + 1 }
  }, { friendWins: 0, yourWins: 0 })
  const recentChallengeScores = sharedChallenges
    .map((challenge) => {
      const participant = challenge.participants.find((item) => item.userId === friend.userId)
      return participant?.summary
        ? {
          challenge,
          summary: participant.summary,
        }
        : null
    })
    .filter((item): item is { challenge: FriendChallengeView; summary: ChallengeSummary } => item !== null)
    .sort((a, b) => b.summary.updatedAt.localeCompare(a.summary.updatedAt))
    .slice(0, 3)

  return (
    <article className="friend-profile-detail">
      <div className="challenge-detail-header">
        <div>
          <small>Friend profile</small>
          <h3>{friend.displayName}</h3>
          <p>{sharedSquads.length} shared {sharedSquads.length === 1 ? 'squad' : 'squads'} · {sharedChallenges.length} shared {sharedChallenges.length === 1 ? 'challenge' : 'challenges'}</p>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="friend-profile-grid">
        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Recent score</p>
              <h3>Leaderboard</h3>
            </div>
          </div>
          <div className="leaderboard-stats">
            <span><small>7-day</small><strong>{formatSummaryMetric(friend.summary, 'showWeeklyCompletion', (summary) => `${summary.weeklyCompletion}%`)}</strong></span>
            <span><small>Avg</small><strong>{formatSummaryMetric(friend.summary, 'showAverageCompletion', (summary) => `${summary.averageCompletion}%`)}</strong></span>
            <span><small>Streak</small><strong>{formatSummaryMetric(friend.summary, 'showStreak', (summary) => String(summary.currentStreak))}</strong></span>
            <span><small>Logged</small><strong>{formatSummaryMetric(friend.summary, 'showLoggedDays', (summary) => `${summary.loggedDays}/${summary.totalDays}`)}</strong></span>
          </div>
        </section>

        <section className="challenge-detail-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">Head-to-head</p>
              <h3>Shared challenges</h3>
            </div>
          </div>
          <div className="challenge-roster-grid">
            <span><small>{friend.displayName}</small><strong>{headToHead.friendWins}</strong></span>
            <span><small>{currentUser?.displayName ?? 'You'}</small><strong>{headToHead.yourWins}</strong></span>
            <span><small>Total</small><strong>{sharedChallenges.length}</strong></span>
          </div>
        </section>
      </div>

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Shared squads</p>
            <h3>Groups together</h3>
          </div>
        </div>
        {sharedSquads.length === 0 ? (
          <p className="empty-leaderboard">No shared squads yet.</p>
        ) : (
          <div className="squad-member-list">
            {sharedSquads.map((squad) => <span key={squad.id}>{squad.name}</span>)}
          </div>
        )}
      </section>

      <section className="challenge-detail-section">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Recent challenge scores</p>
            <h3>Published history</h3>
          </div>
        </div>
        {recentChallengeScores.length === 0 ? (
          <p className="empty-leaderboard">No shared challenge scores published yet.</p>
        ) : (
          <div className="participant-history-list">
            {recentChallengeScores.map(({ challenge, summary }) => (
              <article className="participant-history-row" key={challenge.id}>
                <div>
                  <strong>{challenge.name}</strong>
                  <span>Updated {formatActivityDate(summary.updatedAt)}{summary.note ? ` · ${summary.note}` : ''}</span>
                </div>
                <b>{formatSummaryMetric(summary, 'showWeeklyCompletion', (item) => `${item.weeklyCompletion}%`)}</b>
              </article>
            ))}
          </div>
        )}
      </section>
    </article>
  )
}

function LeaderboardCard({ row, rank, onOpenProfile }: { row: LeaderboardRow; rank: number; onOpenProfile?: () => void }) {
  const summary = row.summary

  return (
    <article className={`leaderboard-card ${row.isCurrentUser ? 'is-you' : ''}`}>
      <div className="leaderboard-rank">{rank}</div>
      <div className="leaderboard-main">
        <div className="leaderboard-name-row">
          <strong>{row.displayName}</strong>
          {row.isCurrentUser && <span>You</span>}
        </div>
        <small>{summary?.challengeTitle ?? 'No score published yet'}</small>
      </div>
      <div className="leaderboard-stats">
        <span><small>7-day</small><strong>{formatSummaryMetric(summary, 'showWeeklyCompletion', (item) => `${item.weeklyCompletion}%`)}</strong></span>
        <span><small>Avg</small><strong>{formatSummaryMetric(summary, 'showAverageCompletion', (item) => `${item.averageCompletion}%`)}</strong></span>
        <span><small>Streak</small><strong>{formatSummaryMetric(summary, 'showStreak', (item) => String(item.currentStreak))}</strong></span>
        <span><small>Logged</small><strong>{formatSummaryMetric(summary, 'showLoggedDays', (item) => `${item.loggedDays}/${item.totalDays}`)}</strong></span>
      </div>
      {onOpenProfile && (
        <button className="ghost-button leaderboard-profile-button" type="button" onClick={onOpenProfile}>
          View Profile
        </button>
      )}
    </article>
  )
}

function formatSummaryMetric(
  summary: ChallengeSummary | null,
  privacyKey: keyof PrivacySettings,
  format: (summary: ChallengeSummary) => string,
): string {
  if (!summary) return '—'
  return summary.privacy[privacyKey] ? format(summary) : 'Private'
}
