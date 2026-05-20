import type { AtsType } from './types'

export function isPostSubmitConfirmationUrl(url: string, ats: AtsType): boolean {
  if (ats === 'greenhouse') return /\/applications\/confirmation(?:[/?#]|$)/i.test(url)
  if (ats === 'lever') return /\/apply\/confirmation(?:[/?#]|$)/i.test(url)
  if (ats === 'workday') return /\/applied(?:[/?#]|$)/i.test(url)
  return false
}

export function isGenericPostSubmitPage(hasForm: boolean): boolean {
  return !hasForm
}
