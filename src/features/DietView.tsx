import { useMemo, useState } from 'react'
import { MealLogger } from '../components/DailyLoggers'
import { duplicateFoodLog, foodLogsEntryPatch, foodNutritionTotals, MEAL_TYPES } from '../tracker'
import type { DailyEntry, FoodLibraryItem, FoodLog, MealType, SavedMeal } from '../types'
import { TextField } from '../ui'

export default function DietView({
  entry,
  previousFoods,
  foodLibrary,
  savedMeals,
  isFinalized,
  onUpdate,
  onSaveFoodToLibrary,
  onDeleteFoodFromLibrary,
  onUseFoodFromLibrary,
  onToggleFoodFavorite,
  onSaveMeal,
  onDeleteMeal,
  onAddMeal,
  onAddFood,
}: {
  entry: DailyEntry
  previousFoods: FoodLog[]
  foodLibrary: FoodLibraryItem[]
  savedMeals: SavedMeal[]
  isFinalized: boolean
  onUpdate: (patch: Partial<DailyEntry>) => void
  onSaveFoodToLibrary: (food: FoodLog) => void
  onDeleteFoodFromLibrary: (foodId: string) => void
  onUseFoodFromLibrary: (foodId: string) => void
  onToggleFoodFavorite: (foodId: string) => void
  onSaveMeal: (name: string, foods: FoodLog[]) => void
  onDeleteMeal: (mealId: string) => void
  onAddMeal: (meal: SavedMeal) => void
  onAddFood: (food: FoodLibraryItem, meal: MealType) => void
}) {
  const [mealName, setMealName] = useState('')
  const [mealSearch, setMealSearch] = useState('')
  const [foodSearch, setFoodSearch] = useState('')
  const [mealToSave, setMealToSave] = useState<MealType>('breakfast')
  const [foodDestination, setFoodDestination] = useState<MealType>('breakfast')
  const mealFoods = entry.foods.filter((food) => food.meal === mealToSave)
  const filteredMeals = useMemo(() => {
    const query = mealSearch.trim().toLowerCase()
    return query ? savedMeals.filter((meal) => meal.name.toLowerCase().includes(query) || meal.foods.some((food) => food.name.toLowerCase().includes(query))) : savedMeals
  }, [mealSearch, savedMeals])
  const filteredFoods = useMemo(() => {
    const query = foodSearch.trim().toLowerCase()
    const sorted = [...foodLibrary].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.useCount - a.useCount || a.name.localeCompare(b.name))
    return query ? sorted.filter((food) => food.name.toLowerCase().includes(query) || food.categories.some((category) => category.includes(query))) : sorted
  }, [foodLibrary, foodSearch])

  return (
    <div className="page-stack diet-workspace">
      <section className="page-intro diet-intro">
        <p className="eyebrow">Food workspace</p>
        <h2>Diet</h2>
        <p>Build foods and reusable meals here. Home stays fast.</p>
      </section>

      <div className="diet-workspace-grid">
        <section className="panel diet-builder-panel">
          <div className="section-heading"><div><p className="eyebrow">Today</p><h2>Food log</h2></div><span>{entry.foods.length} items</span></div>
          <MealLogger
            foods={entry.foods}
            foodLibrary={foodLibrary}
            previousFoods={previousFoods}
            disabled={isFinalized}
            detailed
            onChange={(foods) => onUpdate(foodLogsEntryPatch(foods))}
            onSaveFoodToLibrary={onSaveFoodToLibrary}
            onDeleteFoodFromLibrary={onDeleteFoodFromLibrary}
            onUseFoodFromLibrary={onUseFoodFromLibrary}
            onToggleFoodFavorite={onToggleFoodFavorite}
          />
        </section>

        <aside className="diet-library-column">
          <section className="panel saved-meals-panel">
            <div className="section-heading"><div><p className="eyebrow">One-click logging</p><h2>Saved meals</h2></div><span>{savedMeals.length}</span></div>
            {!isFinalized && entry.foods.length > 0 && <div className="save-meal-form"><label className="select-field"><span>Meal to save</span><select value={mealToSave} onChange={(event) => setMealToSave(event.target.value as MealType)}>{MEAL_TYPES.map((meal) => <option value={meal} key={meal}>{meal[0].toUpperCase() + meal.slice(1)} ({entry.foods.filter((food) => food.meal === meal).length})</option>)}</select></label><TextField label="Preset name" value={mealName} onChange={setMealName} /><button className="secondary-button" type="button" disabled={!mealName.trim() || mealFoods.length === 0} onClick={() => { onSaveMeal(mealName, mealFoods.map((food) => duplicateFoodLog(food))); setMealName('') }}>Save meal preset</button></div>}
            {savedMeals.length > 0 && <TextField label="Search saved meals" value={mealSearch} onChange={setMealSearch} />}
            {savedMeals.length === 0 ? <p className="home-empty-copy">Log a meal, then save it as a reusable preset.</p> : filteredMeals.length === 0 ? <p className="home-empty-copy">No saved meals match that search.</p> : <div className="saved-meal-list">{filteredMeals.map((meal) => { const totals = foodNutritionTotals(meal.foods); return <article key={meal.id}><div><strong>{meal.name}</strong><small>{meal.foods.map((food) => food.name).join(', ')}</small><small>{meal.foods.length} items · {totals.calories} kcal · {totals.proteinGrams} g protein</small></div><div><button className="secondary-button compact-button" type="button" disabled={isFinalized} onClick={() => onAddMeal(meal)}>Add</button><button className="ghost-button compact-button" type="button" onClick={() => onDeleteMeal(meal.id)}>Delete</button></div></article> })}</div>}
          </section>

          <section className="panel food-library-summary">
            <div className="section-heading"><div><p className="eyebrow">Reusable ingredients</p><h2>Saved foods</h2></div><span>{foodLibrary.length}</span></div>
            <div className="saved-food-search-row"><TextField label="Search saved foods" value={foodSearch} onChange={setFoodSearch} /><label className="select-field"><span>Add to</span><select value={foodDestination} onChange={(event) => setFoodDestination(event.target.value as MealType)}>{MEAL_TYPES.map((meal) => <option value={meal} key={meal}>{meal[0].toUpperCase() + meal.slice(1)}</option>)}</select></label></div>
            {foodLibrary.length === 0 ? <p className="home-empty-copy">Create a food once, then use Save Food to keep its macros.</p> : filteredFoods.length === 0 ? <p className="home-empty-copy">No saved foods match that search.</p> : <div className="food-library-summary-list">{filteredFoods.map((food) => <article key={food.id}><div><strong>{food.favorite ? '★ ' : ''}{food.name}</strong><span>{food.calories} kcal · {food.proteinGrams} g protein</span></div><button className="secondary-button compact-button" type="button" disabled={isFinalized} onClick={() => onAddFood(food, foodDestination)}>Add</button></article>)}</div>}
          </section>
        </aside>
      </div>
    </div>
  )
}
