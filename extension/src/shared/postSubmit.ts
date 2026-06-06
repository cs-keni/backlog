import type { AtsType } from './types'

export function isPostSubmitConfirmationUrl(url: string, ats: AtsType): boolean {
  if (ats === 'greenhouse') return /\/applications\/confirmation(?:[/?#]|$)/i.test(url)
  if (ats === 'lever') return /\/apply\/confirmation(?:[/?#]|$)/i.test(url)
  if (ats === 'workday') return /\/applied(?:[/?#]|$)/i.test(url)
  return false
}

// "The new page has no form" is true after almost any navigation — it's not
// evidence of a successful application. Require an explicit confirmation cue:
// either the URL itself signals success/completion, or the page text contains
// a phrase real ATS confirmation pages use ("thank you for applying", etc).
const CONFIRMATION_URL_PATTERN = /\b(?:thank-?you|thanks|confirm(?:ed|ation)?|success(?:ful)?|application-?(?:received|submitted|complete)|applied|submitted|received)\b/i

const CONFIRMATION_TEXT_PATTERN = /thank you for (?:your interest|applying)|application (?:has been |was )?(?:received|submitted|successfully submitted)|we(?:'ve| have) received your application|your application (?:has been |was )?(?:received|submitted)|successfully submitted your application/i

export function isGenericPostSubmitPage(url: string, hasForm: boolean, bodyText: string): boolean {
  if (hasForm) return false
  return CONFIRMATION_URL_PATTERN.test(url) || CONFIRMATION_TEXT_PATTERN.test(bodyText)
}
