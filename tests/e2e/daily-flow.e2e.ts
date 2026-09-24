import { expect, test } from '@playwright/test'
import { openFreshApp } from './helpers'

test('logs a complete day, finalizes it, and restores it after reload', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async (text: string) => window.localStorage.setItem('test-share-text', text),
      },
      configurable: true,
    })
  })
  await openFreshApp(page)

  await expect(page.getByRole('heading', { name: 'Meals', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Check in now', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Morning weight lb', exact: true }).fill('228.4')
  await page.getByRole('spinbutton', { name: 'Steps steps', exact: true }).fill('13500')
  await page.getByRole('spinbutton', { name: 'Sleep hours', exact: true }).fill('7.5')
  await page.getByRole('checkbox', { name: 'Planned training or recovery completed', exact: true }).check()

  await page.getByRole('button', { name: 'Training', exact: true }).click()
  await page.getByRole('button', { name: 'Add Exercise', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Minutes min', exact: true }).fill('30')

  await page.getByRole('button', { name: 'Meals', exact: true }).click()

  await page.getByRole('textbox', { name: 'Food item', exact: true }).fill('Greek yogurt bowl')
  await page.getByRole('spinbutton', { name: 'Calories kcal', exact: true }).fill('1950')
  await page.getByRole('spinbutton', { name: 'Protein g', exact: true }).fill('165')
  await page.getByRole('button', { name: 'Save Food', exact: true }).click()
  await expect(page.getByText('Greek yogurt bowl saved to food library.', { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Saved food', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add to Breakfast', exact: true }).click()

  await page.getByRole('button', { name: 'Finish Day', exact: true }).click()
  await page.getByRole('button', { name: 'Share Day', exact: true }).click()
  await expect(page.getByText('Daily check-in copied. Paste it into the group chat.', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('test-share-text'))).toContain("I've completed the day at")
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('test-share-text'))).toContain('Exercises:\n- Strength 30 min')
  await expect(page.getByRole('button', { name: 'Unlock', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Day published', exact: true })).toBeVisible()
  await expect(page.getByText('Greek yogurt bowl', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View check-in', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Steps steps', exact: true })).toHaveValue('13500')
  await page.getByRole('button', { name: 'Training', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Minutes min', exact: true })).toHaveValue('30')
  await expect(page.getByRole('button', { name: 'Add Exercise', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Meals', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Food item', exact: true })).toHaveCount(0)
})
