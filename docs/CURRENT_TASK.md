# Current Task

**Last updated:** 2026-05-22
**Status:** SD-P1 through SD-P5 implemented by Codex; checks passed.

---

## Context: where we are

Wave 3 (Outcome Engine) + Quality Wave 4 + post-QW4 fixes are complete. 241 tests passing. Grade ~92/100.

**All migrations 028–035 still need to be applied in Supabase before production use of Wave 2/3 features.**

A full CEO + engineering review of the Interview Prep Expansion has been completed. The plan is locked and ready for implementation. See full plan at:

```
~/.gstack/projects/cs-keni-backlog/ceo-plans/2026-05-22-interview-prep-expansion.md
```

---

## Active Task: Interview Prep Expansion — System Design + AI Engineer Banks

### Goal

Add two curated question banks (System Design: 70q, AI Engineer: 60q) to the Backlog `/prep` page with:
- Self-assessment progress tracking
- Company spotlight (surfaces questions for companies in active applications)
- Role detection (AI Eng bank first if applying to AI Eng roles)
- Spaced repetition (Leitner, reuses `schedule.ts`)
- Concept primers (~40 markdown explainers)
- Unified progress dashboard (DSA + SD + AI Eng)
- AI coach mode (non-streaming Haiku evaluation, bank-specific rubrics)

### Phase assignment

| Phase | What | Who | Status |
|-------|------|-----|--------|
| **SD-P0** | Content: 130 questions + 40 primers + `scripts/validate-prep-bank.ts` | **Claude** | Pending |
| **SD-P1** | Migrations 036 + bank API + progress API + accordion UI | **Codex** | Done |
| **SD-P2** | Company spotlight, role detection, page restructure | **Codex** | Done |
| **SD-P3** | SR queue (prep-reviews) + Easy/Hard + migration 037 | **Codex** | Done |
| **SD-P4** | Concept primers + unified progress dashboard | **Codex** | Done |
| **SD-P5** | AI coach mode + migration 038 | **Codex** | Done |

Ship order: P0 → P1 → (P2 + P3 + P4 in parallel) → P5.

---

## SD-P0: Content (CLAUDE)

Claude drafts content; Kenny reviews with the checklist below before committing.

### Files to create

```
src/lib/prep/prep-types.ts          -- shared TypeScript interfaces
src/lib/prep/system-design-bank.ts  -- 70 questions (import 'server-only' at top)
src/lib/prep/ai-engineer-bank.ts    -- 60 questions (import 'server-only' at top)
src/lib/prep/concept-primers.ts     -- ~40 primers (import 'server-only' at top)
scripts/validate-prep-bank.ts       -- content validation; add to CI
```

### Types (prep-types.ts)

```typescript
export interface PrepQuestion {
  id: string           // 'sd-001' or 'ai-042' — prefix-namespaced, globally unique
  topic: string        // e.g. 'caching', 'rag-architecture'
  difficulty: 'junior' | 'mid' | 'senior'
  prompt: string       // the interview question
  hints: string[]      // 2-4 hints covering what a good answer addresses
  concepts: string[]   // concept tag slugs → link to primers
  companies?: string[] // company tags >= 5 chars for spotlight
}

export interface ConceptPrimer {
  id: string        // slug matching concepts[] tag, e.g. 'consistent-hashing'
  title: string
  summary: string   // 1-2 sentence plain-English definition
  body: string      // 3-4 paragraph markdown: what it is, why it matters, how it works, when to use, real-world example
  keywords: string[]
}
```

### SD bank topics (70 questions total)

| Topic | Count | IDs |
|-------|-------|-----|
| Caching (Redis, CDN, cache invalidation) | 8 | sd-001–sd-008 |
| Databases (sharding, replication, CAP theorem) | 10 | sd-009–sd-018 |
| Message queues (Kafka, SQS, fan-out) | 8 | sd-019–sd-026 |
| Distributed systems (consensus, leader election) | 10 | sd-027–sd-036 |
| API design (REST, GraphQL, rate limiting) | 8 | sd-037–sd-044 |
| Real architectures (Twitter, Discord, Uber, Netflix) | 10 | sd-045–sd-054 |
| Storage + CDN (S3, streaming, file upload) | 8 | sd-055–sd-062 |
| Microservices (service mesh, load balancing, circuit breaker) | 8 | sd-063–sd-070 |

### AI Eng bank topics (60 questions total)

