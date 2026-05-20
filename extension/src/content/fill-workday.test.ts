import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fillWorkdayCombobox, waitForChildListChange } from './fill-workday'

function clearBody() {
  document.body.innerHTML = ''
}

// Creates a container with a [role="combobox"] trigger. When the trigger is
// clicked, appends a listbox with the given option texts to document.body.
// Returns the container and a function that returns the last clicked option text.
function makeComboboxContainer(options: string[]): {
  container: HTMLDivElement
  clicked: () => string | null
} {
  const container = document.createElement('div')
  const trigger = document.createElement('button')
  trigger.setAttribute('role', 'combobox')
  let lastClicked: string | null = null

  trigger.addEventListener('click', () => {
    const listbox = document.createElement('ul')
    listbox.setAttribute('role', 'listbox')
    for (const text of options) {
      const opt = document.createElement('li')
      opt.setAttribute('role', 'option')
      opt.textContent = text
      opt.addEventListener('click', () => { lastClicked = text })
      listbox.appendChild(opt)
    }
    document.body.appendChild(listbox)
  })

  container.appendChild(trigger)
  document.body.appendChild(container)
  return { container, clicked: () => lastClicked }
}

// ─── fillWorkdayCombobox ──────────────────────────────────────────────────────

describe('fillWorkdayCombobox — option selection', () => {
  beforeEach(clearBody)
  afterEach(() => vi.useRealTimers())

  it('clicks trigger, waits for options, clicks exact match', async () => {
    const { container, clicked } = makeComboboxContainer(['Oregon', 'California', 'Washington'])
    const result = await fillWorkdayCombobox(container, 'Oregon')
    expect(result).toBe(true)
    expect(clicked()).toBe('Oregon')
  })

  it('matches case-insensitively', async () => {
    const { container, clicked } = makeComboboxContainer(['United States', 'Canada'])
    const result = await fillWorkdayCombobox(container, 'UNITED STATES')
    expect(result).toBe(true)
    expect(clicked()).toBe('United States')
  })

  it('falls back to starts-with when no exact match', async () => {
    const { container, clicked } = makeComboboxContainer(['United States', 'United Kingdom'])
    const result = await fillWorkdayCombobox(container, 'united s')
    expect(result).toBe(true)
    expect(clicked()).toBe('United States')
  })

  it('returns false when container has no trigger element', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const result = await fillWorkdayCombobox(container, 'Oregon')
    expect(result).toBe(false)
  })

  it('returns false when no option matches the value', async () => {
    const { container } = makeComboboxContainer(['California', 'Nevada'])
    const result = await fillWorkdayCombobox(container, 'Nonexistent State')
    expect(result).toBe(false)
  })

  it('returns false after 1000ms timeout when options never appear', async () => {
    vi.useFakeTimers()

    const container = document.createElement('div')
    const trigger = document.createElement('button')
    trigger.setAttribute('role', 'combobox')
    // click handler intentionally omitted — no options will appear
    container.appendChild(trigger)
    document.body.appendChild(container)

    const promise = fillWorkdayCombobox(container, 'Oregon')
    vi.advanceTimersByTime(1000)
    const result = await promise
    expect(result).toBe(false)
  })
})

// ─── waitForChildListChange ───────────────────────────────────────────────────

describe('waitForChildListChange', () => {
  beforeEach(clearBody)
  afterEach(() => vi.useRealTimers())

  it('resolves when a child is appended to the container', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    let resolved = false
    const p = waitForChildListChange(container, 500).then(() => { resolved = true })
    container.appendChild(document.createElement('span'))
    await p
    expect(resolved).toBe(true)
  })

  it('resolves after timeout fallback when no mutation occurs', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    document.body.appendChild(container)

    const promise = waitForChildListChange(container, 300)
    vi.advanceTimersByTime(300)
    await promise
    // Reaching here without hanging confirms the timeout resolved the promise
  })
})

// ─── country → state cascade ─────────────────────────────────────────────────

describe('country → state cascade', () => {
  beforeEach(clearBody)

  it('waitForChildListChange unblocks state fill after country triggers a re-render', async () => {
    const { container: countryContainer, clicked: countryClicked } =
      makeComboboxContainer(['United States', 'Canada'])

    // State container starts empty; Workday will populate it after country selection
    const stateContainer = document.createElement('div')
    document.body.appendChild(stateContainer)

    // Step 1: fill country
    const countryOk = await fillWorkdayCombobox(countryContainer, 'United States')
    expect(countryOk).toBe(true)
    expect(countryClicked()).toBe('United States')

    // Step 2: wait for state container to update (simulates Workday re-rendering
    // the state options after country is selected; 300ms fallback for slow pages)
    const cascadeWait = waitForChildListChange(stateContainer, 300)
    let statePopulated = false
    setTimeout(() => {
      // Simulate Workday adding a combobox trigger to the state container
      const stateTrigger = document.createElement('button')
      stateTrigger.setAttribute('role', 'combobox')
      stateTrigger.addEventListener('click', () => {
        const listbox = document.createElement('ul')
        listbox.setAttribute('role', 'listbox')
        ;['Oregon', 'California', 'Washington'].forEach((name) => {
          const opt = document.createElement('li')
          opt.setAttribute('role', 'option')
          opt.textContent = name
          listbox.appendChild(opt)
        })
        document.body.appendChild(listbox)
      })
      stateContainer.appendChild(stateTrigger)
      statePopulated = true
    }, 50)

    await cascadeWait
    expect(statePopulated).toBe(true)

    // Step 3: fill state using the now-populated container
    const stateOk = await fillWorkdayCombobox(stateContainer, 'Oregon')
    expect(stateOk).toBe(true)
  })
})
