import { extractPageInfo } from './detect'
import { fillForm } from './fill'
import type { ExtensionMessage, FillResult } from '../shared/types'

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'GET_PAGE_INFO') {
    sendResponse(extractPageInfo())
    return true
  }

  if (message.type === 'FILL_FORM') {
    const { ats } = extractPageInfo()
    const result: FillResult = fillForm(message.payload, ats)
    sendResponse(result)
    return true
  }

  if (message.type === 'ADD_TO_BACKLOG') {
    // Handled by background — nothing to do in content script
    return false
  }
})

// Detect form submission and notify background to mark as applied
function watchForSubmission() {
  const info = extractPageInfo()
  if (!info.isJobPage) return

  // Watch for navigation away (possible form submission)
  let submitted = false

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      if (submitted) return
      submitted = true
      chrome.runtime.sendMessage({
        type: 'MARK_APPLIED',
        payload: {
          jobUrl: window.location.href,
          jobTitle: info.jobTitle,
          company: info.company,
        },
      } as ExtensionMessage)
    })
  })

  // Also watch for button clicks that look like submit buttons
  document.querySelectorAll('button[type="submit"], input[type="submit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (submitted) return
      submitted = true
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'MARK_APPLIED',
          payload: {
            jobUrl: window.location.href,
            jobTitle: info.jobTitle,
            company: info.company,
          },
        } as ExtensionMessage)
      }, 500) // Small delay so the navigation has started
    })
  })
}

watchForSubmission()
