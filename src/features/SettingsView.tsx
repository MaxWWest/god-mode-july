import { useState } from 'react'
import type { ChangeEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import type {
  ChallengeSettings,
  ChallengeTargets,
  DataStatus,
  EntryMap,
  ReminderSettings,
  RuleCategoryConfig,
  RuleConfig,
  RuleKey,
  RuleWeight,
  SyncConflict,
} from '../types'
import {
  DEFAULT_RULE_CATEGORIES,
  downloadTextFile,
  entriesToCsv,
  getEnabledRules,
  getScoredRules,
  makeBackupPayload,
  makeCategoryKey,
  makeCustomRule,
  normalizeCategoryLabel,
  normalizeSettings,
  readBackupFile,
  sanitizeFilenamePart,
  todayIso,
} from '../tracker'
import { NumberField, SectionTitle, TextField } from '../ui'

export default function SettingsView({
  settings,
  entries,
  reminderSettings,
  reminderStatus,
  cloudConfigured,
  cloudStatus,
  cloudBusy,
  cloudUpdatedAt,
  syncConflict,
  user,
  authEmail,
  authPassword,
  onSettingsChange,
  onDataImport,
  onReminderChange,
  onRequestReminderPermission,
  onAuthEmailChange,
  onAuthPasswordChange,
  onSignInWithPassword,
  onCreatePasswordAccount,
  onSetAccountPassword,
  onSendMagicLink,
  onSendPasswordReset,
  onSignOut,
  onPushCloud,
  onPullCloud,
  onExportAccountData,
  onDeleteCloudAccountData,
  onUseCloudVersion,
  onKeepLocalVersion,
  onMergeCloudEntries,
  onDismissConflict,
}: {
  settings: ChallengeSettings
  entries: EntryMap
  reminderSettings: ReminderSettings
  reminderStatus: DataStatus
  cloudConfigured: boolean
  cloudStatus: DataStatus
  cloudBusy: boolean
  cloudUpdatedAt: string | null
  syncConflict: SyncConflict | null
  user: User | null
  authEmail: string
  authPassword: string
  onSettingsChange: (settings: ChallengeSettings) => void
  onDataImport: (settings: ChallengeSettings, entries: EntryMap) => void
  onReminderChange: (settings: ReminderSettings) => void
  onRequestReminderPermission: () => void
  onAuthEmailChange: (email: string) => void
  onAuthPasswordChange: (password: string) => void
  onSignInWithPassword: () => void
  onCreatePasswordAccount: () => void
  onSetAccountPassword: () => void
  onSendMagicLink: () => void
  onSendPasswordReset: () => void
  onSignOut: () => void
  onPushCloud: () => void
  onPullCloud: () => void
  onExportAccountData: () => void
  onDeleteCloudAccountData: () => void
  onUseCloudVersion: () => void
  onKeepLocalVersion: () => void
  onMergeCloudEntries: () => void
  onDismissConflict: () => void
}) {
  const activeRuleCount = getEnabledRules(settings).length
  const entryCount = Object.keys(entries).length
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    tone: 'neutral',
    message: `${entryCount} saved ${entryCount === 1 ? 'entry' : 'entries'}`,
  })
  const [newCategoryName, setNewCategoryName] = useState('')
  const categories = settings.categories.length > 0 ? settings.categories : DEFAULT_RULE_CATEGORIES

  function update(patch: Partial<ChallengeSettings>) {
    onSettingsChange(normalizeSettings({ ...settings, ...patch }))
  }

  function updateTargets(patch: Partial<ChallengeTargets>) {
    update({ targets: { ...settings.targets, ...patch } })
  }

  function updateRule(key: RuleKey, patch: Partial<RuleConfig>) {
    update({
      rules: settings.rules.map((rule) => rule.key === key ? { ...rule, ...patch } : rule),
    })
  }

  function addRule(category: RuleCategoryConfig) {
    update({
      rules: [...settings.rules, makeCustomRule(category)],
    })
  }

  function addCategory() {
    const label = normalizeCategoryLabel(newCategoryName, '')
    if (!label) return
    const key = makeCategoryKey(label, new Set(categories.map((category) => category.key)))
    update({
      categories: [...categories, { key, label }],
    })
    setNewCategoryName('')
  }

  function removeRule(key: RuleKey) {
    updateRule(key, { enabled: false, deleted: true })
  }

  function updateStartDate(startDate: string) {
    update({
      startDate,
      endDate: settings.endDate < startDate ? startDate : settings.endDate,
    })
  }

  function exportJsonBackup() {
    const payload = makeBackupPayload(settings, entries)
    const filename = `${sanitizeFilenamePart(settings.title)}-${todayIso()}-backup.json`
    downloadTextFile(filename, 'application/json;charset=utf-8', JSON.stringify(payload, null, 2))
    const count = Object.keys(payload.entries).length
    setDataStatus({
      tone: 'success',
      message: `JSON backup exported with ${count} ${count === 1 ? 'entry' : 'entries'}.`,
    })
  }

  function exportCsv() {
    const filename = `${sanitizeFilenamePart(settings.title)}-${todayIso()}-entries.csv`
    downloadTextFile(filename, 'text/csv;charset=utf-8', entriesToCsv(entries, settings))
    setDataStatus({
      tone: 'success',
      message: `CSV exported with ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}.`,
    })
  }

  async function importJsonBackup(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return

    try {
      const backup = await readBackupFile(file)
      const count = Object.keys(backup.entries).length
      const shouldImport = window.confirm(
        `Import ${count} ${count === 1 ? 'entry' : 'entries'} from ${file.name}? This replaces current local settings and entries.`,
      )

      if (!shouldImport) {
        setDataStatus({ tone: 'neutral', message: 'Import canceled.' })
        return
      }

      onDataImport(backup.settings, backup.entries)
      setDataStatus({
        tone: 'success',
        message: `Imported ${count} ${count === 1 ? 'entry' : 'entries'} and tracker settings.`,
      })
    } catch (error) {
      setDataStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not import that backup file.',
      })
    } finally {
      input.value = ''
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">Milestone 4</p>
        <h2>Settings</h2>
        <p>Ongoing tracker · {activeRuleCount} scored rules</p>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="1" title="Data" />
        <div className="data-actions">
          <button className="secondary-button" type="button" onClick={exportJsonBackup}>
            Export JSON
          </button>
          <label className="secondary-button file-import-label">
            <span>Import JSON</span>
            <input type="file" accept="application/json,.json" onChange={importJsonBackup} />
          </label>
          <button className="secondary-button" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
        <p className={`data-status ${dataStatus.tone}`}>{dataStatus.message}</p>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="2" title="Cloud Sync" />
        <CloudSyncPanel
          configured={cloudConfigured}
          user={user}
          status={cloudStatus}
          busy={cloudBusy}
          updatedAt={cloudUpdatedAt}
          conflict={syncConflict}
          authEmail={authEmail}
          authPassword={authPassword}
          onAuthEmailChange={onAuthEmailChange}
          onAuthPasswordChange={onAuthPasswordChange}
          onSignInWithPassword={onSignInWithPassword}
          onCreatePasswordAccount={onCreatePasswordAccount}
          onSetAccountPassword={onSetAccountPassword}
          onSendMagicLink={onSendMagicLink}
          onSendPasswordReset={onSendPasswordReset}
          onSignOut={onSignOut}
          onPushCloud={onPushCloud}
          onPullCloud={onPullCloud}
          onExportAccountData={onExportAccountData}
          onDeleteCloudAccountData={onDeleteCloudAccountData}
          onUseCloudVersion={onUseCloudVersion}
          onKeepLocalVersion={onKeepLocalVersion}
          onMergeCloudEntries={onMergeCloudEntries}
          onDismissConflict={onDismissConflict}
        />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="3" title="Reminders" />
        <ReminderPanel
          settings={reminderSettings}
          status={reminderStatus}
          onChange={onReminderChange}
          onRequestPermission={onRequestReminderPermission}
        />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="4" title="Tracker" />
        <TextField label="Title" value={settings.title} onChange={(title) => update({ title })} />
        <TextField label="Tracking since" type="date" value={settings.startDate} onChange={updateStartDate} />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="5" title="Targets" />
        <div className="field-grid">
          <NumberField label="Exercise target" value={settings.targets.exerciseMinutes} min={1} max={300} onChange={(value) => value !== null && updateTargets({ exerciseMinutes: value })} suffix="min" />
          <NumberField label="Calorie target" value={settings.targets.calories} min={1} max={10000} onChange={(value) => value !== null && updateTargets({ calories: value })} suffix="kcal" />
          <NumberField label="Protein target" value={settings.targets.proteinGrams} min={1} max={500} onChange={(value) => value !== null && updateTargets({ proteinGrams: value })} suffix="g" />
          <NumberField label="Water target" value={settings.targets.waterLiters} min={0.1} max={15} step={0.1} onChange={(value) => value !== null && updateTargets({ waterLiters: value })} suffix="L" />
          <NumberField label="Sleep target" value={settings.targets.sleepHours} min={0.25} max={24} step={0.25} onChange={(value) => value !== null && updateTargets({ sleepHours: value })} suffix="hr" />
        </div>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="6" title="Scored Rules" />
        <div className="rule-glossary">
          <span><strong>Scored</strong> counts toward today’s percent and streaks.</span>
          <span><strong>Non-negotiable</strong> counts double.</span>
          <span><strong>Supporting</strong> counts once.</span>
          <span><strong>Active</strong> counts now; inactive stays saved for later.</span>
        </div>
        <div className="category-create-row">
          <TextField label="New category" value={newCategoryName} onChange={setNewCategoryName} />
          <button className="secondary-button" type="button" onClick={addCategory} disabled={!newCategoryName.trim()}>
            Add Category
          </button>
        </div>
        {categories.map((category) => {
          const categoryRules = getScoredRules(settings).filter((rule) => rule.category === category.key)

          return (
            <div className="settings-rule-category" key={category.key}>
              <div className="settings-rule-category-header">
                <div>
                  <p className="eyebrow">{category.label}</p>
                  <h3>{category.label} Rules</h3>
                </div>
                <button className="secondary-button compact-button" type="button" onClick={() => addRule(category)}>
                  Add Rule
                </button>
              </div>
              <div className="settings-rule-list">
                {categoryRules.length === 0 && <p className="empty-rule-category">No {category.label.toLowerCase()} rules yet.</p>}
                {categoryRules.map((rule) => (
                  <article className={`settings-rule-row ${rule.enabled ? '' : 'is-disabled'}`} key={rule.key}>
                    <label className="symbol-field">
                      <span>Icon</span>
                      <input
                        value={rule.icon}
                        maxLength={2}
                        onChange={(event) => updateRule(rule.key, { icon: event.target.value })}
                        aria-label={`${rule.label} icon`}
                      />
                    </label>
                    <TextField label="Rule" value={rule.label} onChange={(label) => updateRule(rule.key, { label })} />
                    <div className="settings-rule-controls">
                      <label className="mini-check-field">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(event) => updateRule(rule.key, { enabled: event.target.checked })}
                        />
                        <span>Active</span>
                      </label>
                      <label className="weight-field">
                        <span>Weight</span>
                        <select value={rule.weight} onChange={(event) => updateRule(rule.key, { weight: event.target.value as RuleWeight })}>
                          <option value="nonNegotiable">Non-negotiable</option>
                          <option value="supporting">Supporting</option>
                        </select>
                      </label>
                      <label className="weight-field">
                        <span>Group</span>
                        <select value={rule.category} onChange={(event) => updateRule(rule.key, { category: event.target.value })}>
                          {categories.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <button className="danger-button" type="button" onClick={() => removeRule(rule.key)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}

function CloudSyncPanel({
  configured,
  user,
  status,
  busy,
  updatedAt,
  conflict,
  authEmail,
  authPassword,
  onAuthEmailChange,
  onAuthPasswordChange,
  onSignInWithPassword,
  onCreatePasswordAccount,
  onSetAccountPassword,
  onSendMagicLink,
  onSendPasswordReset,
  onSignOut,
  onPushCloud,
  onPullCloud,
  onExportAccountData,
  onDeleteCloudAccountData,
  onUseCloudVersion,
  onKeepLocalVersion,
  onMergeCloudEntries,
  onDismissConflict,
}: {
  configured: boolean
  user: User | null
  status: DataStatus
  busy: boolean
  updatedAt: string | null
  conflict: SyncConflict | null
  authEmail: string
  authPassword: string
  onAuthEmailChange: (email: string) => void
  onAuthPasswordChange: (password: string) => void
  onSignInWithPassword: () => void
  onCreatePasswordAccount: () => void
  onSetAccountPassword: () => void
  onSendMagicLink: () => void
  onSendPasswordReset: () => void
  onSignOut: () => void
  onPushCloud: () => void
  onPullCloud: () => void
  onExportAccountData: () => void
  onDeleteCloudAccountData: () => void
  onUseCloudVersion: () => void
  onKeepLocalVersion: () => void
  onMergeCloudEntries: () => void
  onDismissConflict: () => void
}) {
  const updatedLabel = updatedAt
    ? new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(updatedAt))
    : 'Not synced yet'
  const conflictCloudLabel = conflict?.cloud.updatedAt
    ? new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(conflict.cloud.updatedAt))
    : null
  const conflictLocalLabel = conflict?.localChangedAt
    ? new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(conflict.localChangedAt))
    : null

  if (!configured) {
    return (
      <div className="cloud-panel">
        <p className="cloud-copy">Supabase is not configured for this build. Add the Vite env vars, run the SQL schema, and redeploy to turn on sign-in and multi-device sync.</p>
        <p className="data-status neutral">Local tracking, backups, and CSV export still work.</p>
      </div>
    )
  }

  return (
    <div className="cloud-panel">
      {user ? (
        <>
          <div className="sync-account-row">
            <div>
              <small>Signed in</small>
              <strong>{user.email}</strong>
            </div>
            <button className="ghost-button" type="button" onClick={onSignOut} disabled={busy}>
              Sign out
            </button>
          </div>
          <div className="data-actions">
            <button className="secondary-button" type="button" onClick={onPushCloud} disabled={busy}>
              Push Local
            </button>
            <button className="secondary-button" type="button" onClick={onPullCloud} disabled={busy}>
              Pull Cloud
            </button>
          </div>
          <p className="cloud-updated">Cloud snapshot: {updatedLabel}</p>
          <div className="account-data-panel">
            <div>
              <small>Password sign-in</small>
              <p>Set or update the password for this account so you can sign in without magic links.</p>
            </div>
            <div className="password-update-actions">
              <TextField label="New Password" type="password" value={authPassword} onChange={onAuthPasswordChange} />
              <button className="secondary-button" type="button" onClick={onSetAccountPassword} disabled={busy}>
                Set Password
              </button>
            </div>
          </div>
          <div className="account-data-panel">
            <div>
              <small>Account data</small>
              <p>Export or delete the cloud records this app stores for your signed-in account.</p>
            </div>
            <div className="account-data-actions">
              <button className="secondary-button" type="button" onClick={onExportAccountData} disabled={busy}>
                Export Account Data
              </button>
              <button className="danger-button" type="button" onClick={onDeleteCloudAccountData} disabled={busy}>
                Delete Cloud Data
              </button>
            </div>
          </div>
          {conflict && (
            <div className="sync-conflict-panel">
              <div>
                <p className="eyebrow">Sync conflict</p>
                <h3>Choose a version</h3>
                <p>{conflict.message}</p>
                <small>
                  Cloud: {conflictCloudLabel ?? 'unknown'} · This device: {conflictLocalLabel ?? 'unsynced local data'}
                </small>
              </div>
              <div className="sync-conflict-actions">
                <button className="secondary-button" type="button" onClick={onMergeCloudEntries} disabled={busy}>
                  Merge Daily Entries
                </button>
                <button className="secondary-button" type="button" onClick={onUseCloudVersion} disabled={busy}>
                  Use Cloud
                </button>
                <button className="secondary-button" type="button" onClick={onKeepLocalVersion} disabled={busy}>
                  Keep Local
                </button>
                <button className="ghost-button" type="button" onClick={onDismissConflict} disabled={busy}>
                  Decide Later
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="auth-stack">
          <div className="field-grid">
            <TextField label="Email" type="email" value={authEmail} onChange={onAuthEmailChange} />
            <TextField label="Password" type="password" value={authPassword} onChange={onAuthPasswordChange} />
          </div>
          <div className="auth-actions">
            <button className="secondary-button" type="button" onClick={onSignInWithPassword} disabled={busy}>
              Sign In
            </button>
            <button className="secondary-button" type="button" onClick={onCreatePasswordAccount} disabled={busy}>
              Create Account
            </button>
          </div>
          <div className="auth-form">
            <button className="secondary-button" type="button" onClick={onSendMagicLink} disabled={busy}>
              Send Magic Link Backup
            </button>
            <button className="ghost-button" type="button" onClick={onSendPasswordReset} disabled={busy}>
              Reset Password
            </button>
          </div>
        </div>
      )}
      <p className={`data-status ${status.tone}`}>{busy ? 'Working...' : status.message}</p>
    </div>
  )
}

function ReminderPanel({
  settings,
  status,
  onChange,
  onRequestPermission,
}: {
  settings: ReminderSettings
  status: DataStatus
  onChange: (settings: ReminderSettings) => void
  onRequestPermission: () => void
}) {
  return (
    <div className="reminder-panel">
      <label className="check-field">
        <span>Daily check-in reminder</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
        />
      </label>
      <div className="field-grid">
        <TextField label="Time" type="time" value={settings.time} onChange={(time) => onChange({ ...settings, time })} />
        <TextField label="Message" value={settings.message} onChange={(message) => onChange({ ...settings, message })} />
      </div>
      <button className="secondary-button" type="button" onClick={onRequestPermission}>
        Allow Local Notifications
      </button>
      <p className={`data-status ${status.tone}`}>{status.message}</p>
    </div>
  )
}
