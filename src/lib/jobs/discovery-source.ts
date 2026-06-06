// Single source of truth for "how we found this job" — maps the granular
// `jobs.source_detail` value to display info shared by the feed badge
// (JobCard / JobDetail) and the analytics breakdown (FeedBreakdown).

export interface DiscoverySource {
  key: string
  label: string
  icon: string
  color: string // Tailwind bg-* class, used for analytics bars
  group: string // category shown as the badge's sub-label in analytics
}

export const DISCOVERY_SOURCES = {
  github_repo: {
    key: 'github_repo',
    label: 'GitHub feed',
    icon: '🐙',
    color: 'bg-indigo-500',
    group: 'Curated feed',
  },
  brave_search: {
    key: 'brave_search',
    label: 'Brave Search',
    icon: '🦁',
    color: 'bg-orange-500',
    group: 'Web search',
  },
  greenhouse: {
    key: 'greenhouse',
    label: 'Greenhouse',
    icon: '🌱',
    color: 'bg-emerald-500',
    group: 'Company portal',
  },
  lever: {
    key: 'lever',
    label: 'Lever',
    icon: '🎚️',
    color: 'bg-cyan-500',
    group: 'Company portal',
  },
  workday: {
    key: 'workday',
    label: 'Workday',
    icon: '📅',
    color: 'bg-blue-500',
    group: 'Company portal',
  },
  usajobs: {
    key: 'usajobs',
    label: 'USAJobs',
    icon: '🇺🇸',
    color: 'bg-rose-500',
    group: 'Company portal',
  },
  manual_url: {
    key: 'manual_url',
    label: 'Pasted URL',
    icon: '🔗',
    color: 'bg-violet-500',
    group: 'Manual',
  },
  manual_entry: {
    key: 'manual_entry',
    label: 'Added manually',
    icon: '✋',
    color: 'bg-zinc-500',
    group: 'Manual',
  },
  extension: {
    key: 'extension',
    label: 'Browser extension',
    icon: '🧩',
    color: 'bg-pink-500',
    group: 'Manual',
  },
} as const satisfies Record<string, DiscoverySource>

export type DiscoverySourceKey = keyof typeof DISCOVERY_SOURCES

// Generic fallback for jobs ingested before `source_detail` existed — we know
// the coarse `source` but not the exact channel.
const UNKNOWN_SOURCE: DiscoverySource = {
  key: 'unknown',
  label: 'Discovered',
  icon: '🔎',
  color: 'bg-zinc-600',
  group: 'Other',
}

// Resolves the discovery channel for a job, preferring the granular
// `source_detail` and falling back to a best guess from the coarse `source`
// for legacy rows where `source_detail` is null.
export function getDiscoverySource(
  sourceDetail: string | null | undefined,
  source: string | null | undefined
): DiscoverySource {
  if (sourceDetail && sourceDetail in DISCOVERY_SOURCES) {
    return DISCOVERY_SOURCES[sourceDetail as DiscoverySourceKey]
  }
  if (source === 'github') return DISCOVERY_SOURCES.github_repo
  if (source === 'manual') return DISCOVERY_SOURCES.manual_entry
  return UNKNOWN_SOURCE
}
