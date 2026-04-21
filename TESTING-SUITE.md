# Testing Suite — Backlog

> Comprehensive coverage plan for Phase 17. Infrastructure is already in place:
> Vitest + MSW in `src/` and `worker/`, Playwright for E2E, Vitest in `extension/`.
> This document tracks every test that needs to be written, organized by layer and priority.

---

## Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| `worker/src/` business logic | 80%+ | Core pipeline — parse, dedupe, filter, normalize |
| `src/lib/` | 80%+ | LLM callers, matchers, PDF extraction, URL extractor |
| API route handlers | 80%+ | Every data-mutation route |
| Auth paths | 100% | Redirect, login, session, idle logout |
| Extension fill logic | 80%+ | Standard field mapping, ATS parsers |
| E2E critical flows | Key paths | Feed, tracker, profile upload, cover letter, prep |

---

## What Already Exists

| File | What it tests | Status |
|------|---------------|--------|
| `worker/tests/parser.test.ts` | GitHub markdown parser — sub-rows, locked rows, multi-location | ✅ exists |
| `worker/tests/deduplicator.test.ts` | `filterNewEntries` — already-seen URLs filtered, new pass through | ✅ exists |
| `worker/tests/normalizer.test.ts` | Date parser — `0d`, `7d`, `30d`, `"Sep 5"`, empty, garbage | ✅ exists |
| `src/tests/integration/jobs-feed.test.ts` | URL pattern detection (Greenhouse/Lever/other) | ✅ exists (partial) |
| `src/tests/helpers/url-extractor-test-helpers.ts` | Pure parsing helpers for URL extractor | ✅ exists |
| `src/tests/e2e/auth.spec.ts` | Unauthenticated redirect to `/login`; `/` redirect | ✅ exists (partial) |

---

## 17a — Test Fixtures & Factories

Shared factories imported by all test layers. Write these first — every other test depends on them.

### Worker factories (`worker/tests/fixtures/`)

- [x] `jobs.ts`
  - `makeRawEntry(overrides?)` — returns `RawJobEntry` with sensible defaults
  - `makeNormalizedJob(overrides?)` — returns `NormalizedJob` with all fields populated

### App factories (`src/tests/fixtures/`)

- [x] `jobs.ts`
  - `makeJob(overrides?)` — returns a DB `jobs` row shape
  - `makeApplication(overrides?)` — returns an `applications` row shape
  - `makeUser(overrides?)` — returns a `users` row shape with all fields
- [x] `profile.ts`
  - `makeUserProfile(overrides?)` — full structured profile
  - `makeWorkHistory(overrides?)` — single `work_history` row
  - `makeEducation(overrides?)` — single `education` row
  - `makeProject(overrides?)` — single `projects` row

### Supabase mock helper (`src/tests/helpers/`)

- [x] `supabase-mock.ts` — typed builder that wraps MSW handlers; lets route tests mock `supabase.from('table').select()` responses without raw fetch mocking. Pattern: `mockSupabaseSelect('jobs', [makeJob()])`.

> **Note:** Integration route tests use `vi.hoisted()` + direct supabase client mock instead of MSW interceptors — more reliable for App Router handler testing.

---

## 17b — Worker Unit Tests

Pure logic tests. No network, no DB. Run in milliseconds.

### Parser (`worker/tests/unit/parser.test.ts`)

> `parser.test.ts` already exists — extend it, don't duplicate.

- [x] HTML `<table>` format: `<tr>`/`<td>` rows parse correctly (README switched formats)
- [x] `↳` sub-row inherits company name from previous row
- [x] Row with 🔒 in link cell is skipped
- [x] Row with no parseable URL is skipped
- [x] Multi-location `<br>` cells → `, `-separated string
- [x] Leading emoji stripped from company names
- [x] Orphaned `↳` row (no prior parent row) is skipped

### Date parser (`worker/tests/unit/normalizer.test.ts`)

> `normalizer.test.ts` already exists — extend it.

- [ ] `"0d"` → today's ISO date string
- [ ] `"7d"` → 7 days ago
- [ ] `"30d"` → 30 days ago
- [ ] `"Sep 5"` → correct year inference (past month = last year)
- [ ] Empty string → `null`
- [ ] Garbage input → `null`

### Relevance filter (`worker/tests/unit/relevance-filter.test.ts`)

> New file. Tests `filterRelevantJobs` and `filterRelevantEntries`.

