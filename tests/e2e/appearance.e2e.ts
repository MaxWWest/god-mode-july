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

test('custom text fields allow deletion and spaces before committing', async ({ page }) => {
  await openFreshApp(page)
  await openSettings(page)

  const mentalSection = page.locator('section.panel').filter({
    has: page.getByRole('heading', { name: 'Mental Rules', exact: true }),
  })
  await mentalSection.getByRole('button', { name: 'Add Rule', exact: true }).click()

  const customRuleCard = mentalSection.locator('.rule-config-card').filter({ hasText: 'New Mental Rule' })
  const ruleName = customRuleCard.getByRole('textbox', { name: 'Rule', exact: true })
  await ruleName.fill('')
  await expect(ruleName).toHaveValue('')
  await ruleName.type('Evening Walk')
  await expect(ruleName).toHaveValue('Evening Walk')
  await ruleName.press('Tab')

  const dietSection = page.locator('section.panel').filter({
    has: page.getByRole('heading', { name: 'Diet Rules', exact: true }),
  })
  const proteinCard = dietSection.locator('.rule-config-card').nth(2)
  const proteinAmount = proteinCard.getByRole('spinbutton', { name: 'Amount g', exact: true })
  await proteinAmount.fill('')
  await expect(proteinAmount).toHaveValue('')
  await proteinAmount.type('160')
  await proteinAmount.press('Tab')
  await expect(proteinAmount).toHaveValue('160')

  const proteinUnit = proteinCard.getByRole('textbox', { name: 'Unit', exact: true })
  await proteinUnit.fill('')
  await expect(proteinUnit).toHaveValue('')
  await proteinUnit.type('grams')
  await proteinUnit.press('Tab')
  await expect(proteinUnit).toHaveValue('grams')

  await page.getByRole('tab', { name: 'App + Account', exact: true }).click()
  const trackerTitle = page.getByRole('textbox', { name: 'Title', exact: true })
  await trackerTitle.fill('')
  await expect(trackerTitle).toHaveValue('')
  await trackerTitle.type('Daily Lifestyle')
  await trackerTitle.press('Tab')
  await expect(page.getByRole('heading', { name: 'Daily Lifestyle', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Daily Lifestyle', exact: true })).toBeVisible()
  await openSettings(page)
  await expect(page.locator('.rule-config-card').filter({ hasText: 'Evening Walk' })).toHaveCount(1)
})

test('numeric fields allow deletion before entering replacement values', async ({ page }) => {
  await openFreshApp(page)

  await page.getByRole('button', { name: 'Check in now', exact: true }).click()
  await page.getByRole('button', { name: 'Training', exact: true }).click()
  await page.getByRole('button', { name: 'Add Exercise', exact: true }).click()
  const workoutDuration = page.getByRole('spinbutton', { name: 'Minutes min', exact: true })
  await expect(workoutDuration).toHaveValue('0')
  await workoutDuration.fill('')
  await expect(workoutDuration).toHaveValue('')
  await workoutDuration.type('45')
  await expect(workoutDuration).toHaveValue('45')

  await page.getByRole('button', { name: 'Meals', exact: true }).click()
  const calories = page.getByRole('spinbutton', { name: 'Calories kcal', exact: true }).first()
  await expect(calories).toHaveValue('0')
  await calories.fill('')
  await expect(calories).toHaveValue('')
  await calories.type('250')
  await expect(calories).toHaveValue('250')

  await openSettings(page)
  const sleepTarget = page.getByRole('spinbutton', { name: 'Sleep minimum hr', exact: true })
  await sleepTarget.fill('')
  await expect(sleepTarget).toHaveValue('')
  await sleepTarget.type('7.5')
  await expect(sleepTarget).toHaveValue('7.5')
  await sleepTarget.press('Tab')
  await expect(sleepTarget).toHaveValue('7.5')
})

test('daily dashboard stays within common phone, tablet, and desktop widths', async ({ page }) => {
  await openFreshApp(page)
  for (const width of [375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 })
    await expect(page.getByRole('heading', { name: 'Meals', exact: true })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1)
  }

  const desktopShell = await page.locator('.app-shell').boundingBox()
  expect(desktopShell?.width).toBeGreaterThan(1100)
  const desktopOverflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))
  expect(desktopOverflow.horizontal).toBeLessThanOrEqual(1)
  expect(desktopOverflow.vertical).toBeLessThanOrEqual(1)

  await page.setViewportSize({ width: 1296, height: 726 })
  const shortLaptopOverflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))
  expect(shortLaptopOverflow.horizontal).toBeLessThanOrEqual(1)
  expect(shortLaptopOverflow.vertical).toBeLessThanOrEqual(1)
})
