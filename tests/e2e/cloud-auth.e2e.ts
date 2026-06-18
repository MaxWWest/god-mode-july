import { expect, test } from '@playwright/test'
import { openFreshApp, openSettings } from './helpers'

const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD

test('signs in with an existing Supabase account and signs out', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Run the credentialed cloud check once on desktop Chromium.')
  test.skip(!email || !password, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run the cloud auth check.')

  await openFreshApp(page)
  await openSettings(page)
  await page.getByRole('tab', { name: 'App + Account', exact: true }).click()

  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email!)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password!)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expect(page.getByText(email!, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible()
})