**Should block:**
- [x] `"Senior Software Engineer"` (seniority ceiling)
- [x] `"Staff Engineer"` (seniority ceiling)
- [x] `"Principal SWE"` (seniority ceiling)
- [x] `"Tech Lead"` (seniority ceiling)
- [x] `"Engineering Manager"` (manager filter)
- [x] `"PhD Machine Learning Researcher"` (degree gating)
- [x] `"Account Executive"` (non-CS role)
- [x] `"Product Marketing Manager"` (non-CS role)
- [x] Location `"London, UK"` (country filter)
- [x] Location `"Toronto, Canada"` (country filter)
- [x] Title containing `"Intern"` (stray internship)
- [x] Title containing `"Co-op"` (stray internship)

**Should allow:**
- [x] `"Software Engineer"` — allowed
- [x] `"Product Manager"` — allowed (CS grads apply)
- [x] `"Technical Program Manager"` — allowed
- [x] `"New Grad Software Engineer"` — allowed
- [ ] `"Principal Engineer"` — allowed (keep engineering titles with Principal)
- [x] Location `"Remote"` — allowed
- [x] Location `"San Francisco, CA"` — allowed
- [x] Location `""` (blank) — allowed (defaults US assumption)

**Log output:**
- [x] `filterRelevantEntries` log message shows correct drop count

### Salary extractor (`worker/tests/unit/enricher.test.ts`)

> New file. Tests the salary regex/extraction logic in `worker/src/jobs/enricher.ts`.

- [x] `"$120,000 – $150,000"` → `{ min: 120000, max: 150000 }`
- [x] `"$120k–$150k"` → `{ min: 120000, max: 150000 }`
- [x] `"salary: $80k to $100k"` → `{ min: 80000, max: 100000 }`
- [ ] `"$50/hr"` (hourly × 2080) → annual equivalent
- [x] No salary text → `{ min: null, max: null }`

### Deduplicator (`worker/tests/unit/deduplicator.test.ts`)

> `deduplicator.test.ts` already exists — extend with `filterNewJobs` (portal variant).

- [ ] `filterNewJobs`: entries already in DB (by URL) are filtered out
- [ ] `filterNewJobs`: new entries pass through
- [ ] Mixed batch: only new entries returned

### Discord notification (`worker/tests/unit/discord.test.ts`)

> New file. Tests `sortByRelevance` and the table-format output.

- [x] `sortByRelevance` — higher Jaccard score sorts first
- [x] `sortByRelevance` — equal score falls back to salary desc
- [x] `sortByRelevance` — jobs with no matching tags sort last
- [x] `sendJobsNotification` — skips when `DISCORD_WEBHOOK_URL` not set (no throw)
- [x] `sendJobsNotification` — top 10 listed, overflow count in footer text
- [x] Embed description contains deep-link URLs with `?job=<id>`

### Dispatcher (`worker/tests/unit/dispatcher.test.ts`)

- [x] `isInQuietHours` returns `true` when now is within window
- [x] `isInQuietHours` returns `false` outside window
- [x] Overnight range (22:00–08:00) handled correctly
- [x] `null` start or end → always returns `false`
- [x] `DISCORD_MIN_RELEVANCE=0.3` filters out jobs below threshold before Discord send

---

## 17c — App Unit Tests

### Match scorer (`src/tests/unit/matcher.test.ts`)

- [x] Jaccard score: perfect skill overlap → 100, no overlap → 0, partial → correct ratio
- [ ] `clamp` handles NaN, negative, over-100
- [x] Skills-only mode when no resume text present
- [x] `mode: 'none'` returned when both skills and resume are absent
- [x] `dimensions` returned: role_fit, tech_stack, experience_level, compensation_alignment all present

### URL extractor (`src/tests/unit/url-extractor.test.ts`)

> `jobs-feed.test.ts` already has URL detection tests — extract these and add:

- [ ] Greenhouse URL detected → routed to Greenhouse API handler
- [ ] Lever URL detected → routed to Lever API handler
- [ ] Generic URL falls through to HTML fetch + LLM path
- [ ] Invalid / non-job URL returns appropriate error shape

### API key auth (`src/tests/unit/api-key.test.ts`)

- [ ] `hashApiKey` produces consistent output for same input
- [ ] Two different keys produce different hashes
- [ ] Raw key is never returned after hashing

### Retry utility (`src/tests/unit/retry.test.ts`)

> New. Tests `src/lib/llm/retry.ts`.

