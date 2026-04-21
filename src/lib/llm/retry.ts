const RETRYABLE_STATUS = new Set([429, 529])

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status = (err as { status?: number })?.status
      if (!status || !RETRYABLE_STATUS.has(status) || attempt === maxAttempts) throw err
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  throw lastError
}
