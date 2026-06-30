import { describe, expect, it } from 'vitest'
import { passwordPairError } from './auth'

describe('passwordPairError', () => {
  it('requires at least eight characters', () => {
    expect(passwordPairError('short', 'short')).toBe('Use at least 8 characters.')
  })

  it('requires matching confirmation', () => {
    expect(passwordPairError('long-enough', 'different')).toBe('The passwords do not match.')
  })

  it('accepts a matching password pair', () => {
    expect(passwordPairError('long-enough', 'long-enough')).toBeNull()
  })
})
