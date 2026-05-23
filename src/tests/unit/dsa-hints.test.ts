import { describe, expect, it } from 'vitest'
import { HINTS, ProblemHintsSchema } from '@/lib/dsa/hints'

describe('ProblemHints schema validation', () => {
  it('validates all hints without errors', () => {
    for (const hint of HINTS) {
      expect(() => ProblemHintsSchema.parse(hint)).not.toThrow()
    }
  })

  it('has at least 18 hints (one per pattern)', () => {
    expect(HINTS.length).toBeGreaterThanOrEqual(18)
  })

  it('has no duplicate slugs', () => {
    const slugs = HINTS.map((h) => h.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('all slugs are non-empty strings', () => {
    for (const hint of HINTS) {
      expect(hint.slug.length).toBeGreaterThan(0)
    }
  })

  it('all layer4 brute force hints are non-empty', () => {
    for (const hint of HINTS) {
      expect(hint.layer4.trim().length).toBeGreaterThan(0)
    }
  })

  it('layer2 has python, java, js, and description fields', () => {
    for (const hint of HINTS) {
      expect(hint.layer2.python.length).toBeGreaterThan(0)
      expect(hint.layer2.java.length).toBeGreaterThan(0)
      expect(hint.layer2.js.length).toBeGreaterThan(0)
      expect(hint.layer2.description.length).toBeGreaterThan(0)
    }
  })

  it('layer3 has algorithm, timeComplexity, spaceComplexity fields', () => {
    for (const hint of HINTS) {
      expect(hint.layer3.algorithm.length).toBeGreaterThan(0)
      expect(hint.layer3.timeComplexity.length).toBeGreaterThan(0)
      expect(hint.layer3.spaceComplexity.length).toBeGreaterThan(0)
    }
  })
})
