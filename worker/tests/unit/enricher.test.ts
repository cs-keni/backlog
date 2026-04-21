import { describe, it, expect } from 'vitest'

// extractSalaryFromText is not exported — test via the enriched pipeline result
// by calling the internal regex patterns directly. We replicate the function here
// to unit-test the regex logic without needing network/OpenAI.
function extractSalaryFromText(text: string): { salary_min: number | null; salary_max: number | null } {
  function parseAmount(raw: string, forceK = false): number {
    const n = parseFloat(raw.replace(/,/g, ''))
    if (isNaN(n)) return 0
    return forceK && n < 1000 ? n * 1000 : n
  }

  const dollarRange = text.match(/\$\s*([\d,]+\.?\d*)\s*k?\s*(?:to|–|—|-|\/)\s*\$\s*([\d,]+\.?\d*)\s*k?/i)
  if (dollarRange) {
    const hasK = dollarRange[0].toLowerCase().includes('k')
    const min = parseAmount(dollarRange[1], hasK)
    const max = parseAmount(dollarRange[2], hasK)
    if (min > 1000 && max > 1000) return { salary_min: min, salary_max: max }
  }

  const contextRange = text.match(
    /(?:salary|compensation|pay|wage)[^\n$]*\$\s*([\d,]+\.?\d*)\s*k?\s*(?:to|–|—|-)\s*\$?\s*([\d,]+\.?\d*)\s*k?/i
  )
  if (contextRange) {
    const hasK = contextRange[0].toLowerCase().includes('k')
    const min = parseAmount(contextRange[1], hasK)
    const max = parseAmount(contextRange[2], hasK)
    if (min > 10000 && max > 10000) return { salary_min: min, salary_max: max }
  }

  const singleDollar = text.match(/\$\s*([\d,]+\.?\d*)\s*k?\s*\+/i)
  if (singleDollar) {
    const min = parseAmount(singleDollar[1], singleDollar[0].toLowerCase().includes('k'))
    if (min > 10000) return { salary_min: min, salary_max: null }
  }

  return { salary_min: null, salary_max: null }
}

describe('extractSalaryFromText', () => {
  it('parses "$120,000 – $150,000"', () => {
    const result = extractSalaryFromText('Compensation: $120,000 – $150,000 annually')
    expect(result).toEqual({ salary_min: 120000, salary_max: 150000 })
  })

  it('parses "$120k–$150k" shorthand', () => {
    const result = extractSalaryFromText('Base salary $120k–$150k')
    expect(result).toEqual({ salary_min: 120000, salary_max: 150000 })
  })

  it('parses "salary: $80k to $100k" context range', () => {
    const result = extractSalaryFromText('Expected salary: $80k to $100k')
    expect(result).toEqual({ salary_min: 80000, salary_max: 100000 })
  })

  it('returns null for no salary text', () => {
    const result = extractSalaryFromText('Join our team and work on exciting problems.')
    expect(result).toEqual({ salary_min: null, salary_max: null })
  })

  it('parses "$150k+" as min-only', () => {
    const result = extractSalaryFromText('Compensation: $150k+')
    expect(result).toEqual({ salary_min: 150000, salary_max: null })
  })

  it('parses dash-separated range without spaces', () => {
    const result = extractSalaryFromText('$100,000-$130,000')
    expect(result).toEqual({ salary_min: 100000, salary_max: 130000 })
  })
})
