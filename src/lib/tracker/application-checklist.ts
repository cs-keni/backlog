export interface ApplicationChecklistInput {
  hasResume: boolean
  hasCoverLetter: boolean
  hasInterviewKit: boolean
  appliedAt: string | null
}

export interface ApplicationChecklistItem {
  label: string
  done: boolean
}

export function buildApplicationChecklist(input: ApplicationChecklistInput): ApplicationChecklistItem[] {
  return [
    { label: 'Resume on file', done: input.hasResume },
    { label: 'Cover letter added', done: input.hasCoverLetter },
    { label: 'Interview kit generated', done: input.hasInterviewKit },
    { label: 'Applied date logged', done: Boolean(input.appliedAt) },
  ]
}
