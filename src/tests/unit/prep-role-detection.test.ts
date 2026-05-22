import { describe, expect, it } from 'vitest'
import { hasAIEngineerApplications } from '@/lib/prep/role-detection'

describe('hasAIEngineerApplications', () => {
  it('detects AI engineer role titles', () => {
    expect(hasAIEngineerApplications(['Senior LLM Engineer', 'Frontend Engineer'])).toBe(true)
    expect(hasAIEngineerApplications(['Applied Scientist, Recommendations'])).toBe(true)
  })

  it('returns false for non-AI application titles', () => {
    expect(hasAIEngineerApplications(['Backend Engineer', 'Platform Software Engineer'])).toBe(false)
  })
})
