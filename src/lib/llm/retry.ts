const RETRYABLE_STATUS = new Set([429, 529])
const NETWORK_ERROR = /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout|network/i

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status = (err as { status?: number })?.status
      const isNetworkErr = err instanceof Error && NETWORK_ERROR.test(err.message)
      const isRetryable = isNetworkErr || (status !== undefined && RETRYABLE_STATUS.has(status))
      if (!isRetryable || attempt === maxAttempts) throw err
      await new Promise(r => setTimeout(r, 2000))
    }
  }
  throw lastError
}
