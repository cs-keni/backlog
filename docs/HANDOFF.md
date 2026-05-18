# Handoff

> Whoever is picking this up — Claude Code or Codex — read this first. Then read `docs/CURRENT_TASK.md`.

---

## Session: 2026-05-18 — Worker GPT-5 nano parameter fix (Codex)

### What changed

- Reviewed Render logs from the 2026-05-18 09:00 PDT worker run.
- **`worker/src/llm/normalizer.ts`**
  - Removed `temperature: 0` from `gpt-5-nano` chat completion calls.
  - This fixes the logged `400 Unsupported value: 'temperature' does not support 0 with this model` error.
- **`worker/src/jobs/enricher.ts`**
  - Removed the same unsupported `temperature: 0` override from the GPT fallback enrichment path.
- **`worker/tests/normalizer.test.ts`**
  - Added regression coverage proving normalization requests omit `temperature`.

### Checks run

- `cd worker && npm run test -- tests/normalizer.test.ts tests/unit/enricher.test.ts` — passed, 15 tests
- `cd worker && npm run build` — passed

### Log interpretation

- Migration 19 looks good in production: no `jobs_source_check` failures appeared.
- GitHub discovery wrote 2 new jobs at 09:00 PDT despite fallback normalization.
- Portal and Brave are functioning, but both produced 0 new jobs in the shown runs because relevant results were already stored.
- Brave query quality can still be improved: five quoted ATS queries returned 0 results, while broader career queries produced candidates. Next tuning should add per-query candidate/extracted metrics and likely replace some zero-yield queries with Portland/remote/company-specific searches.

---

## Session: 2026-05-18 — Feed/source test coverage (Codex)

### What changed

- **`worker/tests/deduplicator.test.ts`**
  - Added `filterNewJobs()` coverage for portal/search-style normalized jobs.
  - Covers new jobs, existing URL filtering, empty input without DB calls, DB fail-open behavior, and chunking over the 50 URL PostgREST limit.
- **`src/tests/integration/analytics.test.ts`**
  - Added `/api/analytics` route coverage for unauthorized access.
  - Verifies `sourceBreakdown` counts `github`, `portal`, and `manual` separately, with unknown legacy sources still falling into GitHub/backfill behavior.

### Checks run

- `cd worker && npm run test -- tests/deduplicator.test.ts` — passed, 9 tests
- `npm run test -- src/tests/integration/analytics.test.ts` — passed, 2 tests
- `cd worker && npm run build` — passed
- `npx tsc --noEmit` — passed

### Remaining work

- Production feed health still needs a real Render run check for migration 19: no `jobs_source_check` failures and portal/search writes with `source='portal'`.
- The broader P5 docs/test cleanup still has stale roadmap docs to reconcile.

---

## Session: 2026-05-18 — Priority list update (Codex)

### What changed

- **`docs/PRIORITY.md`**
  - Added Codex-owned P4 item: "Aggressive Portland SWE discovery".
  - Intent: add a more aggressive search path for software engineering jobs in Portland, Oregon.
  - Status is planned only; no implementation was started.

### Checks run

- Not run; docs-only priority update.

---

## Session: 2026-05-18 — Worker run summaries (Codex)

### What changed

- **`worker/src/search/brave.ts`**
  - `discoverJobsViaBraveSearch()` now returns structured metrics with the discovered jobs:
    - query count
    - raw result count
    - candidate URL count
    - extracted job count
    - experience-skip count
- **`worker/src/aggregator.ts`**
  - Adds compact source summaries to Render logs.
  - GitHub source summary: parsed, relevant, new-before-normalization.
  - Portal summary: fetched, relevant, new-before-enrichment.
  - Portal enrichment budget: missing descriptions vs already-described jobs.
  - Brave summary: queries, raw results, candidate URLs, extracted, skipped by experience, relevant, new.
  - End-of-run summary: written count by source.
- **`docs/PRIORITY.md`**
  - Marked worker run budget reporting as baseline implemented.

### Checks run

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — passed, 48 tests
- `cd worker && npm run build` — passed

### Next production check

- On the next Render worker run, use the new summary lines to decide whether to tune:
  - Brave query count/freshness
  - portal company list
  - normalized relevance filter
  - enrichment budget

---

## Session: 2026-05-18 — Render log follow-up and discovery tuning (Codex)

### What changed

- Added **`docs/PRIORITY.md`** with current priority order and owner split:
  - Codex owns feed/source/discovery, cost, analytics, daily queue, feedback loop, docs/tests.
  - Claude owns Workday extension observability/reliability unless redirected.
