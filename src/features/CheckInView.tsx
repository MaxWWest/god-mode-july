import type { ChallengeSettings, DailyEntry, RuleConfig, WorkoutLog } from '../types'
import { MealLogger } from '../components/DailyLoggers'
import {
  MAX_WORKOUT_LOGS,
  MAX_WORKOUT_MINUTES,
  WORKOUT_TYPES,
  formatDateTime,
  formatExercisePatternSchedule,
  formatShortDate,
  foodCategoryCount,
  foodLogsEntryPatch,
  getDietFoodCategory,
  getDietRuleValue,
  getEnabledRules,
  getExerciseMinutes,
  getExerciseRuleMinutes,
  getNextExerciseDate,
  isDietRuleAutomaticallyTracked,
  makeEmptyWorkout,
  normalizeWorkoutLogs,
  workoutMinutesTotal,
} from '../tracker'
import {
  CheckField,
  NumberField,
  RatingField,
  SectionTitle,
  SelectField,
  TextArea,
} from '../ui'

export default function CheckInView({
  entry,
  settings,
  isFinalized,
  onUpdate,
  onFinalizeDay,
  onUnlockDay,
  onShareDay,
}: {
  entry: DailyEntry
  settings: ChallengeSettings
  isFinalized: boolean
  onUpdate: (patch: Partial<DailyEntry>) => void
  onFinalizeDay: () => void
  onUnlockDay: () => void
  onShareDay: () => void
}) {
  const workoutLogs = Array.isArray(entry.workouts) ? entry.workouts : []
  const workoutTotal = getExerciseMinutes(entry)
  const activeRules = getEnabledRules(settings, entry.date)
  const allExerciseRules = getEnabledRules(settings).filter((rule) => rule.category === 'exercise' && rule.exercise)
  const exerciseRules = activeRules.filter((rule) => rule.category === 'exercise' && rule.exercise)
  const restExerciseRules = allExerciseRules.filter((rule) => !exerciseRules.some((activeRule) => activeRule.key === rule.key))
  const dietRules = activeRules.filter((rule) => rule.category === 'diet' && rule.diet)
  const habitRules = activeRules.filter((rule) => (rule.category === 'mental' || rule.category === 'misc') && rule.key !== 'sleep')
  const nextExercise = allExerciseRules
    .map((rule) => ({ rule, date: getNextExerciseDate(rule, entry.date, settings) }))
    .filter((item): item is { rule: RuleConfig; date: string } => item.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  function updateWorkouts(nextWorkouts: WorkoutLog[]) {
    const workouts = normalizeWorkoutLogs(nextWorkouts)
    onUpdate({ workouts, exerciseMinutes: workoutMinutesTotal(workouts) })
  }

  function updateWorkout(id: string, patch: Partial<WorkoutLog>) {
    updateWorkouts(workoutLogs.map((workout) => workout.id === id ? { ...workout, ...patch } : workout))
  }

  function addWorkout() {
    if (workoutLogs.length >= MAX_WORKOUT_LOGS) return
    const plannedType = exerciseRules.find((rule) => rule.exercise?.workoutType !== 'Any exercise')?.exercise?.workoutType
    const workout = makeEmptyWorkout()
    updateWorkouts([...workoutLogs, { ...workout, type: plannedType ?? workout.type }])
  }

  function removeWorkout(id: string) {
    updateWorkouts(workoutLogs.filter((workout) => workout.id !== id))
  }

  function updateFoods(foods: DailyEntry['foods']) {
    onUpdate(foodLogsEntryPatch(foods))
  }

  function updateDietValue(rule: RuleConfig, value: number | null) {
    const ruleValues = { ...entry.ruleValues }
    if (value === null) delete ruleValues[rule.key]
    else ruleValues[rule.key] = value
    onUpdate({
      ruleValues,
      calories: rule.key === 'calories' ? value : entry.calories,
      proteinGrams: rule.key === 'protein' ? value : entry.proteinGrams,
      waterLiters: rule.key === 'water' ? value : entry.waterLiters,
    })
  }

  function updateRuleCheck(rule: RuleConfig, checked: boolean) {
    onUpdate({
      sober: rule.key === 'sober' ? checked : entry.sober,
      readTenPages: rule.key === 'reading' ? checked : entry.readTenPages,
      journaled: rule.key === 'journal' ? checked : entry.journaled,
      ruleCompletions: { ...entry.ruleCompletions, [rule.key]: checked },
    })
  }

  function ruleChecked(rule: RuleConfig) {
    if (rule.key === 'sober') return entry.sober
    if (rule.key === 'reading') return entry.readTenPages
    if (rule.key === 'journal') return entry.journaled
    return entry.ruleCompletions?.[rule.key] === true
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">{isFinalized ? 'Finalized' : 'Daily input'}</p>
        <h2>Check-In</h2>
        <p>{isFinalized && entry.finalizedAt ? `Locked ${formatDateTime(entry.finalizedAt)}.` : 'Track the facts. Honest data is more useful than a perfect score.'}</p>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="1" title="Exercise" />
        {exerciseRules.length > 0 && (
          <div className="today-plan-list">
            {exerciseRules.map((rule) => (
              <article className="today-plan-row" key={rule.key}>
                <span>{rule.icon}</span>
                <div>
                  <strong>{rule.label}</strong>
                  <small>{rule.exercise?.workoutType} · {rule.exercise?.targetMinutes} min · {formatExercisePatternSchedule(rule, settings)}</small>
                </div>
                <b>{getExerciseRuleMinutes(entry, rule)} min</b>
              </article>
            ))}
          </div>
        )}
        {restExerciseRules.length > 0 && (
          <div className="rest-day-banner">
            <span aria-hidden="true">◒</span>
            <div>
              <strong>{exerciseRules.length === 0 ? 'Recovery day' : `${restExerciseRules.length} resting pattern${restExerciseRules.length === 1 ? '' : 's'}`}</strong>
              <small>
                {exerciseRules.length === 0 ? 'No planned exercise today. ' : ''}
                {nextExercise ? `Next: ${nextExercise.rule.label} on ${formatShortDate(nextExercise.date)}.` : 'No upcoming exercise is scheduled.'}
                {exerciseRules.length === 0 ? ' Optional movement can still be logged.' : ''}
              </small>
            </div>
          </div>
        )}
        {allExerciseRules.length === 0 && <p className="empty-workout-log">No active exercise pattern. Add one from Settings.</p>}
        <div className="workout-summary">
          <div>
            <strong>{workoutTotal} min logged</strong>
            <span>{workoutLogs.length} {workoutLogs.length === 1 ? 'exercise' : 'exercises'} today</span>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={addWorkout} disabled={isFinalized || workoutLogs.length >= MAX_WORKOUT_LOGS}>
            Add Exercise
          </button>
        </div>
        {workoutLogs.length > 0 && (
          <div className="workout-log-list">
            {workoutLogs.map((workout) => (
              <article className="workout-log-row" key={workout.id}>
                <SelectField disabled={isFinalized} label="Type" value={workout.type} options={WORKOUT_TYPES} onChange={(type) => updateWorkout(workout.id, { type })} />
                <NumberField disabled={isFinalized} label="Minutes" value={workout.minutes} min={0} max={MAX_WORKOUT_MINUTES} step={5} onChange={(value) => updateWorkout(workout.id, { minutes: value ?? 0 })} suffix="min" />
                <button className="ghost-button workout-remove-button" type="button" onClick={() => removeWorkout(workout.id)} disabled={isFinalized}>Remove</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel form-panel">
        <SectionTitle number="2" title="Diet" />
        <MealLogger foods={entry.foods ?? []} disabled={isFinalized} detailed onChange={updateFoods} />
        {dietRules.length === 0 ? (
          <p className="empty-rule-category">No active diet goals. Add them from Settings.</p>
        ) : (
          <div className="diet-goal-review">
            <div className="diet-status-grid">
              {dietRules.filter(isDietRuleAutomaticallyTracked).map((rule) => {
                const category = getDietFoodCategory(rule)
                const categoryHits = category ? foodCategoryCount(entry, category) : 0
                const value = getDietRuleValue(entry, rule)
                return (
                  <article key={rule.key}>
                    <span>{rule.label}</span>
                    <strong>{category
                      ? ((entry.foods ?? []).length === 0 ? 'Awaiting meals' : categoryHits === 0 ? 'Avoided' : `${categoryHits} logged`)
                      : `${value ?? 0} ${rule.diet?.unit ?? ''}`}</strong>
                    <small>Updated from meal items</small>
                  </article>
                )
              })}
            </div>
            <div className="field-grid">
              {dietRules.filter((rule) => !isDietRuleAutomaticallyTracked(rule)).map((rule) => rule.diet?.goalType === 'avoid' ? (
                <CheckField key={rule.key} disabled={isFinalized} label={`Avoided ${rule.label}`} checked={ruleChecked(rule)} onChange={(checked) => updateRuleCheck(rule, checked)} />
              ) : (
                <NumberField
                  key={rule.key}
                  disabled={isFinalized}
                  label={`${rule.label} (${rule.diet?.goalType === 'minimum' ? 'at least' : 'at most'} ${rule.diet?.goal} ${rule.diet?.unit})`}
                  value={getDietRuleValue(entry, rule)}
                  min={0}
                  max={100000}
                  step={rule.diet?.unit.toLowerCase() === 'l' ? 0.1 : 1}
                  onChange={(value) => updateDietValue(rule, value)}
                  suffix={rule.diet?.unit ?? ''}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel form-panel">
        <SectionTitle number="3" title="Mental + Misc" />
        {habitRules.length === 0 ? (
          <p className="empty-rule-category">No active mental or miscellaneous rules.</p>
        ) : habitRules.map((rule) => (
          <CheckField key={rule.key} disabled={isFinalized} label={rule.label} checked={ruleChecked(rule)} onChange={(checked) => updateRuleCheck(rule, checked)} />
        ))}
      </section>

      <section className="panel form-panel">
        <SectionTitle number="4" title="Body Signals" />
        <div className="field-grid">
          <NumberField disabled={isFinalized} label={`Sleep hours (${settings.targets.sleepHours} hr target)`} value={entry.sleepHours} min={0} max={24} step={0.25} onChange={(value) => onUpdate({ sleepHours: value })} suffix="hours" />
          <NumberField disabled={isFinalized} label="Weight" value={entry.weightPounds} min={50} max={700} step={0.1} onChange={(value) => onUpdate({ weightPounds: value })} suffix="lb" />
        </div>
        <div className="rating-grid">
          <RatingField disabled={isFinalized} label="Mood" value={entry.mood} onChange={(value) => onUpdate({ mood: value })} />
          <RatingField disabled={isFinalized} label="Energy" value={entry.energy} onChange={(value) => onUpdate({ energy: value })} />
          <RatingField disabled={isFinalized} label="Hunger" value={entry.hunger} onChange={(value) => onUpdate({ hunger: value })} />
        </div>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="5" title="Reflection" />
        <TextArea disabled={isFinalized} label="What went well?" value={entry.wentWell} placeholder="Name the win you want to repeat." onChange={(value) => onUpdate({ wentWell: value })} />
        <TextArea disabled={isFinalized} label="What made today difficult?" value={entry.difficult} placeholder="Record the trigger, obstacle, or weak point." onChange={(value) => onUpdate({ difficult: value })} />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="6" title="Finalize" />
        {isFinalized ? (
          <div className="finalize-action-row">
            <button className="primary-button" type="button" onClick={onShareDay}>Share Day</button>
            <button className="secondary-button" type="button" onClick={onUnlockDay}>Unlock Day</button>
          </div>
        ) : (
          <button className="primary-button" type="button" onClick={onFinalizeDay}>Finalize Day</button>
        )}
      </section>

      <p className="autosave-note">{isFinalized ? 'This day is locked until you unlock it.' : 'Changes save automatically on this device.'}</p>
    </div>
  )
}