- [x] Succeeds on first attempt — no retry
- [x] Retries once on HTTP 529, succeeds on second attempt
- [x] Retries once on HTTP 429
- [x] Retries on ECONNREFUSED network error
- [x] Retries on ETIMEDOUT network error
- [x] Does NOT retry on HTTP 400 (auth/bad request)
- [x] Does NOT retry on HTTP 401
- [x] Throws after `maxAttempts` exhausted
- [x] Delay between retries is ~2s (verified via fake timers)

### Resume analyzer types (`src/tests/unit/resume-analyzer.test.ts`)

> New. Tests the parser/validator logic in `analyzeResume` (mock the OpenAI call).

- [x] `linkedin_url`, `github_url`, `portfolio_url` extracted from raw LLM JSON
- [x] `gpa` extracted correctly from education entry
- [x] Work history `description` with `•` bullets is preserved as-is
- [x] Null fields coerced correctly when LLM returns undefined

---

## 17d — API Route Integration Tests

Uses Vitest + MSW. Supabase calls intercepted — no real DB. Each test verifies handler logic, not Supabase internals.

### Feed (`src/tests/integration/jobs-feed.test.ts`)

> File exists with URL detection tests — extend it with route tests.

- [ ] `GET /api/jobs` returns paginated results with correct cursor structure
- [ ] `role_type=full_time` filter applied correctly
- [ ] `is_remote=true` filter applied correctly
- [ ] `date_range=24h` restricts `posted_at` correctly
- [ ] `GET /api/jobs/[id]` returns 404 for unknown id
- [ ] `GET /api/jobs/[id]/match-score` — computes score on first call, returns cached on second (MSW mock verifies LLM not called twice)

### Applications (`src/tests/integration/applications.test.ts`)

- [x] `POST /api/applications` creates row and writes one initial timeline entry
- [x] `POST /api/applications` for same `(user_id, job_id)` a second time — upserts, does NOT write second timeline row
- [x] `PATCH /api/applications/[id]` with new status → writes timeline row + updates `last_updated`
- [x] `PATCH /api/applications/[id]` with same status → does NOT write duplicate timeline row
- [x] `PATCH /api/applications/[id]` status `applied` on already-applied row → `applied_at` NOT overwritten
- [x] `PATCH /api/applications/[id]` status `applied` on non-applied row → `applied_at` stamped
- [x] `DELETE /api/applications/[id]` removes row (cascade handled by DB)

### Profile (`src/tests/integration/profile.test.ts`)

- [ ] `POST /api/profile/resume?dry_run=true` — returns analysis, does NOT write work_history/education rows
- [ ] `POST /api/profile/resume/commit` — writes only approved indices, skips unapproved
- [ ] `POST /api/profile/resume/commit` with `approved.skills=false` — skills not updated
- [ ] `POST /api/profile/resume/commit` — `linkedin_url`, `github_url`, `portfolio_url` written when present in analysis
- [ ] `POST /api/profile/resume/commit` — `gpa` written to education entry
- [ ] `POST /api/profile/work-history` creates row, invalidates match scores
- [ ] `DELETE /api/profile/work-history/[id]` removes row, invalidates match scores
- [ ] `PATCH /api/profile` with `skills` field → marks match scores stale
- [ ] `PATCH /api/profile` without `skills` field → match scores NOT marked stale

### Saved answers (`src/tests/integration/saved-answers.test.ts`)

- [ ] `GET /api/profile/saved-answers` returns own rows only
- [ ] `POST /api/profile/saved-answers` creates row
- [ ] `PATCH /api/profile/saved-answers/[id]` updates answer text
- [ ] `DELETE /api/profile/saved-answers/[id]` removes row

### Education (`src/tests/integration/education.test.ts`)

- [ ] `POST /api/profile/education` creates row
- [ ] `PATCH /api/profile/education/[id]` updates row
- [ ] `DELETE /api/profile/education/[id]` removes row

### Star responses (`src/tests/integration/star-responses.test.ts`)

- [ ] `GET /api/star-responses?company_id=x` returns rows for that company
- [ ] `POST /api/star-responses` creates row
- [ ] `PATCH /api/star-responses/[id]` updates row
- [ ] `DELETE /api/star-responses/[id]` removes row

### Story bank (`src/tests/integration/story-bank.test.ts`)

- [x] `POST /api/story-bank` creates row with valid tags array
- [x] `POST /api/story-bank` with `tags: "not-array"` — coerced to empty array, not stored as string
- [ ] `PATCH /api/story-bank/[id]` updates fields
- [ ] `DELETE /api/story-bank/[id]` removes row

### URL extractor (`src/tests/integration/from-url.test.ts`)

