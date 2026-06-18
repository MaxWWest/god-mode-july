import { expect, type Page } from '@playwright/test'

export async function openFreshApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'God Mode July' })).toBeVisible()

  const skipGuide = page.getByRole('button', { name: 'Skip', exact: true })
  if (await skipGuide.isVisible()) await skipGuide.click()
}

export async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
}
