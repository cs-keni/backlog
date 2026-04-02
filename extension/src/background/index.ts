import { markApplied, addJob } from '../shared/api'
import type { ExtensionMessage } from '../shared/types'

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'MARK_APPLIED') {
    const { jobUrl, jobTitle, company } = message.payload
    markApplied({ jobUrl, jobTitle, company })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true // keep channel open for async response
  }

  if (message.type === 'ADD_TO_BACKLOG') {
    const { url, title, company, description } = message.payload
    addJob({ url, title, company, description })
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }
})
