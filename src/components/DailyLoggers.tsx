import { useState } from 'react'
import type { FoodCategory, FoodLibraryItem, FoodLog, MealType, WorkoutLog } from '../types'
import {
  FOOD_CATEGORIES,
  MAX_FOOD_LIBRARY_ITEMS,
  MAX_FOOD_LOGS,
  MAX_WORKOUT_LOGS,
  MAX_WORKOUT_MINUTES,
  MEAL_TYPES,
  WORKOUT_TYPES,
  foodLogFromLibraryItem,
  foodNutritionTotals,
  makeEmptyFood,
  makeEmptyWorkout,
} from '../tracker'
import { NumberField, SelectField, TextField } from '../ui'

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

const CATEGORY_LABELS: Record<FoodCategory, string> = {
  alcohol: 'Alcohol',
  dessert: 'Dessert',
  fruit: 'Fruit',
  vegetable: 'Vegetable',
  protein: 'Protein source',
  grain: 'Grain',
  dairy: 'Dairy',
  other: 'Other',
}

export function QuickWorkoutLogger({
  workouts,
  disabled,
  plannedType,
  onChange,
}: {
  workouts: WorkoutLog[]
  disabled: boolean
  plannedType?: string
  onChange: (workouts: WorkoutLog[]) => void
}) {
  const [type, setType] = useState(plannedType && plannedType !== 'Any exercise' ? plannedType : WORKOUT_TYPES[0])
  const [minutes, setMinutes] = useState(30)

  function addWorkout() {
    if (minutes <= 0 || workouts.length >= MAX_WORKOUT_LOGS) return
    onChange([...workouts, { ...makeEmptyWorkout(), type, minutes }])
  }

  return (
    <div className="quick-workout-logger">
      {!disabled && (
        <div className="quick-workout-form">
          <SelectField label="Exercise" value={type} options={WORKOUT_TYPES} onChange={setType} />
          <NumberField label="Duration" value={minutes} min={5} max={MAX_WORKOUT_MINUTES} step={5} onChange={(value) => setMinutes(value ?? 0)} suffix="min" />
          <button className="secondary-button compact-button" type="button" onClick={addWorkout} disabled={minutes <= 0 || workouts.length >= MAX_WORKOUT_LOGS}>Add Workout</button>
        </div>
      )}
      {workouts.length === 0 ? <p className="empty-workout-log">No workouts logged yet.</p> : (
        <div className="quick-workout-list">
          {workouts.map((workout) => (
            <article key={workout.id}>
              <span><strong>{workout.type}</strong><small>{workout.minutes} min</small></span>
              {!disabled && <button className="ghost-button" type="button" onClick={() => onChange(workouts.filter((item) => item.id !== workout.id))}>Remove</button>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export function MealLogger({
  foods,
  foodLibrary = [],
  disabled,
  detailed = false,
  onChange,
  onSaveFoodToLibrary,
  onDeleteFoodFromLibrary,
}: {
  foods: FoodLog[]
  foodLibrary?: FoodLibraryItem[]
  disabled: boolean
  detailed?: boolean
  onChange: (foods: FoodLog[]) => void
  onSaveFoodToLibrary?: (food: FoodLog) => void
  onDeleteFoodFromLibrary?: (foodId: string) => void
}) {
  const [draft, setDraft] = useState<FoodLog>(() => makeEmptyFood('breakfast'))
  const [selectedLibraryFoodId, setSelectedLibraryFoodId] = useState('')
  const totals = foodNutritionTotals(foods)
  const selectedLibraryFood = foodLibrary.find((food) => food.id === selectedLibraryFoodId) ?? null

  function updateDraft(patch: Partial<FoodLog>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function toggleDraftCategory(category: FoodCategory) {
    updateDraft({ categories: draft.categories.includes(category)
      ? draft.categories.filter((item) => item !== category)
      : [...draft.categories, category] })
  }

  function addFood() {
    if (!draft.name.trim() || foods.length >= MAX_FOOD_LOGS) return
    onChange([...foods, { ...draft, name: draft.name.trim() }])
    setDraft(makeEmptyFood(draft.meal))
  }

  function addSavedFood() {
    if (!selectedLibraryFood || foods.length >= MAX_FOOD_LOGS) return
    onChange([...foods, foodLogFromLibraryItem(selectedLibraryFood, draft.meal)])
  }

  function saveDraftFood() {
    if (!draft.name.trim() || !onSaveFoodToLibrary) return
    onSaveFoodToLibrary({ ...draft, name: draft.name.trim() })
  }

  function updateFood(id: string, patch: Partial<FoodLog>) {
    onChange(foods.map((food) => food.id === id ? { ...food, ...patch } : food))
  }

  return (
    <div className="meal-logger">
      <div className="nutrition-summary" aria-label="Meal nutrition totals">
        <span><small>Calories</small><strong>{totals.calories}</strong></span>
        <span><small>Protein</small><strong>{totals.proteinGrams} g</strong></span>
        <span><small>Carbs</small><strong>{totals.carbsGrams} g</strong></span>
        <span><small>Fat</small><strong>{totals.fatGrams} g</strong></span>
        <span><small>Sodium</small><strong>{totals.sodiumMg} mg</strong></span>
      </div>

      {!disabled && (
        <div className="food-add-form">
          <div className="meal-type-tabs" aria-label="Meal type">
            {MEAL_TYPES.map((meal) => (
              <button className={draft.meal === meal ? 'active' : ''} type="button" key={meal} aria-pressed={draft.meal === meal} onClick={() => updateDraft({ meal })}>{MEAL_LABELS[meal]}</button>
            ))}
          </div>
          {foodLibrary.length > 0 && (
            <div className="food-library-panel">
              <div>
                <label className="select-field">
                  <span>Saved food</span>
                  <select value={selectedLibraryFoodId} onChange={(event) => setSelectedLibraryFoodId(event.target.value)}>
                    <option value="">Choose saved food</option>
                    {foodLibrary.map((food) => (
                      <option key={food.id} value={food.id}>{food.name}</option>
                    ))}
                  </select>
                </label>
                <button className="secondary-button compact-button" type="button" onClick={addSavedFood} disabled={!selectedLibraryFood || foods.length >= MAX_FOOD_LOGS}>Add Saved Food</button>
              </div>
              {selectedLibraryFood && (
                <article className="food-library-preview">
                  <span>{selectedLibraryFood.calories} kcal · {selectedLibraryFood.proteinGrams} g protein{selectedLibraryFood.categories.length > 0 ? ` · ${selectedLibraryFood.categories.map((category) => CATEGORY_LABELS[category]).join(', ')}` : ''}</span>
                  {onDeleteFoodFromLibrary && <button className="ghost-button" type="button" onClick={() => onDeleteFoodFromLibrary(selectedLibraryFood.id)}>Delete</button>}
                </article>
              )}
            </div>
          )}
          <div className={`food-macro-grid ${detailed ? 'is-detailed' : ''}`}>
            <TextField label="Food item" value={draft.name} onChange={(name) => updateDraft({ name })} />
            <NumberField label="Calories" value={draft.calories} min={0} max={5000} onChange={(calories) => updateDraft({ calories: calories ?? 0 })} suffix="kcal" />
            <NumberField label="Protein" value={draft.proteinGrams} min={0} max={500} onChange={(proteinGrams) => updateDraft({ proteinGrams: proteinGrams ?? 0 })} suffix="g" />
            {detailed && <>
              <NumberField label="Carbs" value={draft.carbsGrams} min={0} max={1000} onChange={(carbsGrams) => updateDraft({ carbsGrams: carbsGrams ?? 0 })} suffix="g" />
              <NumberField label="Fat" value={draft.fatGrams} min={0} max={500} onChange={(fatGrams) => updateDraft({ fatGrams: fatGrams ?? 0 })} suffix="g" />
              <NumberField label="Sodium" value={draft.sodiumMg} min={0} max={20000} onChange={(sodiumMg) => updateDraft({ sodiumMg: sodiumMg ?? 0 })} suffix="mg" />
            </>}
          </div>
          <FoodCategoryPicker categories={draft.categories} disabled={false} onToggle={toggleDraftCategory} />
          <div className="food-add-actions">
            <button className="secondary-button compact-button" type="button" onClick={addFood} disabled={!draft.name.trim() || foods.length >= MAX_FOOD_LOGS}>Add to {MEAL_LABELS[draft.meal]}</button>
            {onSaveFoodToLibrary && (
              <button className="ghost-button compact-button" type="button" onClick={saveDraftFood} disabled={!draft.name.trim() || foodLibrary.length >= MAX_FOOD_LIBRARY_ITEMS}>
                Save Food
              </button>
            )}
          </div>
        </div>
      )}

      <MealGroups foods={foods} disabled={disabled} detailed={detailed} onChange={onChange} onUpdateFood={updateFood} />
    </div>
  )
}

function FoodCategoryPicker({
  categories,
  disabled,
  onToggle,
}: {
  categories: FoodCategory[]
  disabled: boolean
  onToggle: (category: FoodCategory) => void
}) {
  return (
    <div className="food-category-picker">
      <small>Categories that can update rules automatically</small>
      <div>
        {FOOD_CATEGORIES.map((category) => (
          <label key={category}>
            <input type="checkbox" checked={categories.includes(category)} disabled={disabled} onChange={() => onToggle(category)} />
            <span>{CATEGORY_LABELS[category]}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function MealGroups({
  foods,
  disabled,
  detailed,
  onChange,
  onUpdateFood,
}: {
  foods: FoodLog[]
  disabled: boolean
  detailed: boolean
  onChange: (foods: FoodLog[]) => void
  onUpdateFood: (id: string, patch: Partial<FoodLog>) => void
}) {
  if (foods.length === 0) return <p className="empty-workout-log">No meals logged yet.</p>
  return (
    <div className="meal-groups">
      {MEAL_TYPES.map((meal) => {
        const mealFoods = foods.filter((food) => food.meal === meal)
        if (mealFoods.length === 0) return null
        return (
          <section className="meal-group" key={meal}>
            <div className="meal-group-heading"><strong>{MEAL_LABELS[meal]}</strong><span>{mealFoods.length} {mealFoods.length === 1 ? 'item' : 'items'}</span></div>
            {mealFoods.map((food) => detailed ? (
              <FoodEditRow key={food.id} food={food} disabled={disabled} onUpdate={(patch) => onUpdateFood(food.id, patch)} onRemove={() => onChange(foods.filter((item) => item.id !== food.id))} />
            ) : (
              <article className="food-summary-row" key={food.id}>
                <div>
                  <strong>{food.name}</strong>
                  <span>{food.calories} kcal · {food.proteinGrams} g protein{food.categories.length > 0 ? ` · ${food.categories.map((category) => CATEGORY_LABELS[category]).join(', ')}` : ''}</span>
                </div>
                {!disabled && <button className="ghost-button" type="button" onClick={() => onChange(foods.filter((item) => item.id !== food.id))}>Remove</button>}
              </article>
            ))}
          </section>
        )
      })}
    </div>
  )
}

function FoodEditRow({ food, disabled, onUpdate, onRemove }: {
  food: FoodLog
  disabled: boolean
  onUpdate: (patch: Partial<FoodLog>) => void
  onRemove: () => void
}) {
  function toggleCategory(category: FoodCategory) {
    onUpdate({ categories: food.categories.includes(category)
      ? food.categories.filter((item) => item !== category)
      : [...food.categories, category] })
  }
  return (
    <article className="food-edit-row">
      <div className="food-edit-main">
        <TextField label="Food" value={food.name} disabled={disabled} onChange={(name) => onUpdate({ name })} />
        <SelectField label="Meal" value={food.meal} disabled={disabled} options={MEAL_TYPES} onChange={(meal) => onUpdate({ meal: meal as MealType })} />
      </div>
      <div className="food-edit-macros">
        <NumberField label="Calories" value={food.calories} min={0} max={5000} disabled={disabled} onChange={(value) => onUpdate({ calories: value ?? 0 })} suffix="kcal" />
        <NumberField label="Protein" value={food.proteinGrams} min={0} max={500} disabled={disabled} onChange={(value) => onUpdate({ proteinGrams: value ?? 0 })} suffix="g" />
        <NumberField label="Carbs" value={food.carbsGrams} min={0} max={1000} disabled={disabled} onChange={(value) => onUpdate({ carbsGrams: value ?? 0 })} suffix="g" />
        <NumberField label="Fat" value={food.fatGrams} min={0} max={500} disabled={disabled} onChange={(value) => onUpdate({ fatGrams: value ?? 0 })} suffix="g" />
        <NumberField label="Sodium" value={food.sodiumMg} min={0} max={20000} disabled={disabled} onChange={(value) => onUpdate({ sodiumMg: value ?? 0 })} suffix="mg" />
      </div>
      <FoodCategoryPicker categories={food.categories} disabled={disabled} onToggle={toggleCategory} />
      <button className="ghost-button workout-remove-button" type="button" disabled={disabled} onClick={onRemove}>Remove</button>
    </article>
  )
}
