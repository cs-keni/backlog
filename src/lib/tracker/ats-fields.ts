import type { UserProfile } from '@/lib/jobs/types'
import type { AtsPlatform } from './ats-platform'

type AtsProfile = Pick<UserProfile, 'full_name' | 'email' | 'resume_text' | 'linkedin_url' | 'street_address' | 'phone'> & {
  work_authorization?: string | null
}

interface AtsFieldSpec {
  label: string
  dataKey: keyof AtsProfile
}

const ATS_REQUIRED_FIELDS: Partial<Record<AtsPlatform, AtsFieldSpec[]>> = {
  greenhouse: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Resume', dataKey: 'resume_text' },
    { label: 'LinkedIn URL', dataKey: 'linkedin_url' },
    { label: 'Work authorization', dataKey: 'work_authorization' },
  ],
  workday: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Street address', dataKey: 'street_address' },
    { label: 'Phone number', dataKey: 'phone' },
    { label: 'Resume', dataKey: 'resume_text' },
    { label: 'Work authorization', dataKey: 'work_authorization' },
  ],
  lever: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Resume', dataKey: 'resume_text' },
    { label: 'LinkedIn URL', dataKey: 'linkedin_url' },
  ],
  ashby: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Resume', dataKey: 'resume_text' },
  ],
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

export function computeAtsCompleteness(
  platform: string | null | undefined,
  profile: AtsProfile
): { score: number; missing: string[] } | null {
  if (!platform || platform === 'unknown') return null
  const fields = ATS_REQUIRED_FIELDS[platform as AtsPlatform]
  if (!fields) return null
  const missing = fields.filter((field) => !hasValue(profile[field.dataKey])).map((field) => field.label)
  return {
    score: Math.round(((fields.length - missing.length) / fields.length) * 100),
    missing,
  }
}
