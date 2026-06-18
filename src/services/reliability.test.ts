import { describe, expect, it, vi } from 'vitest'
import { isRetryableServiceError, retryServiceOperation, serviceErrorStatus } from './reliability'

describe('service reliability', () => {
  it('recognizes network, rate-limit, and server failures as retryable', () => {
    expect(isRetryableServiceError(new Error('Failed to fetch'))).toBe(true)
    expect(isRetryableServiceError({ status: 503, message: 'Unavailable' })).toBe(true)
    expect(isRetryableServiceError({ status: 429, message: 'Slow down' })).toBe(true)
  })

  it('does not retry authentication or validation failures', () => {
    expect(isRetryableServiceError({ status: 401, message: 'Invalid login credentials' })).toBe(false)
    expect(isRetryableServiceError({ code: '23505', message: 'Duplicate value' })).toBe(false)
  })

  it('retries a temporary failure and returns the successful value', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce('loaded')
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(retryServiceOperation(operation, { attempts: 3, wait })).resolves.toBe('loaded')
    expect(operation).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(180)
  })

  it('surfaces permanent errors without retrying', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Invalid login credentials'))
    const wait = vi.fn().mockResolvedValue(undefined)

    await expect(retryServiceOperation(operation, { wait })).rejects.toThrow('Invalid login credentials')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(wait).not.toHaveBeenCalled()
    expect(serviceErrorStatus(new Error('Failed to fetch'), 'Could not load.')).toMatchObject({ retryable: true })
  })
})
