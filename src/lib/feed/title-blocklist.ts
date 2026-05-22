/**
 * Job title patterns that are permanently excluded from the feed.
 * Each entry is a SQL ILIKE pattern (% = wildcard).
 *
 * "embedded" covers: Embedded Software Engineer, Embedded Systems Engineer,
 *   Embedded Linux Engineer, Embedded Firmware Engineer, etc.
 * "firmware" covers: Firmware Engineer, Firmware Developer, etc.
 */
export const TITLE_BLOCKLIST: string[] = [
  '%embedded%',
  '%firmware%',
]

/** Client-side equivalent — used for e2e fixture filtering and unit tests. */
export function titleIsBlocked(title: string): boolean {
  const lower = title.toLowerCase()
  return TITLE_BLOCKLIST.some((pattern) => {
    const regex = pattern.replace(/%/g, '.*')
    return new RegExp(`^${regex}$`, 'i').test(lower)
  })
}