- Render log diagnosis:
  - `jobs_source_check` errors were from `source='portal'` inserts hitting a DB constraint that did not allow `portal` yet.
  - Kenny applied migration 19 successfully after seeing the logs; next worker run should confirm the error is gone.
- **`worker/src/jobs/relevance-filter.ts`**
  - Blocks `Sr` without a dot, e.g. `Sr Fullstack Engineer`.
  - For normalized portal/search jobs, requires an explicit entry-level signal before write (`new grad`, `junior`, `associate`, `entry-level`, `early career`, `fellow`, etc.).
  - Blocks non-US city signals embedded in titles, e.g. Tokyo.
- **`worker/src/search/brave.ts`**
  - Brave queries were too strict and returned zero results.
  - Replaced quoted + negative-term queries with ATS/careers-oriented queries.
  - Default query limit is now `8`.
  - Default freshness is now `pm` (past month) instead of `pw`.
  - Downstream filters now prune senior/ML/non-SWE results instead of relying on Brave query exclusions.
- **Tests**
  - Added coverage for Greenhouse job-board URL detection, `Sr Fullstack`, generic normalized portal roles, and title-embedded Tokyo.

### Checks run

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — passed, 48 tests
- `cd worker && npm run build` — passed

### Next production check

- Watch the next Render worker run for:
  - no `jobs_source_check` failures
  - Brave result counts above zero
  - portal fetched count much smaller after relevance filtering
  - successful writes with source `portal`

---

## Session: 2026-05-18 — Source tracking cleanup (Codex)

### What changed

- Removed ignored local build artifacts: `.next/` and `extension/dist/`.
- Added **`supabase/migrations/019_allow_portal_job_source.sql`**:
  - Drops/recreates `jobs_source_check`.
  - Allows `source IN ('github', 'portal', 'manual')`.
  - Matches the worker's existing `writeJobs(..., 'portal')` path for curated portal scan and Brave Search discovery.
- Updated source typing and UI:
  - `src/lib/jobs/types.ts` includes `portal`.
  - `src/app/api/analytics/route.ts` returns `sourceBreakdown.github`, `sourceBreakdown.portal`, and `sourceBreakdown.manual`.
  - `src/app/(app)/analytics/page.tsx` shows a separate "Company/search discovery" source row.
  - `src/components/feed/JobDetail.tsx` shows a "Discovered" badge for portal jobs.
- Cleaned stale testing/docs:
  - `TESTING-SUITE.md` now reflects the current software-engineering-only relevance policy.
  - Added Brave Search discovery test coverage notes.
  - `PHASES.md` now documents `jobs.source` as `github | portal | manual`.

### Checks run

- `npm run test -- src/tests/integration/jobs-feed.test.ts` — passed, 12 tests
- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — passed, 44 tests
- `npx tsc --noEmit` — passed

### Notes

- Apply migration `019_allow_portal_job_source.sql` in Supabase before any DB that still has the original check constraint will accept `source='portal'`.

---

## Session: 2026-05-18 — Codex extension/product idea memo (Codex)

### What changed

- Added **`docs/CODEX_IDEAS.md`** as a lightweight idea bank for Claude/Codex.
- Captures current extension review notes:
  - Workday has more support than older TODOs imply: timeout fallback, combobox, skills, work-history, and education helpers exist.
  - Highest leverage next extension work is observability: real Workday fixture capture and a redacted debug export button.
  - Still-valid Workday priorities: modal guard, prior-employer radio based on work history, structured address fields.
- Captures broader Backlog ideas:
  - cache/batch extension LLM calls
  - per-run worker budget summaries
  - daily apply queue
  - negative feedback loop for irrelevant jobs
  - source analytics by interview yield

### Checks run

- Docs-only change; no automated checks run.

---

## Session: 2026-05-18 — Brave Search job discovery (Codex)

### What changed

- **`worker/src/search/brave.ts`**
  - Added Brave Web Search discovery using `BRAVE_SEARCH_API_KEY`.
  - Uses 8 targeted search phrases but runs only the first `BRAVE_SEARCH_QUERY_LIMIT` per aggregation run; default is `6`.
  - Uses Web Search only, not Answers API.
  - Defaults freshness to `pw` (past week); override with `BRAVE_SEARCH_FRESHNESS=pm` for past month.
  - Filters search results before fetching: skips broad job boards and keeps likely direct ATS/company job pages.
  - Extracts direct Greenhouse/Lever postings via public APIs and generic pages via JSON-LD `JobPosting`.
  - Drops postings that appear to require 3+ years of professional/relevant software experience.
