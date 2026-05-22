import { describe, expect, it } from 'vitest'
import { titleIsBlocked } from '@/lib/feed/title-blocklist'

describe('titleIsBlocked', () => {
  it('blocks embedded titles', () => {
    expect(titleIsBlocked('Embedded Software Engineer')).toBe(true)
    expect(titleIsBlocked('Senior Embedded Systems Engineer')).toBe(true)
    expect(titleIsBlocked('Embedded Linux Engineer')).toBe(true)
    expect(titleIsBlocked('Staff Embedded Engineer')).toBe(true)
  })

  it('blocks firmware titles', () => {
    expect(titleIsBlocked('Firmware Engineer')).toBe(true)
    expect(titleIsBlocked('Senior Firmware Developer')).toBe(true)
    expect(titleIsBlocked('Embedded Firmware Engineer')).toBe(true)
  })

  it('does not block standard software titles', () => {
    expect(titleIsBlocked('Software Engineer')).toBe(false)
    expect(titleIsBlocked('Senior Backend Engineer')).toBe(false)
    expect(titleIsBlocked('Full Stack Engineer')).toBe(false)
    expect(titleIsBlocked('AI Engineer')).toBe(false)
    expect(titleIsBlocked('Staff Software Engineer')).toBe(false)
  })
})
