import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InterviewKit } from '@/components/tracker/InterviewKit'

describe('InterviewKit', () => {
  it('renders Generate Kit when no cached kit exists', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => null,
    } as Response)

    render(<InterviewKit applicationId="app-1" />)

    expect(await screen.findByText('Generate Kit')).toBeTruthy()
    fetchMock.mockRestore()
  })
})