| Topic | Count | IDs |
|-------|-------|-----|
| RAG architecture (chunking, retrieval, reranking, eval) | 10 | ai-001–ai-010 |
| Prompt engineering (few-shot, CoT, structured output, injection) | 8 | ai-011–ai-018 |
| Fine-tuning (SFT, DPO, LoRA/QLoRA, when to fine-tune) | 8 | ai-019–ai-026 |
| LLM evaluation (RAGAS, hallucination, faithfulness, A/B) | 8 | ai-027–ai-034 |
| Vector databases (HNSW, IVF, pgvector, indexing tradeoffs) | 8 | ai-035–ai-042 |
| MLOps / LLMOps (versioning, latency/cost, observability) | 10 | ai-043–ai-052 |
| Agent architecture (tool use, memory, orchestration, failure modes) | 8 | ai-053–ai-060 |

### Content review checklist (Kenny runs per question before commit)

- Prompt: clear, specific, appropriately scoped for the difficulty label?
- Hints: technically accurate (2-4 items covering key areas a strong answer addresses)?
- Difficulty: matches real interview bar for junior/mid/senior?
- Concept tags: all slugs have a matching primer in `concept-primers.ts`?
- Company tags: >= 5 chars, not ambiguous? (~30% of questions tagged)

### validate-prep-bank.ts (add to CI before P1 merges)

Must check:
- All `sd-` IDs are unique; all `ai-` IDs are unique; no ID shared across banks
- SD bank has exactly 70 questions; AI Eng has exactly 60
- All `concepts[]` slugs have a matching `ConceptPrimer.id` in `concept-primers.ts`
- All `companies[]` tags are >= 5 chars
- All `difficulty` values are 'junior' | 'mid' | 'senior'
- All `id` values match expected prefix: `sd-\d{3}` or `ai-\d{3}`

---

## SD-P1: Bank API + Progress + UI (CODEX)

**Blocked on:** SD-P0 content files exist in `src/lib/prep/`.

### Migration 036 — question_progress

```sql
CREATE TABLE question_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  question_id text NOT NULL,
  bank text CHECK (bank IN ('system-design', 'ai-engineer')) NOT NULL,
  CHECK ((bank='system-design' AND question_id LIKE 'sd-%') OR (bank='ai-engineer' AND question_id LIKE 'ai-%')),
  status text CHECK (status IN ('unstudied', 'studied', 'needs-review')) DEFAULT 'unstudied',
  last_reviewed_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ON question_progress(user_id, question_id);
CREATE OR REPLACE FUNCTION set_question_progress_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_question_progress_updated
BEFORE UPDATE ON question_progress
FOR EACH ROW EXECUTE FUNCTION set_question_progress_updated();
ALTER TABLE question_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own progress" ON question_progress
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### API routes (P1)

**`GET /api/prep/question-bank?bank=system-design|ai-engineer`**
- Auth: 401 if not authenticated
- Validate: 400 if `bank` missing or not one of the two valid values
- Import bank + primers (server-only files); return `{ questions: PrepQuestion[], primers: ConceptPrimer[] }`
- Add header: `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

**`GET /api/prep/question-progress`**
- Auth: 401 if not authenticated
- Returns all rows for `user_id` from `question_progress`

**`POST /api/prep/question-progress`** (upsert)
- Auth: 401 if not authenticated
- Body: `{ question_id: string, bank: 'system-design'|'ai-engineer', status: 'unstudied'|'studied'|'needs-review' }`
- 400 if any field missing or invalid
- `INSERT ... ON CONFLICT (user_id, question_id) DO UPDATE SET status = EXCLUDED.status, last_reviewed_at = now()`
- Never 409 — always upsert

### UI components (P1)

**`SystemDesignBank.tsx`** and **`AIEngineerBank.tsx`**
- Topic accordion (collapsed by default, one section per topic)
- Per-question row: question prompt, difficulty badge, status indicator (unstudied / studied / needs-review)
- Click question → expand to show hints + concept tag chips
- Click concept tag → open `ConceptPrimerModal` (if primer exists; silently no-op if not)
- Topic progress ring: (studied + needs-review) / topic question count
- "Mark studied" / "Needs review" buttons per question
- Show skeleton while bank data is loading

**`ConceptPrimerModal.tsx`**
- Opens over accordion; shows `ConceptPrimer.title`, `summary`, `body` (markdown-rendered), `keywords`
- Close button; trap focus

**Progress % definition:** (studied + needs-review) / total bank size. "Missing row = unstudied" — `progressMap[questionId]?.status ?? 'unstudied'`.

### Integration tests (P1)

File: `src/tests/integration/question-bank.test.ts`
File: `src/tests/integration/question-progress.test.ts`

See test plan at: `~/.gstack/projects/cs-keni-backlog/keni-main-eng-review-test-plan-20260521-175840.md`

---

## SD-P2: Company Spotlight + Role Detection (CODEX)

**Blocked on:** P1 shipped.

### CompanySpotlight.tsx