- [ ] Greenhouse URL → MSW intercepts Greenhouse API call → returns normalized job
- [ ] Lever URL → MSW intercepts Lever API call → returns normalized job
- [ ] Unknown static URL → MSW intercepts HTML fetch → GPT extraction path

### Extension (`src/tests/integration/extension.test.ts`)

- [ ] `GET /api/extension/profile` returns full profile including `projects`, `saved_answers`, STAR responses
- [ ] `POST /api/extension/answer-question` returns saved answer when match found (MSW verifies Anthropic NOT called)
- [ ] `POST /api/extension/answer-question` calls Claude when no saved answer matches
- [ ] Invalid API key → 401
- [ ] Revoked API key → 401

### Cover letter (`src/tests/integration/cover-letter.test.ts`)

- [ ] `POST /api/cover-letter` — calls Anthropic, saves to `cover_letters` table, returns `{ content, template_type }`
- [ ] `POST /api/cover-letter` — auto-creates application row if none exists
- [ ] `GET /api/cover-letter?application_id=x` — returns existing letter
- [ ] Anthropic returns 529 → `withRetry` retries once → succeeds (MSW mock two responses)

### Resume tailor (`src/tests/integration/resume-tailor.test.ts`)

- [ ] `POST /api/resume/tailor` — calls Anthropic, saves to `resume_versions`, returns tailored content
- [ ] `POST /api/resume/tailor` with existing version for same job — creates new version, does not overwrite old
- [ ] Fetches projects and passes to `tailorResume` (verify via MSW request inspection)

### Worker integration (`worker/tests/integration/aggregator.test.ts`)

- [ ] Mock GitHub API response → aggregator writes correct normalized rows to test DB
- [ ] Duplicate URL → second run writes 0 new rows
- [ ] Relevance filter blocks non-qualifying titles before normalization call is made (MSW verifies OpenAI NOT called for blocked entries)
- [ ] Portal scan: mock Greenhouse API → `filterNewJobs` deduplicates → new rows written with `source: 'portal'`

---

## 17e — E2E Tests (Playwright)

Full browser tests against a running dev server. Auth state managed via `storageState` fixture — log in once, reuse session.

### Auth (`src/tests/e2e/auth.spec.ts`)

> File exists with redirect tests — extend it.

- [x] Unauthenticated user redirected to `/login`
- [x] Visiting `/` while unauthenticated redirects to `/login`
- [ ] Login with valid credentials → lands on `/dashboard`
- [ ] Login with invalid credentials → error message shown, no redirect
- [ ] `redirectedFrom=/feed?job=abc` preserved through login → drawer opens after auth
- [ ] `redirectedFrom=//evil.com` → sanitized, lands on `/dashboard` (open redirect fix)
- [ ] Idle 10min → auto-logout (use fake timers / `page.clock`)

### Feed (`src/tests/e2e/feed.spec.ts`)

- [ ] Feed loads → job cards visible
- [ ] "Remote only" toggle → all visible cards show Remote location
- [ ] Date range filter "24h" → cards update
- [ ] Scroll to bottom → next page loads (cursor pagination)
- [ ] `?job=<id>` in URL → job detail drawer opens automatically
- [ ] Paste Greenhouse URL → job appears in feed
- [ ] "Just posted" badge on jobs under 3 hours old

### Tracker (`src/tests/e2e/tracker.spec.ts`)

- [ ] Drag card from "Applied" → "Phone Screen" → card appears in new column
- [ ] Timeline in detail panel shows the status change
- [ ] Add rich-text note → persists on page refresh
- [ ] Double-click "Save" on same job → only one timeline entry written

### Profile (`src/tests/e2e/profile.spec.ts`)

- [ ] Upload PDF resume → review modal appears
- [ ] Uncheck a work history entry in modal → entry not saved after confirm
- [ ] Confirm all → success summary shown → fields visible in profile
- [ ] Upload image-based PDF → modal skipped, warning shown
- [ ] Add work history entry manually → appears in list
- [ ] Delete work history entry → removed from list

### Cover letter (`src/tests/e2e/cover-letter.spec.ts`)

- [ ] "Generate Cover Letter" → content appears in editor
- [ ] Edit content inline → copy to clipboard works
- [ ] Download PDF → file download triggered
- [ ] Re-generate with different template → content updates

### Prep (`src/tests/e2e/prep.spec.ts`)

- [ ] Open Prep tab → question bank renders
- [ ] Generate STAR response → S/T/A/R sections populated
- [ ] Save STAR response → persists on refresh
- [ ] Story bank: add story → appears in list; delete → removed

