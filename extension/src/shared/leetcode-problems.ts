// Minimal problem list for the DSA Companion content script.
// Keyed by LeetCode URL slug (NOT NeetCode slug — they differ for ~70 problems).
// Generated from src/lib/dsa/neetcode150.ts — extension cannot import that file
// directly because the extension is a separate Vite build with no src/ alias.

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface LcProblem {
  lcSlug: string
  difficulty: Difficulty
}

export const NEETCODE_150_LC: LcProblem[] = [
  // Arrays & Hashing (9)
  { lcSlug: 'contains-duplicate',                                              difficulty: 'easy'   },
  { lcSlug: 'valid-anagram',                                                   difficulty: 'easy'   },
  { lcSlug: 'two-sum',                                                         difficulty: 'easy'   },
  { lcSlug: 'group-anagrams',                                                  difficulty: 'medium' },
  { lcSlug: 'top-k-frequent-elements',                                         difficulty: 'medium' },
  { lcSlug: 'product-of-array-except-self',                                    difficulty: 'medium' },
  { lcSlug: 'valid-sudoku',                                                    difficulty: 'medium' },
  { lcSlug: 'encode-and-decode-strings',                                       difficulty: 'medium' },
  { lcSlug: 'longest-consecutive-sequence',                                    difficulty: 'medium' },

  // Two Pointers (5)
  { lcSlug: 'valid-palindrome',                                                difficulty: 'easy'   },
  { lcSlug: 'two-sum-ii-input-array-is-sorted',                               difficulty: 'medium' },
  { lcSlug: '3sum',                                                            difficulty: 'medium' },
  { lcSlug: 'container-with-most-water',                                       difficulty: 'medium' },
  { lcSlug: 'trapping-rain-water',                                             difficulty: 'hard'   },

  // Sliding Window (6)
  { lcSlug: 'best-time-to-buy-and-sell-stock',                                difficulty: 'easy'   },
  { lcSlug: 'longest-substring-without-repeating-characters',                  difficulty: 'medium' },
  { lcSlug: 'longest-repeating-character-replacement',                         difficulty: 'medium' },
  { lcSlug: 'permutation-in-string',                                           difficulty: 'medium' },
  { lcSlug: 'minimum-window-substring',                                        difficulty: 'hard'   },
  { lcSlug: 'sliding-window-maximum',                                          difficulty: 'hard'   },

  // Stack (7)
  { lcSlug: 'valid-parentheses',                                               difficulty: 'easy'   },
  { lcSlug: 'min-stack',                                                       difficulty: 'medium' },
  { lcSlug: 'evaluate-reverse-polish-notation',                                difficulty: 'medium' },
  { lcSlug: 'generate-parentheses',                                            difficulty: 'medium' },
  { lcSlug: 'daily-temperatures',                                              difficulty: 'medium' },
  { lcSlug: 'car-fleet',                                                       difficulty: 'medium' },
  { lcSlug: 'largest-rectangle-in-histogram',                                  difficulty: 'hard'   },

  // Binary Search (7)
  { lcSlug: 'binary-search',                                                   difficulty: 'easy'   },
  { lcSlug: 'search-a-2d-matrix',                                              difficulty: 'medium' },
  { lcSlug: 'koko-eating-bananas',                                             difficulty: 'medium' },
  { lcSlug: 'find-minimum-in-rotated-sorted-array',                            difficulty: 'medium' },
  { lcSlug: 'search-in-rotated-sorted-array',                                  difficulty: 'medium' },
  { lcSlug: 'time-based-key-value-store',                                      difficulty: 'medium' },
  { lcSlug: 'median-of-two-sorted-arrays',                                     difficulty: 'hard'   },

  // Linked List (11)
  { lcSlug: 'reverse-linked-list',                                             difficulty: 'easy'   },
  { lcSlug: 'merge-two-sorted-lists',                                          difficulty: 'easy'   },
  { lcSlug: 'reorder-list',                                                    difficulty: 'medium' },
  { lcSlug: 'remove-nth-node-from-end-of-list',                               difficulty: 'medium' },
  { lcSlug: 'copy-list-with-random-pointer',                                   difficulty: 'medium' },
  { lcSlug: 'add-two-numbers',                                                 difficulty: 'medium' },
  { lcSlug: 'linked-list-cycle',                                               difficulty: 'easy'   },
  { lcSlug: 'find-the-duplicate-number',                                       difficulty: 'medium' },
  { lcSlug: 'lru-cache',                                                       difficulty: 'medium' },
  { lcSlug: 'merge-k-sorted-lists',                                            difficulty: 'hard'   },
  { lcSlug: 'reverse-nodes-in-k-group',                                        difficulty: 'hard'   },

  // Trees (15)
  { lcSlug: 'invert-binary-tree',                                              difficulty: 'easy'   },
  { lcSlug: 'maximum-depth-of-binary-tree',                                    difficulty: 'easy'   },
  { lcSlug: 'diameter-of-binary-tree',                                         difficulty: 'easy'   },
  { lcSlug: 'balanced-binary-tree',                                            difficulty: 'easy'   },
  { lcSlug: 'same-tree',                                                       difficulty: 'easy'   },
  { lcSlug: 'subtree-of-another-tree',                                         difficulty: 'easy'   },
  { lcSlug: 'lowest-common-ancestor-of-a-binary-search-tree',                  difficulty: 'medium' },
  { lcSlug: 'binary-tree-level-order-traversal',                               difficulty: 'medium' },
  { lcSlug: 'binary-tree-right-side-view',                                     difficulty: 'medium' },
  { lcSlug: 'count-good-nodes-in-binary-tree',                                 difficulty: 'medium' },
  { lcSlug: 'validate-binary-search-tree',                                     difficulty: 'medium' },
  { lcSlug: 'kth-smallest-element-in-a-bst',                                   difficulty: 'medium' },
  { lcSlug: 'construct-binary-tree-from-preorder-and-inorder-traversal',        difficulty: 'medium' },
  { lcSlug: 'binary-tree-maximum-path-sum',                                    difficulty: 'hard'   },
  { lcSlug: 'serialize-and-deserialize-binary-tree',                           difficulty: 'hard'   },

  // Heap / Priority Queue (7)
  { lcSlug: 'kth-largest-element-in-a-stream',                                difficulty: 'easy'   },
  { lcSlug: 'last-stone-weight',                                               difficulty: 'easy'   },
  { lcSlug: 'k-closest-points-to-origin',                                      difficulty: 'medium' },
  { lcSlug: 'kth-largest-element-in-an-array',                                 difficulty: 'medium' },
  { lcSlug: 'task-scheduler',                                                  difficulty: 'medium' },
  { lcSlug: 'design-twitter',                                                  difficulty: 'medium' },
  { lcSlug: 'find-median-from-data-stream',                                    difficulty: 'hard'   },

  // Backtracking (9)
  { lcSlug: 'subsets',                                                         difficulty: 'medium' },
  { lcSlug: 'combination-sum',                                                 difficulty: 'medium' },
  { lcSlug: 'permutations',                                                    difficulty: 'medium' },
  { lcSlug: 'subsets-ii',                                                      difficulty: 'medium' },
  { lcSlug: 'combination-sum-ii',                                              difficulty: 'medium' },
  { lcSlug: 'word-search',                                                     difficulty: 'medium' },
  { lcSlug: 'palindrome-partitioning',                                         difficulty: 'medium' },
  { lcSlug: 'letter-combinations-of-a-phone-number',                           difficulty: 'medium' },
  { lcSlug: 'n-queens',                                                        difficulty: 'hard'   },

  // Tries (3)
  { lcSlug: 'implement-trie-prefix-tree',                                      difficulty: 'medium' },
  { lcSlug: 'design-add-and-search-words-data-structure',                       difficulty: 'medium' },
  { lcSlug: 'word-search-ii',                                                  difficulty: 'hard'   },

  // Graphs (13)
  { lcSlug: 'number-of-islands',                                               difficulty: 'medium' },
  { lcSlug: 'max-area-of-island',                                              difficulty: 'medium' },
  { lcSlug: 'clone-graph',                                                     difficulty: 'medium' },
  { lcSlug: 'walls-and-gates',                                                 difficulty: 'medium' },
  { lcSlug: 'rotting-oranges',                                                 difficulty: 'medium' },
  { lcSlug: 'pacific-atlantic-water-flow',                                     difficulty: 'medium' },
  { lcSlug: 'surrounded-regions',                                              difficulty: 'medium' },
  { lcSlug: 'course-schedule',                                                 difficulty: 'medium' },
  { lcSlug: 'course-schedule-ii',                                              difficulty: 'medium' },
  { lcSlug: 'graph-valid-tree',                                                difficulty: 'medium' },
  { lcSlug: 'number-of-connected-components-in-an-undirected-graph',           difficulty: 'medium' },
  { lcSlug: 'redundant-connection',                                            difficulty: 'medium' },
  { lcSlug: 'word-ladder',                                                     difficulty: 'hard'   },

  // Advanced Graphs (6)
  { lcSlug: 'reconstruct-itinerary',                                           difficulty: 'hard'   },
  { lcSlug: 'min-cost-to-connect-all-points',                                  difficulty: 'medium' },
  { lcSlug: 'network-delay-time',                                              difficulty: 'medium' },
  { lcSlug: 'swim-in-rising-water',                                            difficulty: 'hard'   },
  { lcSlug: 'alien-dictionary',                                                difficulty: 'hard'   },
  { lcSlug: 'cheapest-flights-within-k-stops',                                 difficulty: 'medium' },

  // 1D Dynamic Programming (12)
  { lcSlug: 'climbing-stairs',                                                 difficulty: 'easy'   },
  { lcSlug: 'min-cost-climbing-stairs',                                        difficulty: 'easy'   },
  { lcSlug: 'house-robber',                                                    difficulty: 'medium' },
  { lcSlug: 'house-robber-ii',                                                 difficulty: 'medium' },
  { lcSlug: 'longest-palindromic-substring',                                   difficulty: 'medium' },
  { lcSlug: 'palindromic-substrings',                                          difficulty: 'medium' },
  { lcSlug: 'decode-ways',                                                     difficulty: 'medium' },
  { lcSlug: 'coin-change',                                                     difficulty: 'medium' },
  { lcSlug: 'maximum-product-subarray',                                        difficulty: 'medium' },
  { lcSlug: 'word-break',                                                      difficulty: 'medium' },
  { lcSlug: 'longest-increasing-subsequence',                                  difficulty: 'medium' },
  { lcSlug: 'partition-equal-subset-sum',                                      difficulty: 'medium' },

  // 2D Dynamic Programming (11)
  { lcSlug: 'unique-paths',                                                    difficulty: 'medium' },
  { lcSlug: 'longest-common-subsequence',                                      difficulty: 'medium' },
  { lcSlug: 'best-time-to-buy-and-sell-stock-with-cooldown',                   difficulty: 'medium' },
  { lcSlug: 'coin-change-ii',                                                  difficulty: 'medium' },
  { lcSlug: 'target-sum',                                                      difficulty: 'medium' },
  { lcSlug: 'interleaving-string',                                             difficulty: 'medium' },
  { lcSlug: 'longest-increasing-path-in-a-matrix',                             difficulty: 'hard'   },
  { lcSlug: 'distinct-subsequences',                                           difficulty: 'hard'   },
  { lcSlug: 'edit-distance',                                                   difficulty: 'medium' },
  { lcSlug: 'burst-balloons',                                                  difficulty: 'hard'   },
  { lcSlug: 'regular-expression-matching',                                     difficulty: 'hard'   },

  // Greedy (8)
  { lcSlug: 'maximum-subarray',                                                difficulty: 'medium' },
  { lcSlug: 'jump-game',                                                       difficulty: 'medium' },
  { lcSlug: 'jump-game-ii',                                                    difficulty: 'medium' },
  { lcSlug: 'gas-station',                                                     difficulty: 'medium' },
  { lcSlug: 'hand-of-straights',                                               difficulty: 'medium' },
  { lcSlug: 'merge-triplets-to-form-target-triplet',                           difficulty: 'medium' },
  { lcSlug: 'partition-labels',                                                difficulty: 'medium' },
  { lcSlug: 'valid-parenthesis-string',                                        difficulty: 'medium' },

  // Intervals (6)
  { lcSlug: 'insert-interval',                                                 difficulty: 'medium' },
  { lcSlug: 'merge-intervals',                                                 difficulty: 'medium' },
  { lcSlug: 'non-overlapping-intervals',                                       difficulty: 'medium' },
  { lcSlug: 'meeting-rooms',                                                   difficulty: 'easy'   },
  { lcSlug: 'meeting-rooms-ii',                                                difficulty: 'medium' },
  { lcSlug: 'minimum-interval-to-include-each-query',                          difficulty: 'hard'   },

  // Math & Geometry (8)
  { lcSlug: 'rotate-image',                                                    difficulty: 'medium' },
  { lcSlug: 'spiral-matrix',                                                   difficulty: 'medium' },
  { lcSlug: 'set-matrix-zeroes',                                               difficulty: 'medium' },
  { lcSlug: 'happy-number',                                                    difficulty: 'easy'   },
  { lcSlug: 'plus-one',                                                        difficulty: 'easy'   },
  { lcSlug: 'powx-n',                                                          difficulty: 'medium' },
  { lcSlug: 'multiply-strings',                                                difficulty: 'medium' },
  { lcSlug: 'detect-squares',                                                  difficulty: 'medium' },

  // Bit Manipulation (7)
  { lcSlug: 'single-number',                                                   difficulty: 'easy'   },
  { lcSlug: 'number-of-1-bits',                                                difficulty: 'easy'   },
  { lcSlug: 'counting-bits',                                                   difficulty: 'easy'   },
  { lcSlug: 'reverse-bits',                                                    difficulty: 'easy'   },
  { lcSlug: 'missing-number',                                                  difficulty: 'easy'   },
  { lcSlug: 'sum-of-two-integers',                                             difficulty: 'medium' },
  { lcSlug: 'reverse-integer',                                                 difficulty: 'medium' },
]

const LC_PROBLEMS_MAP = new Map(NEETCODE_150_LC.map((p) => [p.lcSlug, p]))

export function detectLcProblem(urlSlug: string): LcProblem | null {
  return LC_PROBLEMS_MAP.get(urlSlug) ?? null
}