- **`worker/src/aggregator.ts`**
  - Runs Brave Search discovery after GitHub and portal scans.
  - Reuses `filterRelevantJobs`, `filterNewJobs`, and `writeJobs`.
  - Writes discovered jobs with source `portal`.
- **`worker/tests/unit/brave-search.test.ts`**
  - Added tests for job URL filtering and less-than-3-years gating.

### Checks run

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — passed, 44 tests
- `cd worker && npm run build` — passed

### Notes / risks

- Local live Brave API test was not run because the key is only in Render.
- This intentionally does not use Brave Answers API.
- Default budget is 6 searches per aggregation run. With the current 8-hour cron, that is about 18 searches/day, roughly 540/month before manual force runs.
- Direct job extraction is conservative. Sites without Greenhouse/Lever APIs or JSON-LD may be skipped rather than using GPT/browser rendering.

---

## Session: 2026-05-18 — Job relevance filtering tightened (Codex)

### What changed

- **`worker/src/jobs/relevance-filter.ts`**
  - Replaced broad "block only bad titles" behavior with a positive software-engineering title gate.
  - Removed PM/TPM allowlist behavior; product/program roles are now filtered out.
  - Blocks ML/data/research tracks: Machine Learning Engineer, Data Scientist, Research Scientist, NLP, computer vision, deep learning, etc.
  - Allows AI software engineering titles such as "AI Software Engineer", "Applied AI Engineer", GenAI/LLM software roles.
  - Blocks more mid/senior signals, including "Software Engineer II", `mid-level`, architect, staff/principal/lead, and normalized `experience_level` of `mid` or `senior`.
- **`worker/tests/unit/relevance-filter.test.ts`**
  - Added coverage for PM/TPM blocks, ML/data/research blocks, AI engineering allows, associate/junior SWE allows, non-software title blocks, and normalized mid-level filtering.
- **`docs/CURRENT_TASK.md` / `docs/ENGINEERING_LOG.md`**
  - Updated shared context for Claude/Codex handoff.

### Checks run

- `cd worker && npm run test -- tests/unit/relevance-filter.test.ts` — passed, 35 tests
- `cd worker && npm run build` — passed

### Notes / risks

- Generic "Software Engineer" is intentionally still allowed to avoid dropping valid new-grad roles where the source or portal omits junior/associate wording.
- Titles containing explicit ML wording are blocked even when paired with software engineering wording, per current user preference to avoid machine-learning jobs.

---

## Session: 2026-05-15 — Phase 10B complete (Claude Code)

### What was done

Implemented full Phase 10B Workday autofill:

- **`extension/src/content/fill.ts`** — `computeFills`/`applyFills` split, `WORKDAY_ID_MAP`, `isElementFillable`, shadow boundary label climbing, `queryShadowScoped`
- **`extension/src/shared/types.ts`** — `ScannedField` interface, `SCAN_FORM`/`APPLY_SCANNED` messages
- **`extension/src/sidebar/Sidebar.tsx`** — scan-preview UX with "Scan form" → preview → "Apply N fields" flow
- **`extension/src/content/fill.test.ts`** — 48 tests, all passing
- **`extension/src/test/setup.ts`** — CSS.escape polyfill (jsdom 29 root cause fix)
- **`PHASES.md`** — Phase 10B section added

**Key gotcha discovered:** jsdom 29 does not expose a global `CSS` object. `CSS.escape(input.id)` inside `computeFills` threw silently (caught by try/catch). Fixed in `setup.ts`.

### What's next (Phase 10B.2+)

1. **Real Workday smoke test** — test on `*.myworkdayjobs.com` before declaring Phase 10B done (D6)
2. **Async combobox fill** — Workday country/state/city use custom async comboboxes; need to type, wait for dropdown, click match
3. **E2E test** — Playwright scan → apply flow
4. **DOM fixture capture** — capture a real Workday form for deterministic regression tests

### Branch status

All changes on `main`. Build passes (`npm run build`). 48/48 tests pass.

---

## Previous sessions

### 2026-04-28 (Claude Code)
- Implemented multi-page auto-advance, background service worker state, Haiku Tier 2, Sonnet Tier 3
- Added sidebar with scan/fill/review states
- Phase 10A complete

### 2026-04-04 (Claude Code)
- Designed auto-apply engine (Phase 10A design doc)
- Decided on 3-tier LLM strategy
