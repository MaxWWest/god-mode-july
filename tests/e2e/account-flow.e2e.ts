import { expect, test } from '@playwright/test'
import { openFreshApp } from './helpers'

test('clearly separates signup from returning password sign-in', async ({ page }) => {
  await openFreshApp(page)

  const signInEntry = page.getByRole('button', { name: 'Sign In', exact: true })
  test.skip(await signInEntry.count() === 0, 'Supabase is not configured in this build.')
  await signInEntry.click()

  await expect(page.getByRole('heading', { name: 'Welcome back.', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Create Account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create your account.', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send Signup Link', exact: true })).toBeVisible()
  await expect(page.getByText(/Check Spam or Junk/)).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
})

test('starts the tutorial with account creation guidance', async ({ page }) => {
  await openFreshApp(page)

  await page.getByRole('button', { name: 'Guide', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create your account.', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /1 Account/ })).toBeVisible()
  await expect(page.getByText(/check Spam or Junk/i)).toBeVisible()
  await expect(page.getByText('Set Password', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /3 Goals/ }).click()
  await expect(page.getByRole('heading', { name: 'Customize goals.', exact: true })).toBeVisible()
  await expect(page.getByText('Exercise Patterns', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /7 Challenges/ }).click()
  await expect(page.getByRole('heading', { name: 'Join squads and challenges.', exact: true })).toBeVisible()
  await expect(page.getByText('Publish Score', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /1 Account/ }).click()
  await page.getByRole('button', { name: 'Open Account Setup', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Send Signup Link', exact: true })).toBeVisible()
})
