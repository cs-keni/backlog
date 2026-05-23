import { z } from 'zod'

export const ProblemHintsSchema = z.object({
  slug: z.string().min(1),
  layer1: z.string().min(1),
  layer2: z.object({
    python: z.string().min(1),
    java: z.string().min(1),
    js: z.string().min(1),
    description: z.string().min(1),
  }),
  layer3: z.object({
    algorithm: z.string().min(1),
    timeComplexity: z.string().min(1),
    spaceComplexity: z.string().min(1),
  }),
  layer4: z.string().min(1),
})

export type ProblemHints = z.infer<typeof ProblemHintsSchema>

// Hints keyed by LeetCode URL slug (e.g. 'two-sum', 'contains-duplicate').
// Phase 1 ships with 20 hints — one per pattern (18) + 2 extra for Arrays & Hashing and Linked List.
// Remaining 130 problems tracked in TODOS.md.
export const HINTS: ProblemHints[] = [
  // Arrays & Hashing
  {
    slug: 'two-sum',
    layer1: 'Arrays & Hashing',
    layer2: {
      python: 'dict',
      java: 'HashMap<Integer, Integer>',
      js: 'new Map()',
      description: 'complement lookup — store what you\'ve seen so far',
    },
    layer3: {
      algorithm: 'single-pass hash map',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    layer4: 'for each num at i:\n  if target - num in seen: return [seen[target-num], i]\n  seen[num] = i',
  },
  {
    slug: 'contains-duplicate',
    layer1: 'Arrays & Hashing',
    layer2: {
      python: 'set()',
      java: 'HashSet<Integer>',
      js: 'new Set()',
      description: 'membership check — insert each element; duplicate if already present',
    },
    layer3: {
      algorithm: 'hash set membership check',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    layer4: 'seen = set()\nfor n in nums:\n  if n in seen: return True\n  seen.add(n)\nreturn False',
  },
  // Two Pointers
  {
    slug: 'valid-palindrome',
    layer1: 'Two Pointers',
    layer2: {
      python: 'str.isalnum() + str.lower()',
      java: 'Character.isLetterOrDigit() + toLowerCase()',
      js: '/[a-z0-9]/i.test(c)',
      description: 'two-pointer converge from both ends, skip non-alphanumeric',
    },
    layer3: {
      algorithm: 'left/right pointer converge',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'l, r = 0, len-1\nwhile l < r:\n  skip non-alphanumeric on both ends\n  if s[l].lower() != s[r].lower(): return False\n  l++, r--',
  },
  // Sliding Window
  {
    slug: 'best-time-to-buy-and-sell-stock',
    layer1: 'Sliding Window',
    layer2: {
      python: 'min_price = float("inf")',
      java: 'int minPrice = Integer.MAX_VALUE',
      js: 'let minPrice = Infinity',
      description: 'track running minimum buy price; update max profit on each day',
    },
    layer3: {
      algorithm: 'one-pass greedy min tracking',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'min_price = inf, profit = 0\nfor price in prices:\n  min_price = min(min_price, price)\n  profit = max(profit, price - min_price)',
  },
  // Stack
  {
    slug: 'valid-parentheses',
    layer1: 'Stack',
    layer2: {
      python: 'list used as stack, push/pop',
      java: 'Deque<Character> / ArrayDeque',
      js: 'array .push() / .pop()',
      description: 'push opening brackets; on closing, match and pop — if mismatch return false',
    },
    layer3: {
      algorithm: 'match-and-pop bracket validator',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(n)',
    },
    layer4: 'for c in s:\n  if opening: stack.push(c)\n  elif stack empty or top doesn\'t match: return False\n  else: stack.pop()\nreturn stack empty',
  },
  // Binary Search
  {
    slug: 'binary-search',
    layer1: 'Binary Search',
    layer2: {
      python: 'lo, hi = 0, len(nums) - 1',
      java: 'int lo = 0, hi = nums.length - 1',
      js: 'let lo = 0, hi = nums.length - 1',
      description: 'halve the search space each step based on midpoint comparison',
    },
    layer3: {
      algorithm: 'iterative halving',
      timeComplexity: 'O(log n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'while lo <= hi:\n  mid = (lo + hi) // 2\n  if nums[mid] == target: return mid\n  elif nums[mid] < target: lo = mid + 1\n  else: hi = mid - 1',
  },
  // Linked List
  {
    slug: 'reverse-linked-list',
    layer1: 'Linked List',
    layer2: {
      python: 'prev, curr = None, head',
      java: 'ListNode prev = null, curr = head',
      js: 'let prev = null, curr = head',
      description: 'three-pointer reversal — reroute each node\'s .next pointer backward',
    },
    layer3: {
      algorithm: 'iterative pointer reversal',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'prev = None\nwhile curr:\n  nxt = curr.next\n  curr.next = prev\n  prev = curr\n  curr = nxt\nreturn prev',
  },
  {
    slug: 'merge-two-sorted-lists',
    layer1: 'Linked List',
    layer2: {
      python: 'dummy = ListNode(0); curr = dummy',
      java: 'ListNode dummy = new ListNode(0)',
      js: 'const dummy = new ListNode(0)',
      description: 'dummy head + pointer — compare heads of both lists, attach smaller',
    },
    layer3: {
      algorithm: 'iterative merge with dummy head',
      timeComplexity: 'O(m + n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'dummy = ListNode(); cur = dummy\nwhile l1 and l2:\n  if l1.val <= l2.val: cur.next = l1; l1 = l1.next\n  else: cur.next = l2; l2 = l2.next\n  cur = cur.next\ncur.next = l1 or l2',
  },
  // Trees
  {
    slug: 'invert-binary-tree',
    layer1: 'Trees',
    layer2: {
      python: 'node.left, node.right = invert(node.right), invert(node.left)',
      java: 'TreeNode temp = node.left; node.left = invert(node.right)',
      js: 'const temp = node.left; node.left = invert(node.right)',
      description: 'swap left and right children recursively at every node',
    },
    layer3: {
      algorithm: 'DFS post-order swap',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(h) call stack',
    },
    layer4: 'def invert(node):\n  if not node: return None\n  node.left, node.right = invert(node.right), invert(node.left)\n  return node',
  },
  // Heap / Priority Queue
  {
    slug: 'kth-largest-element-in-a-stream',
    layer1: 'Heap / Priority Queue',
    layer2: {
      python: 'heapq (min-heap, size k)',
      java: 'PriorityQueue<Integer> (min-heap)',
      js: 'manual min-heap (no built-in)',
      description: 'min-heap of size k — the root is always the kth largest element',
    },
    layer3: {
      algorithm: 'bounded min-heap of size k',
      timeComplexity: 'O(log k) per add',
      spaceComplexity: 'O(k)',
    },
    layer4: 'init: heappush all nums; heappop until len == k\nadd(val): heappush(val)\n  if len > k: heappop()\n  return heap[0]',
  },
  // Backtracking
  {
    slug: 'subsets',
    layer1: 'Backtracking',
    layer2: {
      python: 'result = []; backtrack(start, path)',
      java: 'List<List<Integer>> res = new ArrayList<>()',
      js: 'const res = []; backtrack(start, path)',
      description: 'include or exclude each element — decision tree yields 2^n subsets',
    },
    layer3: {
      algorithm: 'DFS include/exclude decision tree',
      timeComplexity: 'O(n × 2^n)',
      spaceComplexity: 'O(n) stack depth',
    },
    layer4: 'res.append(path.copy())  # always add current subset\nfor i in range(start, len(nums)):\n  path.append(nums[i])\n  backtrack(i + 1, path)\n  path.pop()',
  },
  // Tries
  {
    slug: 'implement-trie-prefix-tree',
    layer1: 'Tries',
    layer2: {
      python: 'dict of dicts + is_end flag',
      java: 'TrieNode with children[26] + isEnd',
      js: 'object map as children + isEnd',
      description: 'each node stores a children map and an isEnd flag',
    },
    layer3: {
      algorithm: 'insert/search by walking character-by-character',
      timeComplexity: 'O(m) per op',
      spaceComplexity: 'O(m × n) total',
    },
    layer4: 'insert: cur = root\nfor c in word:\n  if c not in cur.children: cur.children[c] = TrieNode()\n  cur = cur.children[c]\ncur.is_end = True',
  },
  // Graphs
  {
    slug: 'number-of-islands',
    layer1: 'Graphs',
    layer2: {
      python: 'DFS flood-fill, mark visited in-place',
      java: 'DFS with visited boolean[][] or in-place \'0\' marking',
      js: 'DFS, mark visited in-place',
      description: 'flood-fill — mark all connected \'1\'s as visited; count each flood start',
    },
    layer3: {
      algorithm: 'DFS flood fill',
      timeComplexity: 'O(m × n)',
      spaceComplexity: 'O(m × n) stack',
    },
    layer4: 'count = 0\nfor each cell (r, c) with grid[r][c] == \'1\':\n  count += 1\n  DFS to mark all connected \'1\'s as \'0\'',
  },
  // Advanced Graphs
  {
    slug: 'min-cost-to-connect-all-points',
    layer1: 'Advanced Graphs',
    layer2: {
      python: 'heapq for Prim\'s MST',
      java: 'PriorityQueue for Prim\'s',
      js: 'min-heap priority queue',
      description: 'Prim\'s MST — greedily add the minimum-cost edge to an unvisited node',
    },
    layer3: {
      algorithm: 'Prim\'s MST with min-heap',
      timeComplexity: 'O(n² log n)',
      spaceComplexity: 'O(n)',
    },
    layer4: 'visited = set(); heap = [(0, 0)]; total = 0\nwhile len(visited) < n:\n  cost, i = heappop(heap)\n  if i in visited: continue\n  visited.add(i); total += cost\n  push all neighbors with Manhattan distance',
  },
  // 1D Dynamic Programming
  {
    slug: 'climbing-stairs',
    layer1: '1D Dynamic Programming',
    layer2: {
      python: 'a, b = 1, 1 (two variables)',
      java: 'int a = 1, b = 1',
      js: 'let a = 1, b = 1',
      description: 'each step = ways to reach step-1 + ways to reach step-2 (Fibonacci)',
    },
    layer3: {
      algorithm: 'bottom-up Fibonacci DP',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'a, b = 1, 1\nfor _ in range(n - 1):\n  a, b = b, a + b\nreturn b',
  },
  // 2D Dynamic Programming
  {
    slug: 'unique-paths',
    layer1: '2D Dynamic Programming',
    layer2: {
      python: 'dp[r][c] = dp[r-1][c] + dp[r][c-1]',
      java: 'int[][] dp = new int[m][n]',
      js: 'const dp = Array.from({length: m}, () => new Array(n).fill(0))',
      description: 'paths to each cell = paths from above + paths from left',
    },
    layer3: {
      algorithm: 'bottom-up 2D grid DP',
      timeComplexity: 'O(m × n)',
      spaceComplexity: 'O(n) with space optimization',
    },
    layer4: 'dp[0][*] = 1, dp[*][0] = 1\nfor r in 1..m, c in 1..n:\n  dp[r][c] = dp[r-1][c] + dp[r][c-1]\nreturn dp[m-1][n-1]',
  },
  // Greedy
  {
    slug: 'maximum-subarray',
    layer1: 'Greedy',
    layer2: {
      python: 'curr_sum = 0, max_sum = nums[0]',
      java: 'int curr = 0, max = nums[0]',
      js: 'let curr = 0, max = nums[0]',
      description: 'Kadane\'s — reset running sum to 0 whenever it goes negative',
    },
    layer3: {
      algorithm: 'Kadane\'s algorithm',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'for n in nums:\n  curr = max(n, curr + n)\n  max_sum = max(max_sum, curr)',
  },
  // Intervals
  {
    slug: 'meeting-rooms',
    layer1: 'Intervals',
    layer2: {
      python: 'sorted(intervals, key=lambda x: x[0])',
      java: 'Arrays.sort(intervals, (a, b) -> a[0] - b[0])',
      js: 'intervals.sort((a, b) => a[0] - b[0])',
      description: 'sort by start time; any overlap means you can\'t attend all meetings',
    },
    layer3: {
      algorithm: 'sort + adjacent overlap check',
      timeComplexity: 'O(n log n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'sort by start time\nfor i in 1..n:\n  if intervals[i][0] < intervals[i-1][1]: return False\nreturn True',
  },
  // Math & Geometry
  {
    slug: 'rotate-image',
    layer1: 'Math & Geometry',
    layer2: {
      python: 'zip(*matrix[::-1]) (one-liner)',
      java: 'nested loop: transpose then reverse rows',
      js: 'matrix[0].map((_, i) => matrix.map(row => row[i]).reverse())',
      description: 'clockwise 90° = transpose the matrix, then reverse each row',
    },
    layer3: {
      algorithm: 'transpose then horizontal flip',
      timeComplexity: 'O(n²)',
      spaceComplexity: 'O(1)',
    },
    layer4: '# Transpose\nfor i, j where i < j:\n  matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]\n# Reverse each row\nfor row in matrix: row.reverse()',
  },
  // Bit Manipulation
  {
    slug: 'single-number',
    layer1: 'Bit Manipulation',
    layer2: {
      python: 'result = 0; XOR all nums',
      java: 'int result = 0; for n: result ^= n',
      js: 'let result = 0; for (const n of nums) result ^= n',
      description: 'XOR all numbers — pairs cancel out (n ^ n = 0), lone number survives',
    },
    layer3: {
      algorithm: 'XOR cancellation',
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    },
    layer4: 'result = 0\nfor n in nums: result ^= n\nreturn result',
  },
]

const HINTS_MAP = new Map(HINTS.map((h) => [h.slug, h]))

export function getHints(slug: string): ProblemHints | undefined {
  return HINTS_MAP.get(slug)
}
