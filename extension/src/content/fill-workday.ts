import { queryShadowAll } from '../shared/domUtils'

/**
 * Fills a Workday async combobox by clicking the [role="combobox"] or
 * button[aria-haspopup] trigger found inside `container`, then waiting
 * for [role="option"] elements to appear via MutationObserver (1000ms timeout).
 *
 * Matching: exact text first, then starts-with (both case-insensitive).
 * Returns false if no trigger found, timeout fires, or no option matches.
 */
export function fillWorkdayCombobox(container: Element, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const trigger =
      queryShadowAll<HTMLElement>('[role="combobox"]', container)[0] ??
      queryShadowAll<HTMLElement>('button[aria-haspopup]', container)[0]
    if (!trigger) { resolve(false); return }

    const normalized = value.toLowerCase()
    let settled = false

    const finish = (result: boolean) => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearTimeout(timer)
      resolve(result)
    }

    // Observer must be attached before clicking — the click handler may append
    // options synchronously and we'd miss the mutation if we observed after.
    const observer = new MutationObserver(() => {
      const options = queryShadowAll<HTMLElement>('[role="option"]')
      if (options.length === 0) return

      const match =
        options.find((o) => (o.textContent?.trim().toLowerCase() ?? '') === normalized) ??
        options.find((o) => (o.textContent?.trim().toLowerCase() ?? '').startsWith(normalized))

      if (!match) { finish(false); return }

      match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      match.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
      match.click()
      finish(true)
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const timer = setTimeout(() => finish(false), 1000)

    trigger.click()
  })
}

/**
 * Waits for any childList mutation within `container` subtree, or resolves
 * after `timeoutMs` ms as a fallback. Used for the country → state cascade:
 * after selecting a country in Workday, the state options list re-renders.
 */
export function waitForChildListChange(container: Element, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      observer.disconnect()
      clearTimeout(timer)
      resolve()
    }
    const observer = new MutationObserver(finish)
    observer.observe(container, { childList: true, subtree: true })
    const timer = setTimeout(finish, timeoutMs)
  })
}
