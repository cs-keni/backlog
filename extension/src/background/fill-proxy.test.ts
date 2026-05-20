import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleFetchFileMessage } from './index'

describe('FETCH_FILE background proxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    chrome.storage.local.get = vi.fn().mockResolvedValue({})
  })

  it('fetches a URL and returns an ArrayBuffer', async () => {
    const buffer = new ArrayBuffer(8)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(buffer, { status: 200 })
    )

    const result = await handleFetchFileMessage({
      type: 'FETCH_FILE',
      url: 'https://storage.example.com/resume.pdf',
      fileName: 'resume.pdf',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.buffer.byteLength).toBe(8)
  })

  it('returns an error for invalid URLs', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await handleFetchFileMessage({
      type: 'FETCH_FILE',
      url: 'notaurl',
      fileName: 'resume.pdf',
    })

    expect(result.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
