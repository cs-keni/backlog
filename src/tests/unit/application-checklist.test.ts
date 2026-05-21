import { describe, expect, it } from 'vitest'
import { buildApplicationChecklist } from '@/lib/tracker/application-checklist'

describe('buildApplicationChecklist', () => {
  it('derives packet completion from existing application data', () => {
    const items = buildApplicationChecklist({
      hasResume: true,
      hasCoverLetter: false,
      hasInterviewKit: true,
      appliedAt: '2026-05-21T12:00:00.000Z',
    })

    expect(items).toEqual([
      { label: 'Resume on file', done: true },
      { label: 'Cover letter added', done: false },
      { label: 'Interview kit generated', done: true },
      { label: 'Applied date logged', done: true },
    ])
  })
})
