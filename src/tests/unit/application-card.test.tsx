import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApplicationCard } from '@/components/tracker/ApplicationCard'
import type { ApplicationWithJob } from '@/lib/jobs/types'

function makeApp(overrides: Partial<ApplicationWithJob> = {}): ApplicationWithJob {
  return {
    id: 'app-1',
    user_id: 'user-1',
    job_id: 'job-1',
    status: 'applied',
    is_archived: false,
    applied_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    last_updated: new Date().toISOString(),
    notes: null,
    recruiter_name: null,
    recruiter_email: null,
    ats_platform: null,
    jobs: {
      id: 'job-1',
      title: 'Software Engineer',
      company: 'Tiny Startup',
      location: null,
      salary_min: null,
      salary_max: null,
      url: null,
      is_remote: false,
      tags: null,
      fetched_at: null,
    },
    ...overrides,
  }
}

describe('ApplicationCard health indicator', () => {
  it('renders a red health dot for stale applied startup applications', () => {
    render(
      <DndContext>
        <ApplicationCard
          app={makeApp()}
          index={0}
          isSelected={false}
          onClick={vi.fn()}
        />
      </DndContext>
    )

    expect(screen.getByTestId('application-health-dot').className).toContain('bg-red-500')
  })

  it('does not render a health dot outside applied status', () => {
    render(
      <DndContext>
        <ApplicationCard
          app={makeApp({ status: 'saved' })}
          index={0}
          isSelected={false}
          onClick={vi.fn()}
        />
      </DndContext>
    )

    expect(screen.queryByTestId('application-health-dot')).toBeNull()
  })
})
