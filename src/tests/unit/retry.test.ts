import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry } from '@/lib/llm/retry'

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns on first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries once on HTTP 529 and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 529 }))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn)
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries once on HTTP 429 and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn)
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on ECONNREFUSED network error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:443'))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn)
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on ETIMEDOUT network error', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn)
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on HTTP 400', async () => {
    const err = Object.assign(new Error('bad request'), { status: 400 })
    const fn = vi.fn().mockRejectedValue(err)
    await expect(withRetry(fn)).rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on HTTP 401', async () => {
    const err = Object.assign(new Error('unauthorized'), { status: 401 })
    const fn = vi.fn().mockRejectedValue(err)
    await expect(withRetry(fn)).rejects.toThrow('unauthorized')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('throws after maxAttempts exhausted', async () => {
    const err = Object.assign(new Error('overloaded'), { status: 529 })
    const fn = vi.fn().mockRejectedValue(err)

    const promise = withRetry(fn, 2).catch((e: Error) => e)
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('overloaded')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('second attempt is made only after delay elapses', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('overloaded'), { status: 529 }))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn)
    // First call fires synchronously, second hasn't happened yet
    expect(fn).toHaveBeenCalledTimes(1)
    // Run the full timer — delay elapses and second call fires
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
