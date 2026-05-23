import { injectSidebar, updateSidebarPage } from './inject'
import { extractPageInfo, detectLeetCodeProblem } from '../content/detect'
import type { PageInfo } from '../shared/types'

function buildInitialPage(): PageInfo {
  const lcProblem = detectLeetCodeProblem(window.location.href)
  if (lcProblem) {
    return {
      ats: null,
      jobTitle: null,
      company: null,
      jobDescription: null,
      isJobPage: false,
      dsaSlug: lcProblem.lcSlug,
      dsaDifficulty: lcProblem.difficulty,
    }
  }
  return extractPageInfo()
}

injectSidebar(buildInitialPage())

// On LeetCode SPA navigation, content.js dispatches this event so the
// already-injected sidebar updates to the new problem (or clears DSA mode).
window.addEventListener('backlog:dsa-update', (e) => {
  updateSidebarPage((e as CustomEvent<PageInfo>).detail)
})
