import type { ConversionStats } from '@/lib/analytics/conversion'
import type { SourcePreferences } from '@/lib/user/source-preferences'

export type AnalyticsRange = '7d' | '30d' | '1y'

export interface AnalyticsData {
  stats: {
    totalApplications: number
    submitted: number
    inPipeline: number
    responseRate: number
    offers: number
    jobsInRange: number
  }
  applicationActivity: Array<{ date: string; count: number }>
  funnel: Array<{ status: string; count: number }>
  jobActivity: Array<{ date: string; count: number }>
  topCompanies: Array<{ company: string; count: number }>
  sourceBreakdown: { github: number; portal: number; manual: number }
  sourceYield: Array<{
    source: 'github' | 'portal' | 'manual'
    label: string
    applications: number
    submitted: number
    responses: number
    interviews: number
    offers: number
    responseRate: number
    interviewRate: number
  }>
  sourcePreferences: SourcePreferences
  medianDaysToResponse: number | null
  conversionStats: ConversionStats
}
