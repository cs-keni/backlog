// Pure parsing helpers extracted from lib/jobs/url-extractor.ts for unit testing
// These functions have no side effects and require no mocking.

export function detectAts(url: string): 'greenhouse' | 'lever' | 'other' {
  if (/boards\.greenhouse\.io\/.+\/jobs\/\d+/.test(url)) return 'greenhouse'
  if (/jobs\.lever\.co\/.+\/.+/.test(url)) return 'lever'
  return 'other'
}

export function extractGreenhouseIds(
  url: string
): { company: string; jobId: string } | null {
  const match = url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/)
  if (!match) return null
  return { company: match[1], jobId: match[2] }
}

export function extractLeverIds(
  url: string
): { company: string; jobId: string } | null {
  const match = url.match(/jobs\.lever\.co\/([^/]+)\/([^/?#]+)/)
  if (!match) return null
  return { company: match[1], jobId: match[2] }
}
