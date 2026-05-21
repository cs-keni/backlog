export const KNOWN_ATS_PLATFORMS = ['greenhouse', 'workday', 'lever', 'ashby', 'icims', 'taleo', 'jobvite', 'smartrecruiters'] as const
export type AtsPlatform = typeof KNOWN_ATS_PLATFORMS[number]

const ATS_PATTERNS: Array<[RegExp, AtsPlatform]> = [
  [/greenhouse\.io/i, 'greenhouse'],
  [/myworkdayjobs\.com/i, 'workday'],
  [/lever\.co/i, 'lever'],
  [/ashbyhq\.com/i, 'ashby'],
  [/icims\.com/i, 'icims'],
  [/taleo\.net/i, 'taleo'],
  [/jobvite\.com/i, 'jobvite'],
  [/smartrecruiters\.com/i, 'smartrecruiters'],
]

export function detectAtsPlatform(careersUrl: string | null | undefined): AtsPlatform | 'unknown' | null {
  if (!careersUrl) return null
  for (const [pattern, name] of ATS_PATTERNS) {
    if (pattern.test(careersUrl)) return name
  }
  return 'unknown'
}

export function isKnownAtsPlatform(platform: string | null | undefined): platform is AtsPlatform {
  return KNOWN_ATS_PLATFORMS.includes(platform as AtsPlatform)
}
