import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TodayPanel } from '@/components/dsa/TodayPanel'
import type { LcSolveWithReviews } from '@/lib/dsa/types'

const noop = vi.fn()

function renderTodayPanel(openTechnicalApps: { company: string; applied_at: string | null }[]) {
  render(
    <TodayPanel
      solves={[] as LcSolveWithReviews[]}
      today="2026-05-21"
      newSolvesToday={0}
      track="150"
      openTechnicalApps={openTechnicalApps}
      onReviewComplete={noop}
      onSolveLogged={noop}
      onRescheduleComplete={noop}
    />
  )
}

describe('TodayPanel interview focus', () => {
  it('renders an interview focus banner for matched technical applications', () => {
    renderTodayPanel([{ company: 'Google', applied_at: '2026-05-20' }])

    expect(screen.getByText(/Google screen/)).toBeTruthy()
    expect(screen.getByText(/focus on Graphs today/)).toBeTruthy()
  })

  it('does not render an interview focus banner without technical applications', () => {
    renderTodayPanel([])

    expect(screen.queryByText(/screen — focus on/)).toBeNull()
  })
})
