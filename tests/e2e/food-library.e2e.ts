import { expect, test } from '@playwright/test'
import { openFreshApp } from './helpers'

test('saves, searches, and reloads foods and meal presets', async ({ page }) => {
  await openFreshApp(page)
  await page.getByRole('button', { name: 'Diet', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Diet', exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Food item', exact: true }).fill('Banana')
  await page.getByRole('spinbutton', { name: 'Calories kcal', exact: true }).fill('105')
  await page.getByRole('spinbutton', { name: 'Protein g', exact: true }).fill('1.3')
  await page.getByRole('spinbutton', { name: 'Carbs g', exact: true }).fill('27')
  await page.getByRole('button', { name: 'Save Food', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Breakfast', exact: true }).click()

  const savedMeals = page.locator('.saved-meals-panel')
  await savedMeals.getByRole('textbox', { name: 'Preset name', exact: true }).fill('Daily breakfast')
  await savedMeals.getByRole('button', { name: 'Save meal preset', exact: true }).click()
  await expect(savedMeals.getByText('Daily breakfast', { exact: true })).toBeVisible()

  const savedFoods = page.locator('.food-library-summary')
  await savedFoods.getByRole('textbox', { name: 'Search saved foods', exact: true }).fill('ban')
  await expect(savedFoods.getByText('Banana', { exact: true })).toBeVisible()
  await savedFoods.getByRole('textbox', { name: 'Search saved foods', exact: true }).fill('orange')
  await expect(savedFoods.getByText('No saved foods match that search.', { exact: true })).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.getByRole('button', { name: '+ Banana', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Daily breakfast', exact: true })).toBeVisible()
})
