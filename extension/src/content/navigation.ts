// ─── Navigation watcher (world: MAIN) ────────────────────────────────────────
// This script runs in the page's main JavaScript context (not the isolated
// content script context) so it can intercept history.pushState on CSP-strict
// sites that block content script injection into the page context.
//
// Dispatches a custom event that the isolated content script listens for.

const BACKLOG_NAV_EVENT = 'backlog:navigation'

// Patch pushState
const originalPushState = history.pushState.bind(history)
history.pushState = function (...args) {
  originalPushState(...args)
  window.dispatchEvent(new CustomEvent(BACKLOG_NAV_EVENT, { detail: { url: location.href } }))
}

// Patch replaceState (some SPAs use this for URL updates)
const originalReplaceState = history.replaceState.bind(history)
history.replaceState = function (...args) {
  originalReplaceState(...args)
  window.dispatchEvent(new CustomEvent(BACKLOG_NAV_EVENT, { detail: { url: location.href } }))
}

// Also forward native popstate events
window.addEventListener('popstate', () => {
  window.dispatchEvent(new CustomEvent(BACKLOG_NAV_EVENT, { detail: { url: location.href } }))
})
