import { useState } from 'react'
import { MealLogger } from '../components/DailyLoggers'
import { duplicateFoodLog, foodLogsEntryPatch, foodNutritionTotals } from '../tracker'
import type { DailyEntry, FoodLibraryItem, FoodLog, SavedMeal } from '../types'
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
}) {
  const [mealName, setMealName] = useState('')

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
            {!isFinalized && entry.foods.length > 0 && <div className="save-meal-form"><TextField label="Meal name" value={mealName} onChange={setMealName} /><button className="secondary-button" type="button" disabled={!mealName.trim()} onClick={() => { onSaveMeal(mealName, entry.foods.map((food) => duplicateFoodLog(food))); setMealName('') }}>Save today as meal</button></div>}
            {savedMeals.length === 0 ? <p className="home-empty-copy">Log foods, then save the combination as a reusable meal.</p> : <div className="saved-meal-list">{savedMeals.map((meal) => { const totals = foodNutritionTotals(meal.foods); return <article key={meal.id}><div><strong>{meal.name}</strong><small>{meal.foods.length} items · {totals.calories} kcal · {totals.proteinGrams} g protein</small></div><div><button className="secondary-button compact-button" type="button" disabled={isFinalized} onClick={() => onAddMeal(meal)}>Add</button><button className="ghost-button compact-button" type="button" onClick={() => onDeleteMeal(meal.id)}>Delete</button></div></article> })}</div>}
          </section>

          <section className="panel food-library-summary">
            <div className="section-heading"><div><p className="eyebrow">Reusable ingredients</p><h2>Saved foods</h2></div><span>{foodLibrary.length}</span></div>
            <p className="home-empty-copy">Favorite foods appear first in the food logger and can be added to any meal.</p>
            <div className="food-library-summary-list">{foodLibrary.slice(0, 10).map((food) => <article key={food.id}><strong>{food.name}</strong><span>{food.calories} kcal · {food.proteinGrams} g</span></article>)}</div>
          </section>
        </aside>
      </div>
    </div>
  )
}
