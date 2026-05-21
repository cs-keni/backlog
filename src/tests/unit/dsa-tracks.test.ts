import { describe, expect, it } from 'vitest'
import { NEETCODE_75, NEETCODE_150, NEETCODE_250, TRACK_PROBLEMS, PATTERNS } from '@/lib/dsa/neetcode150'

describe('DSA track problem sets', () => {
  it('defines Blind 75 as a subset of NeetCode 150', () => {
    const nc150 = new Set(NEETCODE_150.map(problem => problem.slug))

    expect(NEETCODE_75).toHaveLength(75)
    expect(NEETCODE_75.every(problem => nc150.has(problem.slug))).toBe(true)
  })

  it('defines NeetCode 250 as NeetCode 150 plus 100 additional unique problems', () => {
    const nc150 = new Set(NEETCODE_150.map(problem => problem.slug))
    const nc250 = new Set(NEETCODE_250.map(problem => problem.slug))

    expect(NEETCODE_250).toHaveLength(250)
    expect(nc250.size).toBe(250)
    expect([...nc150].every(slug => nc250.has(slug))).toBe(true)
  })

  it('matches the current NeetCode 250 per-pattern counts', () => {
    const expectedCounts: Record<string, number> = {
      'Arrays & Hashing': 22,
      'Two Pointers': 13,
      'Sliding Window': 9,
      Stack: 14,
      'Binary Search': 14,
      'Linked List': 14,
      Trees: 23,
      'Heap / Priority Queue': 12,
      Backtracking: 17,
      Tries: 4,
      Graphs: 21,
      'Advanced Graphs': 10,
      '1D Dynamic Programming': 17,
      '2D Dynamic Programming': 16,
      Greedy: 14,
      Intervals: 7,
      'Math & Geometry': 13,
      'Bit Manipulation': 10,
    }

    for (const pattern of PATTERNS) {
      expect(NEETCODE_250.filter(problem => problem.pattern === pattern)).toHaveLength(expectedCounts[pattern])
    }
  })

  it('exposes O(1) slug sets for each track', () => {
    expect(TRACK_PROBLEMS['75'].size).toBe(75)
    expect(TRACK_PROBLEMS['150'].size).toBe(150)
    expect(TRACK_PROBLEMS['250'].size).toBe(250)
  })
})
