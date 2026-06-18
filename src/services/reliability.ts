const TRANSIENT_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'PGRST000',
  'PGRST001',
  'PGRST002',
])

function errorDetails(error: unknown): { message: string; code: string; status: number | null } {
  if (!error || typeof error !== 'object') {
    return { message: error instanceof Error ? error.message : '', code: '', status: null }
  }
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown; statusCode?: unknown }
  const rawStatus = candidate.status ?? candidate.statusCode
  return {
    message: typeof candidate.message === 'string' ? candidate.message : '',
    code: typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '',
    status: typeof rawStatus === 'number' ? rawStatus : Number.isFinite(Number(rawStatus)) ? Number(rawStatus) : null,
  }
}

export function isRetryableServiceError(error: unknown): boolean {
  const { message, code, status } = errorDetails(error)
  if (TRANSIENT_CODES.has(code)) return true
  if (status !== null && (status === 408 || status === 429 || status >= 500)) return true
  const normalized = message.toLowerCase()
  return normalized.includes('failed to fetch')
    || normalized.includes('network request failed')
    || normalized.includes('networkerror')
    || normalized.includes('timeout')
    || normalized.includes('temporarily unavailable')
    || normalized.includes('load failed')
}

export function serviceErrorStatus(error: unknown, fallback: string) {
  const retryable = isRetryableServiceError(error)
  const originalMessage = error instanceof Error ? error.message : ''
  return {
    tone: 'error' as const,
    retryable,
    message: retryable
      ? 'Temporary connection problem. Your local data is safe; try again.'
      : originalMessage || fallback,
  }
}

export async function retryServiceOperation<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; wait?: (delayMs: number) => Promise<void> } = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const delayMs = Math.max(0, options.delayMs ?? 180)
  const wait = options.wait ?? ((delay) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay)))

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === attempts || !isRetryableServiceError(error)) throw error
      await wait(delayMs * attempt)
    }
  }

  throw new Error('Retry attempts exhausted.')
}
