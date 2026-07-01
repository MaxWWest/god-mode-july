import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import type {
  AccentColor,
  ChallengeSettings,
  ChallengeTargets,
  DataStatus,
  DietGoalType,
  DietTrackingSource,
  EntryMap,
  ExerciseCycleDays,
  FoodCategory,
  ReminderSettings,
  RuleCategoryConfig,
  RuleConfig,
  RuleKey,
  RuleWeight,
  SyncConflict,
  ThemeMode,
} from '../types'
import {
  DEFAULT_RULE_CATEGORIES,
  FOOD_CATEGORIES,
  WORKOUT_TYPES,
  downloadTextFile,
  entriesToCsv,
  formatExercisePatternDayLabel,
  formatExercisePatternSchedule,
  formatShortDate,
  getEnabledRules,
  getDietTrackingSource,
  getScoredRules,
  makeBackupPayload,
  makeCustomRule,
  normalizeSettings,
  readBackupFile,
  sanitizeFilenamePart,
  todayIso,
} from '../tracker'
import { NumberField, SectionTitle, TextField } from '../ui'

const DIET_PRESETS = [
  { label: 'Carbs', unit: 'g', goal: 250, goalType: 'maximum' as const, trackingSource: 'carbs' as const },
  { label: 'Fat', unit: 'g', goal: 70, goalType: 'maximum' as const, trackingSource: 'fat' as const },
  { label: 'Fiber', unit: 'g', goal: 30, goalType: 'minimum' as const, trackingSource: 'manual' as const },
  { label: 'Sodium', unit: 'mg', goal: 2300, goalType: 'maximum' as const, trackingSource: 'sodium' as const },
  { label: 'Sugar', unit: 'g', goal: 50, goalType: 'maximum' as const, trackingSource: 'manual' as const },
]

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const ACCENT_OPTIONS: Array<{ value: AccentColor; label: string }> = [
  { value: 'violet', label: 'Violet' },
  { value: 'blue', label: 'Blue' },
  { value: 'teal', label: 'Teal' },
  { value: 'coral', label: 'Coral' },
  { value: 'gold', label: 'Gold' },
]