### Extension fill (`src/tests/e2e/extension.spec.ts`)

> Requires Playwright with extension loaded. See `extension/vitest.config.ts`.

- [ ] Navigate to mock Greenhouse form → standard fields filled (name, email, phone, LinkedIn)
- [ ] Open-ended text field → `saved_answers` match returned without LLM call
- [ ] Open-ended text field with no saved answer → Claude called, answer filled
- [ ] Multi-page mock form → extension navigates both pages → review panel shows all filled fields grouped by page

---

## 17f — Smoke Tests

Fast sanity checks against the live deployed environment. No mocking. Run after every deploy.

**Setup:**
- [ ] `src/tests/smoke/` directory
- [ ] `package.json`: `"test:smoke": "playwright test src/tests/smoke --reporter=line"`

**Tests (`src/tests/smoke/health.spec.ts`, `src/tests/smoke/app.spec.ts`):**
- [ ] `GET /health` on worker returns `{ ok: true }` (200)
- [ ] Login page renders without JS errors
- [ ] Feed page renders for authenticated session
- [ ] No 500 responses on main routes: `/dashboard`, `/feed`, `/tracker`, `/analytics`, `/prep`, `/profile`, `/settings`
- [ ] Resume upload endpoint reachable (HEAD or OPTIONS, no auth needed)

**Wire into CI:**
- [ ] Vercel post-deploy hook runs `test:smoke`

---

## 17g — CI Configuration

- [x] `.github/workflows/test.yml`
  - Trigger: every PR and push to main
  - Steps: `vitest run` (unit + integration) + `playwright test` (E2E against `next dev`)
  - Fail PR if any test fails
- [x] Separate scripts in root `package.json`:
  - `"test:unit"` — runs Vitest unit tests only (no network, fast)
  - `"test:integration"` — runs Vitest integration tests (MSW, still no real DB)
  - `"test:e2e"` — runs Playwright E2E
  - `"test:coverage"` — runs with coverage reporter
- [x] Worker `package.json` scripts: already had `"test"` and `"test:watch"` ✓
- [x] Extension `package.json`: already had `"test"` and `"test:watch"` ✓
- [x] Playwright config: `webServer` block spins up `next dev` before E2E run in CI; reuses existing server locally ✓
- [x] Coverage: `vitest run --coverage` with 80% threshold on `worker/src/` and `src/lib/**` + `src/app/api/**`

---

## Implementation Order (Recommended)

```
1. 17a  Fixtures & factories          — unblocks everything else
2. 17b  Worker unit tests             — fast, isolated, high confidence
3. 17c  App unit tests                — retry, matcher, analyzer
4. 17d  Integration tests             — route handlers, MSW mocks
5. 17g  CI configuration             — wire everything together early
6. 17e  E2E tests                    — slowest, most brittle, do last
7. 17f  Smoke tests                  — deploy-gated, add when CI is stable
```

---

## MSW Handler Inventory

Mock handlers live in `src/tests/mocks/handlers.ts`. These need to cover every external call made by route handlers:

| External call | Handler needed |
|--------------|----------------|
| Supabase REST API (`/rest/v1/*`) | Table-level mocks per test via `mockSupabaseSelect` helper |
| OpenAI `POST /chat/completions` | Return fixture JSON for match scoring, URL extraction |
| Anthropic `POST /v1/messages` | Return fixture text for cover letter, resume tailor, STAR, questions |
| GitHub API `GET /repos/*/commits` | Return fixture commit list |
| Greenhouse Jobs API `GET /v1/boards/*/jobs/*` | Return fixture job JSON |
| Lever Postings API `GET /v0/postings/*` | Return fixture posting JSON |
| Clearbit Logo API | Return placeholder image or empty response |

---

## Notes

- **Never use real API keys in tests.** Vitest env overrides in `vitest.config.ts` should set `OPENAI_API_KEY=test`, `ANTHROPIC_API_KEY=test`, etc.
- **Playwright auth fixture:** Create once in `src/tests/e2e/fixtures/auth.ts` using `storageState` — log in with test credentials, save session to file, all E2E tests reuse it.
- **Test DB:** Integration tests use MSW to intercept Supabase REST calls — no real DB required. E2E tests run against the real dev Supabase instance with a dedicated test user.
- **Extension E2E:** Playwright can load an unpacked extension via `--load-extension`. The extension tests use a static mock ATS form (`src/tests/e2e/fixtures/mock-form.html`) served locally.
