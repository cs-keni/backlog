export type Difficulty = 'easy' | 'medium' | 'hard'

export interface NeetcodeProblem {
  slug: string
  title: string
  pattern: string
  difficulty: Difficulty
  url: string
}

export const PATTERNS = [
  'Arrays & Hashing',
  'Two Pointers',
  'Sliding Window',
  'Stack',
  'Binary Search',
  'Linked List',
  'Trees',
  'Heap / Priority Queue',
  'Backtracking',
  'Tries',
  'Graphs',
  'Advanced Graphs',
  '1D Dynamic Programming',
  '2D Dynamic Programming',
  'Greedy',
  'Intervals',
  'Math & Geometry',
  'Bit Manipulation',
] as const

export type Pattern = (typeof PATTERNS)[number]

export const NEETCODE_150: NeetcodeProblem[] = [
  // Arrays & Hashing (9)
  { slug: 'duplicate-integer',             title: 'Contains Duplicate',                             pattern: 'Arrays & Hashing',        difficulty: 'easy',   url: 'https://neetcode.io/problems/duplicate-integer' },
  { slug: 'valid-anagram',                 title: 'Valid Anagram',                                  pattern: 'Arrays & Hashing',        difficulty: 'easy',   url: 'https://neetcode.io/problems/valid-anagram' },
  { slug: 'two-sum',                       title: 'Two Sum',                                        pattern: 'Arrays & Hashing',        difficulty: 'easy',   url: 'https://neetcode.io/problems/two-sum' },
  { slug: 'anagram-groups',               title: 'Group Anagrams',                                  pattern: 'Arrays & Hashing',        difficulty: 'medium', url: 'https://neetcode.io/problems/anagram-groups' },
  { slug: 'top-k-elements-in-list',       title: 'Top K Frequent Elements',                         pattern: 'Arrays & Hashing',        difficulty: 'medium', url: 'https://neetcode.io/problems/top-k-elements-in-list' },
  { slug: 'products-of-array-discluding-self', title: 'Product of Array Except Self',              pattern: 'Arrays & Hashing',        difficulty: 'medium', url: 'https://neetcode.io/problems/products-of-array-discluding-self' },
  { slug: 'valid-sudoku',                  title: 'Valid Sudoku',                                   pattern: 'Arrays & Hashing',        difficulty: 'medium', url: 'https://neetcode.io/problems/valid-sudoku' },
  { slug: 'string-encode-and-decode',     title: 'Encode and Decode Strings',                       pattern: 'Arrays & Hashing',        difficulty: 'medium', url: 'https://neetcode.io/problems/string-encode-and-decode' },
  { slug: 'longest-consecutive-sequence', title: 'Longest Consecutive Sequence',                    pattern: 'Arrays & Hashing',        difficulty: 'medium', url: 'https://neetcode.io/problems/longest-consecutive-sequence' },

  // Two Pointers (5)
  { slug: 'is-palindrome',                title: 'Valid Palindrome',                                pattern: 'Two Pointers',            difficulty: 'easy',   url: 'https://neetcode.io/problems/is-palindrome' },
  { slug: 'two-integer-sum-ii',           title: 'Two Sum II - Input Array Is Sorted',              pattern: 'Two Pointers',            difficulty: 'medium', url: 'https://neetcode.io/problems/two-integer-sum-ii' },
  { slug: 'three-integer-sum',            title: '3Sum',                                            pattern: 'Two Pointers',            difficulty: 'medium', url: 'https://neetcode.io/problems/three-integer-sum' },
  { slug: 'max-water-container',          title: 'Container With Most Water',                       pattern: 'Two Pointers',            difficulty: 'medium', url: 'https://neetcode.io/problems/max-water-container' },
  { slug: 'trapping-rain-water',          title: 'Trapping Rain Water',                             pattern: 'Two Pointers',            difficulty: 'hard',   url: 'https://neetcode.io/problems/trapping-rain-water' },

  // Sliding Window (6)
  { slug: 'buy-and-sell-crypto',          title: 'Best Time to Buy and Sell Stock',                 pattern: 'Sliding Window',          difficulty: 'easy',   url: 'https://neetcode.io/problems/buy-and-sell-crypto' },
  { slug: 'longest-substring-without-duplicates', title: 'Longest Substring Without Repeating Characters', pattern: 'Sliding Window', difficulty: 'medium', url: 'https://neetcode.io/problems/longest-substring-without-duplicates' },
  { slug: 'longest-repeating-substring-with-replacement', title: 'Longest Repeating Character Replacement', pattern: 'Sliding Window', difficulty: 'medium', url: 'https://neetcode.io/problems/longest-repeating-substring-with-replacement' },
  { slug: 'permutation-string',           title: 'Permutation in String',                           pattern: 'Sliding Window',          difficulty: 'medium', url: 'https://neetcode.io/problems/permutation-string' },
  { slug: 'minimum-window-with-characters', title: 'Minimum Window Substring',                     pattern: 'Sliding Window',          difficulty: 'hard',   url: 'https://neetcode.io/problems/minimum-window-with-characters' },
  { slug: 'sliding-window-maximum',       title: 'Sliding Window Maximum',                          pattern: 'Sliding Window',          difficulty: 'hard',   url: 'https://neetcode.io/problems/sliding-window-maximum' },

  // Stack (7)
  { slug: 'validate-parentheses',         title: 'Valid Parentheses',                               pattern: 'Stack',                   difficulty: 'easy',   url: 'https://neetcode.io/problems/validate-parentheses' },
  { slug: 'minimum-stack',                title: 'Min Stack',                                       pattern: 'Stack',                   difficulty: 'medium', url: 'https://neetcode.io/problems/minimum-stack' },
  { slug: 'evaluate-reverse-polish-notation', title: 'Evaluate Reverse Polish Notation',           pattern: 'Stack',                   difficulty: 'medium', url: 'https://neetcode.io/problems/evaluate-reverse-polish-notation' },
  { slug: 'generate-parentheses',         title: 'Generate Parentheses',                            pattern: 'Stack',                   difficulty: 'medium', url: 'https://neetcode.io/problems/generate-parentheses' },
  { slug: 'daily-temperatures',           title: 'Daily Temperatures',                              pattern: 'Stack',                   difficulty: 'medium', url: 'https://neetcode.io/problems/daily-temperatures' },
  { slug: 'car-fleet',                    title: 'Car Fleet',                                       pattern: 'Stack',                   difficulty: 'medium', url: 'https://neetcode.io/problems/car-fleet' },
  { slug: 'largest-rectangle-in-histogram', title: 'Largest Rectangle in Histogram',               pattern: 'Stack',                   difficulty: 'hard',   url: 'https://neetcode.io/problems/largest-rectangle-in-histogram' },

  // Binary Search (7)
  { slug: 'binary-search',                title: 'Binary Search',                                   pattern: 'Binary Search',           difficulty: 'easy',   url: 'https://neetcode.io/problems/binary-search' },
  { slug: 'search-2d-matrix',             title: 'Search a 2D Matrix',                              pattern: 'Binary Search',           difficulty: 'medium', url: 'https://neetcode.io/problems/search-2d-matrix' },
  { slug: 'eating-bananas',               title: 'Koko Eating Bananas',                             pattern: 'Binary Search',           difficulty: 'medium', url: 'https://neetcode.io/problems/eating-bananas' },
  { slug: 'find-minimum-in-rotated-sorted-array', title: 'Find Minimum in Rotated Sorted Array',   pattern: 'Binary Search',           difficulty: 'medium', url: 'https://neetcode.io/problems/find-minimum-in-rotated-sorted-array' },
  { slug: 'find-target-in-rotated-sorted-array', title: 'Search in Rotated Sorted Array',          pattern: 'Binary Search',           difficulty: 'medium', url: 'https://neetcode.io/problems/find-target-in-rotated-sorted-array' },
  { slug: 'time-based-key-value-store',   title: 'Time Based Key-Value Store',                      pattern: 'Binary Search',           difficulty: 'medium', url: 'https://neetcode.io/problems/time-based-key-value-store' },
  { slug: 'median-of-two-sorted-arrays',  title: 'Median of Two Sorted Arrays',                     pattern: 'Binary Search',           difficulty: 'hard',   url: 'https://neetcode.io/problems/median-of-two-sorted-arrays' },

  // Linked List (11)
  { slug: 'reverse-a-linked-list',        title: 'Reverse Linked List',                             pattern: 'Linked List',             difficulty: 'easy',   url: 'https://neetcode.io/problems/reverse-a-linked-list' },
  { slug: 'merge-two-sorted-linked-lists', title: 'Merge Two Sorted Lists',                        pattern: 'Linked List',             difficulty: 'easy',   url: 'https://neetcode.io/problems/merge-two-sorted-linked-lists' },
  { slug: 'reorder-linked-list',          title: 'Reorder List',                                    pattern: 'Linked List',             difficulty: 'medium', url: 'https://neetcode.io/problems/reorder-linked-list' },
  { slug: 'remove-node-from-end-of-linked-list', title: 'Remove Nth Node From End of List',        pattern: 'Linked List',             difficulty: 'medium', url: 'https://neetcode.io/problems/remove-node-from-end-of-linked-list' },
  { slug: 'copy-linked-list-with-random-pointer', title: 'Copy List with Random Pointer',          pattern: 'Linked List',             difficulty: 'medium', url: 'https://neetcode.io/problems/copy-linked-list-with-random-pointer' },
  { slug: 'add-two-numbers',              title: 'Add Two Numbers',                                 pattern: 'Linked List',             difficulty: 'medium', url: 'https://neetcode.io/problems/add-two-numbers' },
  { slug: 'linked-list-cycle-detection',  title: 'Linked List Cycle',                               pattern: 'Linked List',             difficulty: 'easy',   url: 'https://neetcode.io/problems/linked-list-cycle-detection' },
  { slug: 'find-duplicate-integer',       title: 'Find the Duplicate Number',                       pattern: 'Linked List',             difficulty: 'medium', url: 'https://neetcode.io/problems/find-duplicate-integer' },
  { slug: 'lru-cache',                    title: 'LRU Cache',                                       pattern: 'Linked List',             difficulty: 'medium', url: 'https://neetcode.io/problems/lru-cache' },
  { slug: 'merge-k-sorted-linked-lists',  title: 'Merge K Sorted Lists',                            pattern: 'Linked List',             difficulty: 'hard',   url: 'https://neetcode.io/problems/merge-k-sorted-linked-lists' },
  { slug: 'reverse-nodes-in-k-group',     title: 'Reverse Nodes in K-Group',                        pattern: 'Linked List',             difficulty: 'hard',   url: 'https://neetcode.io/problems/reverse-nodes-in-k-group' },

  // Trees (15)
  { slug: 'invert-a-binary-tree',         title: 'Invert Binary Tree',                              pattern: 'Trees',                   difficulty: 'easy',   url: 'https://neetcode.io/problems/invert-a-binary-tree' },
  { slug: 'depth-of-binary-tree',         title: 'Maximum Depth of Binary Tree',                    pattern: 'Trees',                   difficulty: 'easy',   url: 'https://neetcode.io/problems/depth-of-binary-tree' },
  { slug: 'binary-tree-diameter',         title: 'Diameter of Binary Tree',                         pattern: 'Trees',                   difficulty: 'easy',   url: 'https://neetcode.io/problems/binary-tree-diameter' },
  { slug: 'balanced-binary-tree',         title: 'Balanced Binary Tree',                            pattern: 'Trees',                   difficulty: 'easy',   url: 'https://neetcode.io/problems/balanced-binary-tree' },
  { slug: 'same-binary-tree',             title: 'Same Tree',                                       pattern: 'Trees',                   difficulty: 'easy',   url: 'https://neetcode.io/problems/same-binary-tree' },
  { slug: 'subtree-of-a-binary-tree',     title: 'Subtree of Another Tree',                         pattern: 'Trees',                   difficulty: 'easy',   url: 'https://neetcode.io/problems/subtree-of-a-binary-tree' },
  { slug: 'lowest-common-ancestor-in-binary-search-tree', title: 'Lowest Common Ancestor of a BST', pattern: 'Trees',                  difficulty: 'medium', url: 'https://neetcode.io/problems/lowest-common-ancestor-in-binary-search-tree' },
  { slug: 'level-order-traversal-of-binary-tree', title: 'Binary Tree Level Order Traversal',       pattern: 'Trees',                   difficulty: 'medium', url: 'https://neetcode.io/problems/level-order-traversal-of-binary-tree' },
  { slug: 'binary-tree-right-side-view',  title: 'Binary Tree Right Side View',                     pattern: 'Trees',                   difficulty: 'medium', url: 'https://neetcode.io/problems/binary-tree-right-side-view' },
  { slug: 'count-good-nodes-in-binary-tree', title: 'Count Good Nodes in Binary Tree',              pattern: 'Trees',                   difficulty: 'medium', url: 'https://neetcode.io/problems/count-good-nodes-in-binary-tree' },
  { slug: 'valid-binary-search-tree',     title: 'Validate Binary Search Tree',                     pattern: 'Trees',                   difficulty: 'medium', url: 'https://neetcode.io/problems/valid-binary-search-tree' },
  { slug: 'kth-smallest-integer-in-bst',  title: 'Kth Smallest Element in a BST',                   pattern: 'Trees',                   difficulty: 'medium', url: 'https://neetcode.io/problems/kth-smallest-integer-in-bst' },
  { slug: 'binary-tree-from-preorder-and-inorder-traversal', title: 'Construct Binary Tree from Preorder and Inorder Traversal', pattern: 'Trees', difficulty: 'medium', url: 'https://neetcode.io/problems/binary-tree-from-preorder-and-inorder-traversal' },
  { slug: 'binary-tree-maximum-path-sum', title: 'Binary Tree Maximum Path Sum',                    pattern: 'Trees',                   difficulty: 'hard',   url: 'https://neetcode.io/problems/binary-tree-maximum-path-sum' },
  { slug: 'serialize-and-deserialize-binary-tree', title: 'Serialize and Deserialize Binary Tree',  pattern: 'Trees',                   difficulty: 'hard',   url: 'https://neetcode.io/problems/serialize-and-deserialize-binary-tree' },

  // Heap / Priority Queue (7)
  { slug: 'kth-largest-integer-in-a-stream', title: 'Kth Largest Element in a Stream',             pattern: 'Heap / Priority Queue',   difficulty: 'easy',   url: 'https://neetcode.io/problems/kth-largest-integer-in-a-stream' },
  { slug: 'last-stone-weight',            title: 'Last Stone Weight',                               pattern: 'Heap / Priority Queue',   difficulty: 'easy',   url: 'https://neetcode.io/problems/last-stone-weight' },
  { slug: 'k-closest-points-to-origin',   title: 'K Closest Points to Origin',                      pattern: 'Heap / Priority Queue',   difficulty: 'medium', url: 'https://neetcode.io/problems/k-closest-points-to-origin' },
  { slug: 'kth-largest-element-in-an-array', title: 'Kth Largest Element in an Array',             pattern: 'Heap / Priority Queue',   difficulty: 'medium', url: 'https://neetcode.io/problems/kth-largest-element-in-an-array' },
  { slug: 'task-scheduling',              title: 'Task Scheduler',                                  pattern: 'Heap / Priority Queue',   difficulty: 'medium', url: 'https://neetcode.io/problems/task-scheduling' },
  { slug: 'design-twitter-feed',          title: 'Design Twitter',                                  pattern: 'Heap / Priority Queue',   difficulty: 'medium', url: 'https://neetcode.io/problems/design-twitter-feed' },
  { slug: 'find-median-in-a-data-stream', title: 'Find Median from Data Stream',                    pattern: 'Heap / Priority Queue',   difficulty: 'hard',   url: 'https://neetcode.io/problems/find-median-in-a-data-stream' },

  // Backtracking (9)
  { slug: 'subsets',                      title: 'Subsets',                                         pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/subsets' },
  { slug: 'combination-target-sum',       title: 'Combination Sum',                                 pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/combination-target-sum' },
  { slug: 'permutations',                 title: 'Permutations',                                    pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/permutations' },
  { slug: 'subsets-ii',                   title: 'Subsets II',                                      pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/subsets-ii' },
  { slug: 'combination-sum-ii',           title: 'Combination Sum II',                              pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/combination-sum-ii' },
  { slug: 'search-for-word',              title: 'Word Search',                                     pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/search-for-word' },
  { slug: 'palindrome-partitioning',      title: 'Palindrome Partitioning',                         pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/palindrome-partitioning' },
  { slug: 'combinations-of-a-phone-number', title: 'Letter Combinations of a Phone Number',        pattern: 'Backtracking',            difficulty: 'medium', url: 'https://neetcode.io/problems/combinations-of-a-phone-number' },
  { slug: 'n-queens',                     title: 'N-Queens',                                        pattern: 'Backtracking',            difficulty: 'hard',   url: 'https://neetcode.io/problems/n-queens' },

  // Tries (3)
  { slug: 'implement-prefix-tree',        title: 'Implement Trie (Prefix Tree)',                    pattern: 'Tries',                   difficulty: 'medium', url: 'https://neetcode.io/problems/implement-prefix-tree' },
  { slug: 'design-word-search-data-structure', title: 'Design Add and Search Words Data Structure', pattern: 'Tries',                  difficulty: 'medium', url: 'https://neetcode.io/problems/design-word-search-data-structure' },
  { slug: 'search-for-word-ii',           title: 'Word Search II',                                  pattern: 'Tries',                   difficulty: 'hard',   url: 'https://neetcode.io/problems/search-for-word-ii' },

  // Graphs (13)
  { slug: 'count-number-of-islands',      title: 'Number of Islands',                               pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/count-number-of-islands' },
  { slug: 'max-area-of-island',           title: 'Max Area of Island',                              pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/max-area-of-island' },
  { slug: 'clone-graph',                  title: 'Clone Graph',                                     pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/clone-graph' },
  { slug: 'islands-and-treasure',         title: 'Walls and Gates',                                 pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/islands-and-treasure' },
  { slug: 'rotting-fruit',                title: 'Rotting Oranges',                                 pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/rotting-fruit' },
  { slug: 'pacific-atlantic-water-flow',  title: 'Pacific Atlantic Water Flow',                     pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/pacific-atlantic-water-flow' },
  { slug: 'surrounded-regions',           title: 'Surrounded Regions',                              pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/surrounded-regions' },
  { slug: 'course-schedule',              title: 'Course Schedule',                                 pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/course-schedule' },
  { slug: 'course-schedule-ii',           title: 'Course Schedule II',                              pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/course-schedule-ii' },
  { slug: 'valid-tree',                   title: 'Graph Valid Tree',                                pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/valid-tree' },
  { slug: 'count-connected-components',   title: 'Number of Connected Components in an Undirected Graph', pattern: 'Graphs',           difficulty: 'medium', url: 'https://neetcode.io/problems/count-connected-components' },
  { slug: 'redundant-connection',         title: 'Redundant Connection',                            pattern: 'Graphs',                  difficulty: 'medium', url: 'https://neetcode.io/problems/redundant-connection' },
  { slug: 'word-ladder',                  title: 'Word Ladder',                                     pattern: 'Graphs',                  difficulty: 'hard',   url: 'https://neetcode.io/problems/word-ladder' },

  // Advanced Graphs (6)
  { slug: 'reconstruct-flight-path',      title: 'Reconstruct Itinerary',                           pattern: 'Advanced Graphs',         difficulty: 'hard',   url: 'https://neetcode.io/problems/reconstruct-flight-path' },
  { slug: 'min-cost-to-connect-points',   title: 'Min Cost to Connect All Points',                  pattern: 'Advanced Graphs',         difficulty: 'medium', url: 'https://neetcode.io/problems/min-cost-to-connect-points' },
  { slug: 'network-delay-time',           title: 'Network Delay Time',                              pattern: 'Advanced Graphs',         difficulty: 'medium', url: 'https://neetcode.io/problems/network-delay-time' },
  { slug: 'swim-in-rising-water',         title: 'Swim in Rising Water',                            pattern: 'Advanced Graphs',         difficulty: 'hard',   url: 'https://neetcode.io/problems/swim-in-rising-water' },
  { slug: 'foreign-dictionary',           title: 'Alien Dictionary',                                pattern: 'Advanced Graphs',         difficulty: 'hard',   url: 'https://neetcode.io/problems/foreign-dictionary' },
  { slug: 'cheapest-flight-path',         title: 'Cheapest Flights Within K Stops',                 pattern: 'Advanced Graphs',         difficulty: 'medium', url: 'https://neetcode.io/problems/cheapest-flight-path' },

  // 1D Dynamic Programming (12)
  { slug: 'climbing-stairs',              title: 'Climbing Stairs',                                 pattern: '1D Dynamic Programming',  difficulty: 'easy',   url: 'https://neetcode.io/problems/climbing-stairs' },
  { slug: 'min-cost-climbing-stairs',     title: 'Min Cost Climbing Stairs',                        pattern: '1D Dynamic Programming',  difficulty: 'easy',   url: 'https://neetcode.io/problems/min-cost-climbing-stairs' },
  { slug: 'house-robber',                 title: 'House Robber',                                    pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/house-robber' },
  { slug: 'house-robber-ii',              title: 'House Robber II',                                 pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/house-robber-ii' },
  { slug: 'longest-palindromic-substring', title: 'Longest Palindromic Substring',                 pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/longest-palindromic-substring' },
  { slug: 'palindromic-substrings',       title: 'Palindromic Substrings',                          pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/palindromic-substrings' },
  { slug: 'decode-ways',                  title: 'Decode Ways',                                     pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/decode-ways' },
  { slug: 'coin-change',                  title: 'Coin Change',                                     pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/coin-change' },
  { slug: 'maximum-product-subarray',     title: 'Maximum Product Subarray',                        pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/maximum-product-subarray' },
  { slug: 'word-break',                   title: 'Word Break',                                      pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/word-break' },
  { slug: 'longest-increasing-subsequence', title: 'Longest Increasing Subsequence',               pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/longest-increasing-subsequence' },
  { slug: 'partition-equal-subset-sum',   title: 'Partition Equal Subset Sum',                      pattern: '1D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/partition-equal-subset-sum' },

  // 2D Dynamic Programming (11)
  { slug: 'count-paths',                  title: 'Unique Paths',                                    pattern: '2D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/count-paths' },
  { slug: 'longest-common-subsequence',   title: 'Longest Common Subsequence',                      pattern: '2D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/longest-common-subsequence' },
  { slug: 'buy-and-sell-stock-with-cooldown', title: 'Best Time to Buy and Sell Stock with Cooldown', pattern: '2D Dynamic Programming', difficulty: 'medium', url: 'https://neetcode.io/problems/buy-and-sell-stock-with-cooldown' },
  { slug: 'coin-change-ii',               title: 'Coin Change II',                                  pattern: '2D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/coin-change-ii' },
  { slug: 'target-sum',                   title: 'Target Sum',                                      pattern: '2D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/target-sum' },
  { slug: 'interleaving-string',          title: 'Interleaving String',                             pattern: '2D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/interleaving-string' },
  { slug: 'longest-increasing-path-in-matrix', title: 'Longest Increasing Path in a Matrix',       pattern: '2D Dynamic Programming',  difficulty: 'hard',   url: 'https://neetcode.io/problems/longest-increasing-path-in-matrix' },
  { slug: 'distinct-subsequences',        title: 'Distinct Subsequences',                           pattern: '2D Dynamic Programming',  difficulty: 'hard',   url: 'https://neetcode.io/problems/distinct-subsequences' },
  { slug: 'edit-distance',                title: 'Edit Distance',                                   pattern: '2D Dynamic Programming',  difficulty: 'medium', url: 'https://neetcode.io/problems/edit-distance' },
  { slug: 'burst-balloons',               title: 'Burst Balloons',                                  pattern: '2D Dynamic Programming',  difficulty: 'hard',   url: 'https://neetcode.io/problems/burst-balloons' },
  { slug: 'regular-expression-matching',  title: 'Regular Expression Matching',                     pattern: '2D Dynamic Programming',  difficulty: 'hard',   url: 'https://neetcode.io/problems/regular-expression-matching' },

  // Greedy (8)
  { slug: 'maximum-subarray',             title: 'Maximum Subarray',                                pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/maximum-subarray' },
  { slug: 'jump-game',                    title: 'Jump Game',                                       pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/jump-game' },
  { slug: 'jump-game-ii',                 title: 'Jump Game II',                                    pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/jump-game-ii' },
  { slug: 'gas-station',                  title: 'Gas Station',                                     pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/gas-station' },
  { slug: 'hand-of-straights',            title: 'Hand of Straights',                               pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/hand-of-straights' },
  { slug: 'merge-triplets-to-form-target', title: 'Merge Triplets to Form Target Triplet',          pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/merge-triplets-to-form-target' },
  { slug: 'partition-labels',             title: 'Partition Labels',                                pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/partition-labels' },
  { slug: 'valid-parenthesis-string',     title: 'Valid Parenthesis String',                        pattern: 'Greedy',                  difficulty: 'medium', url: 'https://neetcode.io/problems/valid-parenthesis-string' },

  // Intervals (6)
  { slug: 'insert-new-interval',          title: 'Insert Interval',                                 pattern: 'Intervals',               difficulty: 'medium', url: 'https://neetcode.io/problems/insert-new-interval' },
  { slug: 'merge-intervals',              title: 'Merge Intervals',                                 pattern: 'Intervals',               difficulty: 'medium', url: 'https://neetcode.io/problems/merge-intervals' },
  { slug: 'non-overlapping-intervals',    title: 'Non-Overlapping Intervals',                       pattern: 'Intervals',               difficulty: 'medium', url: 'https://neetcode.io/problems/non-overlapping-intervals' },
  { slug: 'meeting-schedule',             title: 'Meeting Rooms',                                   pattern: 'Intervals',               difficulty: 'easy',   url: 'https://neetcode.io/problems/meeting-schedule' },
  { slug: 'meeting-schedule-ii',          title: 'Meeting Rooms II',                                pattern: 'Intervals',               difficulty: 'medium', url: 'https://neetcode.io/problems/meeting-schedule-ii' },
  { slug: 'minimum-interval-including-query', title: 'Minimum Interval to Include Each Query',     pattern: 'Intervals',               difficulty: 'hard',   url: 'https://neetcode.io/problems/minimum-interval-including-query' },

  // Math & Geometry (8)
  { slug: 'rotate-matrix',                title: 'Rotate Image',                                    pattern: 'Math & Geometry',         difficulty: 'medium', url: 'https://neetcode.io/problems/rotate-matrix' },
  { slug: 'spiral-matrix',                title: 'Spiral Matrix',                                   pattern: 'Math & Geometry',         difficulty: 'medium', url: 'https://neetcode.io/problems/spiral-matrix' },
  { slug: 'zero-matrix',                  title: 'Set Matrix Zeroes',                               pattern: 'Math & Geometry',         difficulty: 'medium', url: 'https://neetcode.io/problems/zero-matrix' },
  { slug: 'non-cyclical-number',          title: 'Happy Number',                                    pattern: 'Math & Geometry',         difficulty: 'easy',   url: 'https://neetcode.io/problems/non-cyclical-number' },
  { slug: 'plus-one',                     title: 'Plus One',                                        pattern: 'Math & Geometry',         difficulty: 'easy',   url: 'https://neetcode.io/problems/plus-one' },
  { slug: 'pow-x-n',                      title: 'Pow(x, n)',                                       pattern: 'Math & Geometry',         difficulty: 'medium', url: 'https://neetcode.io/problems/pow-x-n' },
  { slug: 'multiply-strings',             title: 'Multiply Strings',                                pattern: 'Math & Geometry',         difficulty: 'medium', url: 'https://neetcode.io/problems/multiply-strings' },
  { slug: 'count-squares',                title: 'Detect Squares',                                  pattern: 'Math & Geometry',         difficulty: 'medium', url: 'https://neetcode.io/problems/count-squares' },

  // Bit Manipulation (7)
  { slug: 'single-number',                title: 'Single Number',                                   pattern: 'Bit Manipulation',        difficulty: 'easy',   url: 'https://neetcode.io/problems/single-number' },
  { slug: 'number-of-one-bits',           title: 'Number of 1 Bits',                                pattern: 'Bit Manipulation',        difficulty: 'easy',   url: 'https://neetcode.io/problems/number-of-one-bits' },
  { slug: 'counting-bits',                title: 'Counting Bits',                                   pattern: 'Bit Manipulation',        difficulty: 'easy',   url: 'https://neetcode.io/problems/counting-bits' },
  { slug: 'reverse-bits',                 title: 'Reverse Bits',                                    pattern: 'Bit Manipulation',        difficulty: 'easy',   url: 'https://neetcode.io/problems/reverse-bits' },
  { slug: 'missing-number',               title: 'Missing Number',                                  pattern: 'Bit Manipulation',        difficulty: 'easy',   url: 'https://neetcode.io/problems/missing-number' },
  { slug: 'sum-of-two-integers',          title: 'Sum of Two Integers',                             pattern: 'Bit Manipulation',        difficulty: 'medium', url: 'https://neetcode.io/problems/sum-of-two-integers' },
  { slug: 'reverse-integer',              title: 'Reverse Integer',                                 pattern: 'Bit Manipulation',        difficulty: 'medium', url: 'https://neetcode.io/problems/reverse-integer' },
]