- Read active applications from tracker (status: phone_screen, technical, final)
- Extract company names → run `getSpotlightQuestions(companies, [...sdBank, ...aiBank])`
- Show top 5 questions across both banks with "Questions relevant to [Company]'s domain" copy
- Only render section if there are matches; otherwise render nothing

### Spotlight logic (src/lib/prep/spotlight-logic.ts)

```typescript
export function getSpotlightQuestions(
  activeCompanies: string[],
  allQuestions: PrepQuestion[]
): PrepQuestion[] {
  const normalizedCos = activeCompanies.map(c => c.toLowerCase())
  return allQuestions
    .filter(q => q.companies?.some(tag => {
      if (tag.length < 5) return false  // >= 5 char minimum
      return normalizedCos.some(co => co.includes(tag) || tag.includes(co))
    }))
    .sort((a, b) => {
      const aExact = a.companies?.some(tag => normalizedCos.includes(tag)) ? 1 : 0
      const bExact = b.companies?.some(tag => normalizedCos.includes(tag)) ? 1 : 0
      return bExact - aExact
    })
    .slice(0, 5)
}
```

### Role detection (src/lib/prep/role-detection.ts)

```typescript
const AI_ENGINEER_KEYWORDS = [
  'ai engineer', 'ml engineer', 'machine learning engineer',
  'applied scientist', 'research engineer', 'llm engineer',
  'ai software engineer', 'applied ai', 'genai', 'nlp engineer'
]

export function hasAIEngineerApplications(activeJobTitles: string[]): boolean {
  const lower = activeJobTitles.map(t => t.toLowerCase())
  return lower.some(t => AI_ENGINEER_KEYWORDS.some(k => t.includes(k)))
}
```

### Page restructure

Modify `PrepClient.tsx` to show "General Prep" section (always visible) above existing job-centric "Interview Prep" section. If `hasAIEngineerApplications` is true: show AI Eng bank first. Otherwise: SD bank first.

### Unit tests (P2)

File: `src/tests/unit/prep-spotlight.test.ts`
File: `src/tests/unit/prep-role-detection.test.ts`

---

## SD-P3: Spaced Repetition (CODEX)

**Blocked on:** P1 shipped.

### Migration 037 — prep_reviews

```sql
CREATE TABLE prep_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  question_id text NOT NULL,
  bank text CHECK (bank IN ('system-design', 'ai-engineer')) NOT NULL,
  CHECK ((bank='system-design' AND question_id LIKE 'sd-%') OR (bank='ai-engineer' AND question_id LIKE 'ai-%')),
  interval_days integer DEFAULT 1,
  next_review_at date NOT NULL,  -- set by getTodayLocal() from schedule.ts, NOT by CURRENT_DATE
  last_difficulty text CHECK (last_difficulty IN ('easy', 'hard')),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ON prep_reviews(user_id, question_id);
CREATE OR REPLACE FUNCTION set_prep_reviews_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_prep_reviews_updated
BEFORE UPDATE ON prep_reviews
FOR EACH ROW EXECUTE FUNCTION set_prep_reviews_updated();
ALTER TABLE prep_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own reviews" ON prep_reviews
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**IMPORTANT: `next_review_at` MUST be set by app code using `getTodayLocal()` from `src/lib/dsa/schedule.ts`. Never use SQL `CURRENT_DATE` — it's UTC server time and causes off-by-one errors for US Pacific users.**

### SR trigger

When `POST /api/prep/question-progress` sets status to `'studied'` for the first time:
- Check if a `prep_reviews` row exists for `(user_id, question_id)`
- If not: insert with `next_review_at = getTodayLocal()`, `interval_days = 1`

### API routes (P3)

**`GET /api/prep/prep-reviews`**
- Auth: 401 if not authenticated
- Returns rows where `next_review_at <= getTodayLocal()`, capped at 10 per day
- Joins question data from the static bank (not from DB — look up by question_id in bank array)

**`PATCH /api/prep/prep-reviews/[id]`**
- Auth: 401 if not authenticated
- 403 if row doesn't belong to user
- Body: `{ difficulty: 'easy' | 'hard' }`
- 400 if difficulty is invalid
- Compute new interval: `computeNextInterval(currentInterval, difficulty)` from `src/lib/dsa/schedule.ts`
- Set `next_review_at = addDays(getTodayLocal(), newInterval)` using `addDays` from `schedule.ts`
- Update `last_difficulty`, `interval_days`, `next_review_at`, `updated_at`

### UI component (P3)

**`PrepReviewQueue.tsx`**
- Shows today's SR queue (both banks, capped at 10)
- Each card: question prompt, bank badge, Easy/Hard buttons
- Easy/Hard → PATCH → update next_review_at + remove from today's queue
- Empty state: "You're all caught up for today"

### Integration tests (P3)

File: `src/tests/integration/prep-reviews.test.ts`

---

## SD-P4: Concept Primers + Unified Dashboard (CODEX)

**Blocked on:** P1 shipped (primers already exist from P0 content; P4 just wires them into the dashboard).

### UnifiedProgressDashboard.tsx

- 3 mini progress rings side by side: DSA %, SD %, AI Eng %
- DSA %: `COUNT(lc_solves WHERE user_id = X)` / 150 (NeetCode 150 total)
- SD %: (studied + needs-review) / 70
- AI Eng %: (studied + needs-review) / 60
- Loading skeleton while data fetches
- Clicking a ring scrolls to the relevant bank section

Note: primers are already in `concept-primers.ts` from P0. The P4 work is wiring the primer modal into the unified dashboard and verifying all concept tag links work. Run `scripts/validate-prep-bank.ts` again to confirm all tags have matching primers before shipping P4.

---

## SD-P5: AI Coach Mode (CODEX)

**Blocked on:** P1 shipped (needs question data + user auth pattern).

### Migration 038 — prep_practice_responses

```sql
CREATE TABLE prep_practice_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  question_id text NOT NULL,
  bank text CHECK (bank IN ('system-design', 'ai-engineer')) NOT NULL,
  response_text text NOT NULL,
  scores jsonb,  -- SD: {requirements,capacity,components,bottlenecks,tradeoffs}
                 -- AI Eng: {framing,depth,tradeoffs,failures,production}
  feedback_text text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON prep_practice_responses(user_id, question_id, created_at DESC);
