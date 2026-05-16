// ─── Shadow DOM traversal utilities ──────────────────────────────────────────
// Shared by fill.ts and detect.ts so neither imports from the other.

export function queryShadowAll<T extends Element>(
  selector: string,
  root: Document | ShadowRoot | Element = document,
): T[] {
  const results: T[] = Array.from(
    (root as Document | ShadowRoot | Element).querySelectorAll<T>(selector),
  )
  for (const host of (root as Document | ShadowRoot | Element).querySelectorAll('*')) {
    if ((host as Element & { shadowRoot?: ShadowRoot }).shadowRoot) {
      results.push(
        ...queryShadowAll<T>(
          selector,
          (host as Element & { shadowRoot: ShadowRoot }).shadowRoot,
        ),
      )
    }
  }
  return results
}

// Scoped to form containers first (fast path for React-heavy Workday pages),
// falls back to full document when no containers are found.
export function queryShadowScoped<T extends Element>(selector: string): T[] {
  const containers = Array.from(
    document.querySelectorAll<Element>('form, main, [role="main"], [data-automation-id]'),
  )
  if (containers.length === 0) return queryShadowAll<T>(selector)

  const seen = new Set<T>()
  const results: T[] = []
  for (const container of containers) {
    for (const el of queryShadowAll<T>(selector, container)) {
      if (!seen.has(el)) { seen.add(el); results.push(el) }
    }
  }
  return results.length > 0 ? results : queryShadowAll<T>(selector)
}
