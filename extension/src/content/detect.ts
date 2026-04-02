import type { AtsType, PageInfo } from '../shared/types'

export function detectAts(url: string): AtsType {
  if (/boards\.greenhouse\.io/.test(url)) return 'greenhouse'
  if (/jobs\.lever\.co/.test(url)) return 'lever'
  if (/myworkdayjobs\.com|workday\.com/.test(url)) return 'workday'
  if (/icims\.com/.test(url)) return 'generic'
  if (/bamboohr\.com/.test(url)) return 'generic'
  // Check if the page has a job application form (best-effort generic detection)
  if (hasJobForm()) return 'generic'
  return null
}

function hasJobForm(): boolean {
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea')
  if (inputs.length < 3) return false
  // Look for email input — almost always present on job apps
  const emailInput = document.querySelector('input[type="email"], input[name*="email"], input[id*="email"]')
  return emailInput !== null
}

export function extractPageInfo(): PageInfo {
  const url = window.location.href
  const ats = detectAts(url)

  let jobTitle: string | null = null
  let company: string | null = null
  let jobDescription: string | null = null

  if (ats === 'greenhouse') {
    jobTitle = document.querySelector('h1.app-title, h1[class*="title"]')?.textContent?.trim() ?? null
    company = document.querySelector('.company-name, [class*="company"]')?.textContent?.trim() ?? null
    jobDescription = document.querySelector('#content, .content')?.textContent?.trim().slice(0, 2000) ?? null
  } else if (ats === 'lever') {
    jobTitle = document.querySelector('.posting-headline h2, h2[class*="posting"]')?.textContent?.trim() ?? null
    company = document.querySelector('.main-header-text h1, [data-qa="company-name"]')?.textContent?.trim() ?? null
    jobDescription = document.querySelector('.posting-description, [class*="description"]')?.textContent?.trim().slice(0, 2000) ?? null
  } else {
    // Generic: try common patterns
    jobTitle = (
      document.querySelector('h1[class*="job"], h1[class*="title"], h1[class*="position"]') ??
      document.querySelector('h1')
    )?.textContent?.trim() ?? null
    company = document.querySelector('[class*="company"], [class*="employer"]')?.textContent?.trim() ?? null
    jobDescription = document.querySelector('[class*="description"], [class*="overview"]')?.textContent?.trim().slice(0, 2000) ?? null
  }

  // Fallback: grab page <title>
  if (!jobTitle) {
    const title = document.title
    // Strip common suffixes like "| Greenhouse" or "- Lever"
    jobTitle = title.replace(/\s*[\|–\-]\s*(Greenhouse|Lever|Workday|Indeed|LinkedIn|Glassdoor).*$/i, '').trim() || null
  }

  return {
    ats,
    jobTitle,
    company,
    jobDescription,
    isJobPage: ats !== null,
  }
}
