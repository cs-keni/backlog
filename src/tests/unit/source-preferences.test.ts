import { describe, expect, it } from 'vitest'
import { hiddenSources, isSourcePreferenceAction, updateSourcePreferences } from '@/lib/user/source-preferences'

describe('source preferences', () => {
  it('pins, hides, and resets a source preference', () => {
    const pinned = updateSourcePreferences({}, 'portal', 'pin')
    expect(pinned).toEqual({ portal: 'pin' })

    const hidden = updateSourcePreferences(pinned, 'portal', 'hide')
    expect(hidden).toEqual({ portal: 'hide' })

    const reset = updateSourcePreferences(hidden, 'portal', 'reset')
    expect(reset).toEqual({})
  })

  it('returns only hidden sources for feed exclusion', () => {
    expect(hiddenSources({ github: 'hide', portal: 'pin' })).toEqual(['github'])
  })

  it('validates actions', () => {
    expect(isSourcePreferenceAction('pin')).toBe(true)
    expect(isSourcePreferenceAction('hide')).toBe(true)
    expect(isSourcePreferenceAction('reset')).toBe(true)
    expect(isSourcePreferenceAction('delete')).toBe(false)
  })
})
