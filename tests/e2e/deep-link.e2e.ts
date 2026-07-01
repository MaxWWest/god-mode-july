import { expect, test } from '@playwright/test'
import { openFreshApp } from './helpers'

test('fresh friend links open social and clean the URL', async ({ page }) => {
  await page.goto('/?friend=GM-STUCK123')

  await expect(page.getByRole('button', { name: 'Social', exact: true })).toHaveClass(/active/)
  expect(page.url()).not.toContain('friend=')
})

test('saved pending friend links do not hijack plain launches', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('god-mode-july-pending-friend-invite-v1', JSON.stringify('GM-STUCK123'))
  })

  await openFreshApp(page)

  await expect(page.getByRole('button', { name: 'Home', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('button', { name: 'Social', exact: true })).not.toHaveClass(/active/)
})
