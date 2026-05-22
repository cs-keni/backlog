import type { PrepQuestion } from './prep-types'

export function getSpotlightQuestions(
  activeCompanies: string[],
  allQuestions: PrepQuestion[]
): PrepQuestion[] {
  const normalizedCos = activeCompanies
    .map((company) => company.trim().toLowerCase())
    .filter(Boolean)

  return allQuestions
    .filter((question) =>
      question.companies?.some((tag) => {
        const normalizedTag = tag.toLowerCase()
        if (normalizedTag.length < 5) return false
        return normalizedCos.some((company) =>
          company.includes(normalizedTag) || normalizedTag.includes(company)
        )
      })
    )
    .sort((a, b) => {
      const aExact = a.companies?.some((tag) => normalizedCos.includes(tag.toLowerCase())) ? 1 : 0
      const bExact = b.companies?.some((tag) => normalizedCos.includes(tag.toLowerCase())) ? 1 : 0
      return bExact - aExact
    })
    .slice(0, 5)
}
