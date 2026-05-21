export const DISMISS_REASONS = [
  { value: 'not_my_level', label: 'Not my level' },
  { value: 'too_far', label: 'Too far' },
  { value: 'wrong_stack', label: 'Wrong stack' },
  { value: 'company_culture', label: 'Company culture' },
  { value: 'other', label: 'Other' },
] as const

export type DismissReason = typeof DISMISS_REASONS[number]['value']

export interface FeedbackFilters {
  excludeTooFar: boolean
  excludeWrongStack: boolean
  tooFarCount: number
  wrongStackCount: number
}

export function isDismissReason(reason: unknown): reason is DismissReason {
  return typeof reason === 'string' && DISMISS_REASONS.some((item) => item.value === reason)
}

export function computeActiveFeedbackFilters(rows: Array<{ reason: string }>): FeedbackFilters {
  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.reason] = (acc[row.reason] ?? 0) + 1
    return acc
  }, {})

  return {
    excludeTooFar: (counts.too_far ?? 0) >= 5,
    excludeWrongStack: (counts.wrong_stack ?? 0) >= 5,
    tooFarCount: counts.too_far ?? 0,
    wrongStackCount: counts.wrong_stack ?? 0,
  }
}

export async function getActiveFeedbackFilters(
  userId: string,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<FeedbackFilters> {
  const { data } = await supabase
    .from('job_feedback')
    .select('reason')
    .eq('user_id', userId)

  return computeActiveFeedbackFilters((data ?? []) as Array<{ reason: string }>)
}
