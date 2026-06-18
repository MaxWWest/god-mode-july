import { expect, test } from '@playwright/test'
import { openFreshApp, openSettings } from './helpers'

test('persists light mode and accent color across reloads', async ({ page }) => {
  await openFreshApp(page)
  await openSettings(page)
  await page.getByRole('tab', { name: 'App + Account', exact: true }).click()

  await page.getByRole('button', { name: 'Light', exact: true }).click()
  await page.getByRole('button', { name: 'Teal', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'teal')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'teal')
})

test('goal editors expose category identity without horizontal overflow', async ({ page }) => {
  await openFreshApp(page)
  await openSettings(page)

  await expect(page.locator('.rule-config-card[data-rule-category="exercise"]')).toHaveCount(1)
  await expect(page.locator('.rule-config-card[data-rule-category="diet"]')).toHaveCount(4)
  await expect(page.locator('.rule-config-card[data-rule-category="mental"]')).toHaveCount(2)

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
})
