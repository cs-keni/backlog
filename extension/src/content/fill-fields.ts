export function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set
  nativeInputValueSetter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.dispatchEvent(new Event('blur', { bubbles: true }))
}

export function setSelectValue(select: HTMLSelectElement, value: string) {
  const normalized = value.trim().toLowerCase()
  const option =
    Array.from(select.options).find((o) => o.text.trim() === value || o.value === value) ??
    Array.from(select.options).find((o) => o.text.trim().toLowerCase() === normalized) ??
    Array.from(select.options).find((o) => o.text.trim().toLowerCase().startsWith(normalized)) ??
    Array.from(select.options).find((o) => o.text.trim().toLowerCase().includes(normalized) && normalized.length > 2)
  if (option) {
    select.value = option.value
    select.dispatchEvent(new Event('change', { bubbles: true }))
    select.dispatchEvent(new Event('blur', { bubbles: true }))
  }
}

export function getLabelForInput(input: Element): string {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`)
    if (label) return label.textContent?.trim().toLowerCase() ?? ''
  }
  const labelledBy = input.getAttribute('aria-labelledby')
  if (labelledBy) {
    const el = document.getElementById(labelledBy)
    if (el) return el.textContent?.trim().toLowerCase() ?? ''
  }
  const parentLabel = input.closest('label')
  if (parentLabel) return parentLabel.textContent?.trim().toLowerCase() ?? ''
  const prev = input.previousElementSibling
  if (prev?.tagName === 'LABEL') return prev.textContent?.trim().toLowerCase() ?? ''
  const aria = input.getAttribute('aria-label')
  if (aria) return aria.toLowerCase()

  let ancestor = input.parentElement
  while (ancestor && ancestor !== document.body) {
    const siblingLabel = ancestor.querySelector(':scope > label, :scope > .label')
    if (siblingLabel) return siblingLabel.textContent?.trim().toLowerCase() ?? ''
    if (ancestor.tagName === 'FORM' || ancestor.tagName === 'FIELDSET') break
    ancestor = ancestor.parentElement
  }

  let shadowHops = 0
  let root = input.getRootNode()
  while (root instanceof ShadowRoot && shadowHops < 3) {
    shadowHops++
    const host = root.host
    if (host.id) {
      const hostRoot = host.getRootNode()
      if (hostRoot instanceof ShadowRoot || hostRoot instanceof Document) {
        const labelForHost = (hostRoot as Document | ShadowRoot).querySelector(`label[for="${host.id}"]`)
        if (labelForHost) return labelForHost.textContent?.trim().toLowerCase() ?? ''
      }
    }
    let hostAncestor = host.parentElement
    while (hostAncestor && hostAncestor.tagName !== 'FORM' && hostAncestor.tagName !== 'FIELDSET') {
      const sibLabel = hostAncestor.querySelector(':scope > label, :scope > [class*="label"]')
      if (sibLabel) {
        const txt = sibLabel.textContent?.trim().toLowerCase() ?? ''
        if (txt.length > 0 && txt.length < 80 && !txt.includes('\n')) return txt
      }
      if (hostAncestor === document.body) break
      hostAncestor = hostAncestor.parentElement
    }
    root = host.getRootNode()
  }

  const placeholder = (input as HTMLInputElement).placeholder
  if (placeholder) return placeholder.toLowerCase()
  return (input.getAttribute('name') ?? '').toLowerCase().replace(/[_-]/g, ' ')
}