export default function SettingsView({
  settings,
  entries,
  reminderSettings,
  reminderStatus,
  cloudConfigured,
  cloudStatus,
  cloudBusy,
  online,
  cloudUpdatedAt,
  syncConflict,
  user,
  onSettingsChange,
  onDataImport,
  onReminderChange,
  onRequestReminderPermission,
  onOpenAccount,
  onPushCloud,
  onPullCloud,
  onRetryCloud,
  onExportAccountData,
  onExportDataCsv,
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
  online: boolean
  cloudUpdatedAt: string | null
  syncConflict: SyncConflict | null
  user: User | null
  onSettingsChange: (settings: ChallengeSettings) => void
  onDataImport: (settings: ChallengeSettings, entries: EntryMap) => void
  onReminderChange: (settings: ReminderSettings) => void
  onRequestReminderPermission: () => void
  onOpenAccount: () => void
  onPushCloud: () => void
  onPullCloud: () => void
  onRetryCloud: () => void
  onExportAccountData: () => void
  onExportDataCsv: () => void
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
  const [settingsTab, setSettingsTab] = useState<'rules' | 'app'>('rules')
  const categories = DEFAULT_RULE_CATEGORIES

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

  function addDietPreset(preset: typeof DIET_PRESETS[number]) {
    const category = categories.find((item) => item.key === 'diet') ?? categories[1]
    const rule = makeCustomRule(category)
    rule.label = preset.label
    rule.diet = { unit: preset.unit, goal: preset.goal, goalType: preset.goalType, trackingSource: preset.trackingSource ?? 'manual' }
    update({ rules: [...settings.rules, rule] })
  }

  function updateExerciseRule(rule: RuleConfig, patch: Partial<NonNullable<RuleConfig['exercise']>>) {
    if (!rule.exercise) return
    updateRule(rule.key, { exercise: { ...rule.exercise, ...patch } })
  }

  function updateExerciseCycle(rule: RuleConfig, cycleDays: ExerciseCycleDays) {
    if (!rule.exercise) return
    const scheduledDays = rule.exercise.scheduledDays.filter((day) => day <= cycleDays)
    updateExerciseRule(rule, { cycleDays, scheduledDays: scheduledDays.length > 0 ? scheduledDays : [1] })
  }

  function toggleExerciseDay(rule: RuleConfig, day: number) {
    if (!rule.exercise) return
    const selected = rule.exercise.scheduledDays.includes(day)
    const scheduledDays = selected
      ? rule.exercise.scheduledDays.filter((item) => item !== day)
      : [...rule.exercise.scheduledDays, day].sort((a, b) => a - b)
    if (scheduledDays.length > 0) updateExerciseRule(rule, { scheduledDays })
  }

  function updateDietRule(rule: RuleConfig, patch: Partial<NonNullable<RuleConfig['diet']>>) {
    if (!rule.diet) return
    const diet = { ...rule.diet, ...patch }
    if (diet.goalType === 'avoid') diet.goal = 0
    updateRule(rule.key, { diet })
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
        <p className="eyebrow">Control center</p>
        <h2>Settings</h2>
        <p>{activeRuleCount} active rules · app, data, and scoring controls</p>
      </section>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button className={settingsTab === 'rules' ? 'active' : ''} type="button" role="tab" aria-selected={settingsTab === 'rules'} onClick={() => setSettingsTab('rules')}>Rules + Goals</button>
        <button className={settingsTab === 'app' ? 'active' : ''} type="button" role="tab" aria-selected={settingsTab === 'app'} onClick={() => setSettingsTab('app')}>App + Account</button>
      </div>

      {settingsTab === 'app' ? (
        <>
          <section className="panel form-panel">
            <SectionTitle number="1" title="Appearance" />
            <div className="appearance-setting">
              <span>Theme</span>
              <div className="appearance-segmented" role="group" aria-label="Color mode">
                {THEME_OPTIONS.map((option) => (
                  <button className={settings.appearance.theme === option.value ? 'active' : ''} type="button" key={option.value} aria-pressed={settings.appearance.theme === option.value} onClick={() => update({ appearance: { ...settings.appearance, theme: option.value } })}>{option.label}</button>
                ))}
              </div>
            </div>
            <div className="appearance-setting">
              <span>Accent</span>
              <div className="accent-swatches" role="group" aria-label="Accent color">
                {ACCENT_OPTIONS.map((option) => (
                  <button className={`accent-swatch swatch-${option.value} ${settings.appearance.accent === option.value ? 'active' : ''}`} type="button" key={option.value} aria-label={option.label} aria-pressed={settings.appearance.accent === option.value} onClick={() => update({ appearance: { ...settings.appearance, accent: option.value } })}><span /></button>
                ))}
              </div>
            </div>
          </section>
          <section className="panel form-panel">
            <SectionTitle number="2" title="Tracker" />
            <TextField label="Title" value={settings.title} commitOnBlur onChange={(title) => update({ title })} />
            <TextField label="Tracking since" type="date" value={settings.startDate} onChange={updateStartDate} />
          </section>
          <section className="panel form-panel">
            <SectionTitle number="3" title="Data" />
            <div className="data-actions">
              <button className="secondary-button" type="button" onClick={exportJsonBackup}>Export JSON</button>
              <label className="secondary-button file-import-label"><span>Import JSON</span><input type="file" accept="application/json,.json" onChange={importJsonBackup} /></label>
              <button className="secondary-button" type="button" onClick={exportCsv}>Export CSV</button>
            </div>
            <p className={`data-status ${dataStatus.tone}`}>{dataStatus.message}</p>
          </section>
          <section className="panel form-panel">
            <SectionTitle number="4" title="Cloud Sync" />
            <CloudSyncPanel
              configured={cloudConfigured} user={user} status={cloudStatus} busy={cloudBusy} online={online}
              updatedAt={cloudUpdatedAt} conflict={syncConflict} onOpenAccount={onOpenAccount} onPushCloud={onPushCloud}
              onPullCloud={onPullCloud} onRetryCloud={onRetryCloud} onExportAccountData={onExportAccountData}
              onExportDataCsv={onExportDataCsv}
              onDeleteCloudAccountData={onDeleteCloudAccountData} onUseCloudVersion={onUseCloudVersion}
              onKeepLocalVersion={onKeepLocalVersion} onMergeCloudEntries={onMergeCloudEntries}
              onDismissConflict={onDismissConflict}
            />
          </section>
          <section className="panel form-panel">
            <SectionTitle number="5" title="Reminders" />
            <ReminderPanel settings={reminderSettings} status={reminderStatus} onChange={onReminderChange} onRequestPermission={onRequestReminderPermission} />
          </section>
        </>
      ) : (
        <>
          <section className="panel form-panel">
            <SectionTitle number="1" title="Scoring" />
            <div className="rule-glossary">
              <span><strong>Scored</strong> counts toward today’s percent and streaks.</span>
              <span><strong>Non-negotiable</strong> counts double.</span>
              <span><strong>Supporting</strong> counts once.</span>
              <span><strong>Active</strong> counts now; inactive stays saved.</span>
            </div>
            <NumberField label="Sleep target" value={settings.targets.sleepHours} min={0.25} max={24} step={0.25} commitOnBlur onChange={(value) => value !== null && updateTargets({ sleepHours: value })} suffix="hr" />
          </section>

          {categories.map((category, categoryIndex) => {
            const categoryRules = getScoredRules(settings).filter((rule) => rule.category === category.key)
            return (
              <section className="panel form-panel" key={category.key}>
                <div className="settings-rule-category-header">
                  <SectionTitle number={String(categoryIndex + 2)} title={`${category.label} Rules`} />
                  <button className="secondary-button compact-button" type="button" onClick={() => addRule(category)}>
                    {category.key === 'exercise' ? 'Add Pattern' : category.key === 'diet' ? 'Add Diet Goal' : 'Add Rule'}
                  </button>
                </div>
                {category.key === 'diet' && (
                  <div className="diet-preset-row" aria-label="Common diet goals">
                    {DIET_PRESETS.map((preset) => <button className="ghost-button compact-button" type="button" key={preset.label} onClick={() => addDietPreset(preset)}>+ {preset.label}</button>)}
                  </div>
                )}
                <div className="settings-rule-list">
                  {categoryRules.length === 0 && <p className="empty-rule-category">No {category.label.toLowerCase()} rules yet.</p>}
                  {categoryRules.map((rule, ruleIndex) => (
                    <article className={`settings-rule-row rule-config-card ${rule.enabled ? '' : 'is-disabled'}`} data-rule-category={category.key} key={rule.key}>
                      <header className="rule-card-heading">
                        <span className="rule-card-number">{String(ruleIndex + 1).padStart(2, '0')}</span>
                        <div><strong>{rule.label.trim() || 'Untitled rule'}</strong><small>{category.label} · {rule.weight === 'nonNegotiable' ? 'Non-negotiable' : 'Supporting'}</small></div>
                        <span className={`rule-card-state ${rule.enabled ? 'active' : ''}`}>{rule.enabled ? 'Active' : 'Inactive'}</span>
                      </header>
                      <div className="rule-editor-main">
                        <DraftSymbolField label={`${rule.label} icon`} value={rule.icon} onCommit={(icon) => updateRule(rule.key, { icon })} />
                        <TextField label="Rule" value={rule.label} commitOnBlur onChange={(label) => updateRule(rule.key, { label })} />
                      </div>
                      <div className="settings-rule-controls">
                        <label className="mini-check-field"><input type="checkbox" checked={rule.enabled} onChange={(event) => updateRule(rule.key, { enabled: event.target.checked })} /><span>Active</span></label>
                        <label className="weight-field"><span>Weight</span><select value={rule.weight} onChange={(event) => updateRule(rule.key, { weight: event.target.value as RuleWeight })}><option value="nonNegotiable">Non-negotiable</option><option value="supporting">Supporting</option></select></label>
                        <label className="weight-field"><span>Group</span><select value={rule.category} onChange={(event) => updateRule(rule.key, { category: event.target.value })}>{categories.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
                        <button className="danger-button" type="button" onClick={() => removeRule(rule.key)}>Remove</button>
                      </div>
                      {rule.exercise && (
                        <div className="rule-specific-controls">
                          <label className="weight-field"><span>Pattern</span><select value={rule.exercise.cycleDays} onChange={(event) => updateExerciseCycle(rule, Number(event.target.value) as ExerciseCycleDays)}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label>
                          <label className="weight-field"><span>Exercise type</span><select value={rule.exercise.workoutType} onChange={(event) => updateExerciseRule(rule, { workoutType: event.target.value })}>{['Any exercise', ...WORKOUT_TYPES].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                          <NumberField label="Target" value={rule.exercise.targetMinutes} min={1} max={300} step={5} commitOnBlur onChange={(value) => value !== null && updateExerciseRule(rule, { targetMinutes: value })} suffix="min" />
                          <div className="pattern-day-field">
                            <span>Training days</span>
                            <div className={`pattern-day-grid cycle-${rule.exercise.cycleDays}`}>
                              {Array.from({ length: rule.exercise.cycleDays }, (_, index) => index + 1).map((day) => {
                                const label = formatExercisePatternDayLabel(rule, day, settings)
                                return <button className={rule.exercise?.scheduledDays.includes(day) ? 'active' : ''} type="button" key={day} aria-label={`${label} ${rule.exercise?.scheduledDays.includes(day) ? 'training day' : 'rest day'}`} onClick={() => toggleExerciseDay(rule, day)}>{rule.exercise?.cycleDays === 30 ? day : label}</button>
                              })}
                            </div>
                            <small>{formatExercisePatternSchedule(rule, settings)} · anchored to {formatShortDate(settings.startDate)}</small>
                          </div>
                        </div>
                      )}
                      {rule.diet && (
                        <div className="rule-specific-controls diet-rule-controls">
                          <label className="weight-field"><span>Goal</span><select value={rule.diet.goalType} onChange={(event) => updateDietRule(rule, { goalType: event.target.value as DietGoalType })}><option value="minimum">At least</option><option value="maximum">At most</option><option value="avoid">Avoid</option></select></label>
                          <label className="weight-field"><span>Meal tracking</span><select value={getDietTrackingSource(rule)} onChange={(event) => updateDietRule(rule, { trackingSource: event.target.value as DietTrackingSource })}><option value="manual">Manual value</option><option value="calories">Meal calories</option><option value="protein">Meal protein</option><option value="carbs">Meal carbs</option><option value="fat">Meal fat</option><option value="sodium">Meal sodium</option><option value="foodCategory">Food category</option></select></label>
                          {getDietTrackingSource(rule) === 'foodCategory' && <label className="weight-field"><span>Category</span><select value={rule.diet.foodCategory ?? 'other'} onChange={(event) => updateDietRule(rule, { foodCategory: event.target.value as FoodCategory, trackingSource: 'foodCategory' })}>{FOOD_CATEGORIES.map((category) => <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>)}</select></label>}
                          {rule.diet.goalType !== 'avoid' && <NumberField label="Amount" value={rule.diet.goal} min={0} max={100000} step={rule.diet.unit.toLowerCase() === 'l' ? 0.1 : 1} commitOnBlur onChange={(value) => value !== null && updateDietRule(rule, { goal: value })} suffix={rule.diet.unit} />}
                          <TextField label="Unit" value={rule.diet.unit} commitOnBlur onChange={(unit) => updateDietRule(rule, { unit })} />
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function DraftSymbolField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  function commit() {
    const nextValue = draft.trim().slice(0, 2)
    if (!nextValue) {
      setDraft(value)
      return
    }
    setDraft(nextValue)
    onCommit(nextValue)
  }

  return (
    <label className="symbol-field">
      <span>Icon</span>
      <input value={draft} maxLength={2} onChange={(event) => setDraft(event.target.value)} onBlur={commit} aria-label={label} />
    </label>
  )
}

function CloudSyncPanel({
  configured,
  user,
  status,
  busy,
  online,
  updatedAt,
  conflict,
  onOpenAccount,
  onPushCloud,
  onPullCloud,
  onRetryCloud,
  onExportAccountData,
  onExportDataCsv,
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
  online: boolean
  updatedAt: string | null
  conflict: SyncConflict | null
  onOpenAccount: () => void
  onPushCloud: () => void
  onPullCloud: () => void
  onRetryCloud: () => void
  onExportAccountData: () => void
  onExportDataCsv: () => void
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
            <button className="ghost-button" type="button" onClick={onOpenAccount} disabled={busy}>
              Manage Account
            </button>
          </div>
          <div className="data-actions">
            <button className="secondary-button" type="button" onClick={onPushCloud} disabled={busy || !online}>
              Push Local
            </button>
            <button className="secondary-button" type="button" onClick={onPullCloud} disabled={busy || !online}>
              Pull Cloud
            </button>
          </div>
          <p className="cloud-updated">Cloud snapshot: {updatedLabel}</p>
          <div className="account-data-panel">
            <div>
              <small>Account data</small>
              <p>Export or delete the cloud records this app stores for your signed-in account.</p>
            </div>
            <div className="account-data-actions">
              <button className="secondary-button" type="button" onClick={onExportAccountData} disabled={busy || !online}>
                Export Account Data
              </button>
              <button className="secondary-button" type="button" onClick={onExportDataCsv} disabled={busy || !online}>
                Export Data CSV
              </button>
              <button className="danger-button" type="button" onClick={onDeleteCloudAccountData} disabled={busy || !online}>
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
                <button className="secondary-button" type="button" onClick={onMergeCloudEntries} disabled={busy || !online}>
                  Merge Daily Entries
                </button>
                <button className="secondary-button" type="button" onClick={onUseCloudVersion} disabled={busy}>
                  Use Cloud
                </button>
                <button className="secondary-button" type="button" onClick={onKeepLocalVersion} disabled={busy || !online}>
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
        <div className="account-data-panel">
          <div>
            <small>No account connected</small>
            <p>Account creation and sign-in now live in the dedicated Account window.</p>
          </div>
          <button className="secondary-button" type="button" onClick={onOpenAccount} disabled={busy || !online}>
            Open Account
          </button>
        </div>
      )}
      <div className="status-with-action">
        <p className={`data-status ${status.tone}`}>{busy ? 'Working...' : status.message}</p>
        {status.retryable && (
          <button className="ghost-button compact-button" type="button" onClick={onRetryCloud} disabled={busy || !online}>
            Retry Connection
          </button>
        )}
      </div>
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
        <TextField label="Message" value={settings.message} commitOnBlur onChange={(message) => onChange({ ...settings, message })} />
      </div>
      <button className="secondary-button" type="button" onClick={onRequestPermission}>
        Allow Local Notifications
      </button>
      <p className={`data-status ${status.tone}`}>{status.message}</p>
    </div>
  )
}