ALTER TABLE prep_practice_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own practice" ON prep_practice_responses
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### API route (P5)

**`POST /api/prep/prep-practice`**

```typescript
// Validation
if (!body.response_text || typeof body.response_text !== 'string')
  return Response.json({ error: 'response_text required' }, { status: 400 })
if (body.response_text.length > 5000)
  return Response.json({ error: 'response_text too long (max 5000 chars)' }, { status: 400 })
// ... validate question_id, bank

// Rate limit: 20 evals/day per user (in-memory Map<userId, {count, date}>)
// Reset count when date changes

// Build prompt based on bank:
const isSD = body.bank === 'system-design'
const systemPrompt = isSD
  ? `You are a senior staff engineer... Respond ONLY with this JSON:
     { "scores": {"requirements": N, "capacity": N, "components": N, "bottlenecks": N, "tradeoffs": N}, "overall": "string" }`
  : `You are a senior ML/AI engineer... Respond ONLY with this JSON:
     { "scores": {"framing": N, "depth": N, "tradeoffs": N, "failures": N, "production": N}, "overall": "string" }`

const userMessage = `Question: ${question.prompt}
Hints: ${question.hints.join(', ')}
<candidate_answer>
${body.response_text}
</candidate_answer>`

// Call claude-haiku-4-5 (NON-streaming — await full response)
// Parse JSON; validate all 5 keys are present integers 0-10
// Return 422 if parse fails or any key is missing/out of range
// Store to prep_practice_responses
// Return { scores, overall }
```

**Model:** `claude-haiku-4-5` via Anthropic SDK (already wired in `interview-kit/route.ts` — same pattern).

### UI component (P5)

**`PrepCoachPanel.tsx`**
- Text area for candidate answer (max 5000 chars, character counter)
- "Evaluate" button → POST → shows "Evaluating..." spinner
- On response: reveal 5 score bars with staggered animation (animate-pulse → fill)
- Score bar labels differ by bank (SD: Requirements/Capacity/etc., AI Eng: Framing/Depth/etc.)
- Overall feedback text below scores
- "Try again" clears the text area

### Integration tests (P5)

File: `src/tests/integration/prep-practice.test.ts`

---

## Checks to run after any phase

```bash
node node_modules/typescript/bin/tsc --noEmit

# Per-phase tests
node node_modules/vitest/vitest.mjs run src/tests/integration/question-bank.test.ts
node node_modules/vitest/vitest.mjs run src/tests/integration/question-progress.test.ts
node node_modules/vitest/vitest.mjs run src/tests/integration/prep-reviews.test.ts
node node_modules/vitest/vitest.mjs run src/tests/integration/prep-practice.test.ts
node node_modules/vitest/vitest.mjs run src/tests/unit/prep-spotlight.test.ts
node node_modules/vitest/vitest.mjs run src/tests/unit/prep-role-detection.test.ts

# Full regression (must stay at 241+ passing)
node node_modules/vitest/vitest.mjs run src/tests/
```

---

## Full test baseline (as of 2026-05-22)

- 88 unit tests — all passing
- 153 integration tests — all passing
- **Total: 241 tests**

Do not break any of these. Run full suite before declaring any phase done.
