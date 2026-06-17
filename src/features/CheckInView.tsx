import type { ChallengeSettings, DailyEntry, WorkoutLog } from '../types'
import {
  MAX_WORKOUT_LOGS,
  MAX_WORKOUT_MINUTES,
  WORKOUT_TYPES,
  formatDateTime,
  getExerciseMinutes,
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
}: {
  entry: DailyEntry
  settings: ChallengeSettings
  isFinalized: boolean
  onUpdate: (patch: Partial<DailyEntry>) => void
  onFinalizeDay: () => void
  onUnlockDay: () => void
}) {
  const workoutLogs = Array.isArray(entry.workouts) ? entry.workouts : []
  const workoutTotal = getExerciseMinutes(entry)
  const workoutProgress = Math.min(100, Math.round((workoutTotal / settings.targets.exerciseMinutes) * 100))

  function updateWorkouts(nextWorkouts: WorkoutLog[]) {
    const workouts = normalizeWorkoutLogs(nextWorkouts)
    onUpdate({
      workouts,
      exerciseMinutes: workoutMinutesTotal(workouts),
    })
  }

  function updateWorkout(id: string, patch: Partial<WorkoutLog>) {
    updateWorkouts(workoutLogs.map((workout) => workout.id === id ? { ...workout, ...patch } : workout))
  }

  function addWorkout() {
    if (workoutLogs.length >= MAX_WORKOUT_LOGS) return
    updateWorkouts([...workoutLogs, makeEmptyWorkout()])
  }

  function removeWorkout(id: string) {
    updateWorkouts(workoutLogs.filter((workout) => workout.id !== id))
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <p className="eyebrow">{isFinalized ? 'Finalized' : 'Daily input'}</p>
        <h2>Check-In</h2>
        <p>{isFinalized && entry.finalizedAt ? `Locked ${formatDateTime(entry.finalizedAt)}.` : 'Track the facts. Honest data is more useful than a perfect score.'}</p>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="1" title="Workout" />
        <div className="workout-summary">
          <div>
            <strong>{workoutTotal} / {settings.targets.exerciseMinutes} min</strong>
            <span>{workoutProgress}% of daily workout target</span>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={addWorkout} disabled={isFinalized || workoutLogs.length >= MAX_WORKOUT_LOGS}>
            Add Exercise
          </button>
        </div>
        {workoutLogs.length === 0 ? (
          <p className="empty-workout-log">Add a workout entry to count minutes toward your exercise rule.</p>
        ) : (
          <div className="workout-log-list">
            {workoutLogs.map((workout) => (
              <article className="workout-log-row" key={workout.id}>
                <SelectField
                  disabled={isFinalized}
                  label="Type"
                  value={workout.type}
                  options={WORKOUT_TYPES}
                  onChange={(type) => updateWorkout(workout.id, { type })}
                />
                <NumberField
                  disabled={isFinalized}
                  label="Minutes"
                  value={workout.minutes}
                  min={0}
                  max={MAX_WORKOUT_MINUTES}
                  step={5}
                  onChange={(value) => updateWorkout(workout.id, { minutes: value ?? 0 })}
                  suffix="min"
                />
                <button className="ghost-button workout-remove-button" type="button" onClick={() => removeWorkout(workout.id)} disabled={isFinalized}>
                  Remove
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel form-panel">
        <SectionTitle number="2" title="Nutrition" />
        <div className="field-grid">
          <NumberField disabled={isFinalized} label={`Calories (${settings.targets.calories} kcal target)`} value={entry.calories} min={0} max={10000} onChange={(value) => onUpdate({ calories: value })} suffix="kcal" />
          <NumberField disabled={isFinalized} label={`Protein (${settings.targets.proteinGrams} g goal)`} value={entry.proteinGrams} min={0} max={500} onChange={(value) => onUpdate({ proteinGrams: value })} suffix="g" />
          <NumberField disabled={isFinalized} label={`Water (${settings.targets.waterLiters} L goal)`} value={entry.waterLiters} min={0} max={15} step={0.1} onChange={(value) => onUpdate({ waterLiters: value })} suffix="L" />
          <NumberField disabled={isFinalized} label="Weight" value={entry.weightPounds} min={50} max={700} step={0.1} onChange={(value) => onUpdate({ weightPounds: value })} suffix="lb" />
        </div>
      </section>

      <section className="panel form-panel">
        <SectionTitle number="3" title="Discipline" />
        <CheckField disabled={isFinalized} label="Sober" checked={entry.sober} onChange={(checked) => onUpdate({ sober: checked })} />
        <CheckField disabled={isFinalized} label="Read 10 pages" checked={entry.readTenPages} onChange={(checked) => onUpdate({ readTenPages: checked })} />
        <CheckField disabled={isFinalized} label="Journal completed" checked={entry.journaled} onChange={(checked) => onUpdate({ journaled: checked })} />
      </section>

      <section className="panel form-panel">
        <SectionTitle number="4" title="Body + Mind" />
        <NumberField disabled={isFinalized} label={`Sleep hours (${settings.targets.sleepHours} hr target)`} value={entry.sleepHours} min={0} max={24} step={0.25} onChange={(value) => onUpdate({ sleepHours: value })} suffix="hours" />
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
          <button className="secondary-button" type="button" onClick={onUnlockDay}>
            Unlock Day
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={onFinalizeDay}>
            Finalize Day
          </button>
        )}
      </section>

      <p className="autosave-note">{isFinalized ? 'This day is locked until you unlock it.' : 'Changes save automatically on this device.'}</p>
    </div>
  )
}
