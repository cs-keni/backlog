# Current Task

**Last updated:** 2026-05-18
**Status:** Source yield analytics implemented; monitor next Render run for Brave tuning

---

## Fixed in latest Codex session

1. **Added source yield analytics**
   - `/api/analytics` now groups application outcomes by job source (`github`, `portal`, `manual`).
   - Analytics UI now shows applications, submitted count, responses, interviews, offers, response rate, and interview rate per source.
   - Added integration test coverage for source-yield calculations.

## Checks run

- `npm run test -- src/tests/integration/analytics.test.ts` — passed, 2 tests
- `npx tsc --noEmit` — passed

---

## Previous Codex session

1. **Implemented aggressive Portland/remote Brave discovery tuning**
   - Reordered Brave Search defaults so the production-proven broad career queries run first.
   - Added Portland-specific and remote-specific software engineering search queries inside the default 8-query budget.
   - Moved low-yield quoted new-grad ATS queries outside the default budget.
   - Added per-query raw/candidate/extracted/accepted metrics to Brave logs and returned discovery metrics.
   - Added tests for the default Brave query mix.

## Checks run

- `cd worker && npm run test -- tests/unit/brave-search.test.ts` — passed, 13 tests
- `cd worker && npm run build` — passed

---

## Previous Codex session

1. **Fixed worker GPT-5 nano request compatibility**
   - Render logs showed `400 Unsupported value: 'temperature' does not support 0 with this model` during GitHub job normalization at 2026-05-18 09:00 PDT.
   - Removed `temperature: 0` from worker GPT-5 nano calls in normalization and enrichment fallback.
   - Added a regression test that asserts normalization requests omit `temperature`.

## Checks run

- `cd worker && npm run test -- tests/normalizer.test.ts tests/unit/enricher.test.ts` — passed, 15 tests
- `cd worker && npm run build` — passed

---

## Production log observations from 2026-05-18

- Migration 19 appears healthy: logs no longer show `jobs_source_check` failures.
- GitHub source wrote 2 new jobs at 09:00 PDT after fallback normalization.
- Portal scan fetched ~1.4k jobs, but only 2 passed relevance and both were already stored.
- Brave Search produced 17 raw results, 13 candidate URLs, 6 extracted jobs, 4 relevant jobs after filters, and 0 new jobs. Current searches are working but mostly rediscover stored jobs.
- Optimization candidate: replace or supplement zero-result quoted ATS queries with Portland/remote/company-specific queries and add per-query candidate/extracted counts so low-yield queries are easier to prune.

---

## Previous Codex session

1. **Added missing source/feed tests**
   - `worker/tests/deduplicator.test.ts` now covers `filterNewJobs()` for new jobs, existing URL filtering, empty input, DB fail-open behavior, and chunking over the 50 URL PostgREST limit.
   - `src/tests/integration/analytics.test.ts` now verifies `/api/analytics` returns separate source breakdown counts for GitHub, portal/search, and manual jobs.

## Checks run

- `cd worker && npm run test -- tests/deduplicator.test.ts` — passed, 9 tests
- `npm run test -- src/tests/integration/analytics.test.ts` — passed, 2 tests
- `cd worker && npm run build` — passed
- `npx tsc --noEmit` — passed

---

## Previous Codex session

1. **Updated priority list only** — added a Codex-owned planned item for a more aggressive search path for software engineering jobs in Portland, Oregon. No implementation was started.

---

## Previous Codex session

1. **Added worker run summaries** — Render logs now include compact per-source summaries for GitHub, portals, and Brave Search.
2. **Added Brave discovery metrics** — Brave Search now reports query count, raw results, candidate URLs, extracted jobs, experience skips, relevant jobs, new jobs, and writes.
3. **Added portal/GitHub budget logs** — portal scan logs fetched/relevant/new counts and enrichment budget; GitHub logs parsed/relevant/new before normalization.

## Checks run

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 48 tests passed
- `cd worker && npm run build` — passed

---

## Previous Codex session

1. **Diagnosed Render logs** — `jobs_source_check` failures came from `source='portal'` inserts hitting a DB constraint that did not yet allow `portal`. Kenny applied migration 19 successfully afterward; next Render run should confirm the errors are gone.
2. **Tightened portal filtering** — normalized portal/search jobs now require explicit entry-level title signals (`new grad`, `junior`, `associate`, `entry-level`, `early career`, etc.) before writing. This avoids broad senior/generic company portal roles.
3. **Blocked log-exposed misses** — added filters/tests for `Sr Fullstack Engineer` and non-US city signals embedded in titles such as Tokyo.
4. **Loosened Brave Search** — removed strict negative terms from the search query itself, switched to ATS/careers-oriented searches, defaulted freshness to past month, and raised default query limit to 8. Downstream filters now do the pruning.
5. **Added priority list** — `docs/PRIORITY.md` now lists current work in priority order with Codex/Claude ownership.

---

## Previous Codex session

1. **Cleaned generated artifacts** — removed ignored local build outputs `.next/` and `extension/dist/`.
2. **Added DB migration for `jobs.source='portal'`** — `supabase/migrations/019_allow_portal_job_source.sql` updates the source check constraint to allow `github`, `portal`, and `manual`.
3. **Updated source types/UI** — app job types now include `portal`, analytics source breakdown shows GitHub vs portal/search vs manual, and job details show a discovered badge for portal jobs.
4. **Cleaned stale testing docs** — `TESTING-SUITE.md` now matches current relevance-filter expectations and includes Brave Search discovery tests.

---

## Previous Codex session

1. **Brave Search source added** — worker aggregation now runs a Brave Web Search discovery pass after GitHub and curated portal scans when `BRAVE_SEARCH_API_KEY` is present.
2. **Cost controls** — defaults to 6 search queries per aggregation run (`BRAVE_SEARCH_QUERY_LIMIT`, default `6`) and uses Brave Web Search only, not Answers API.
3. **Search result filtering** — skips broad job-board result pages and only attempts direct ATS/company job URLs that look like actual postings.
4. **Extraction path** — supports direct Greenhouse/Lever APIs plus generic JSON-LD `JobPosting` pages without adding extra GPT calls.
5. **Experience gate** — Brave-discovered jobs are dropped when the posting appears to require 3+ years of professional/relevant software experience.

## Render env vars

- Required to enable: `BRAVE_SEARCH_API_KEY`
- Optional query budget: `BRAVE_SEARCH_QUERY_LIMIT=6`
- Optional freshness window: `BRAVE_SEARCH_FRESHNESS=pw` (`pw` = past week, `pm` = past month)

---

## Previous Codex session

1. **Software-engineering-only feed gate** — `worker/src/jobs/relevance-filter.ts` now requires titles to match software engineering patterns before raw GitHub entries are sent to GPT normalization or portal jobs are sent to enrichment.
2. **AI engineering allowed, ML/data/research blocked** — AI software/product engineering titles such as "AI Software Engineer" and "Applied AI Engineer" are allowed; "Machine Learning Engineer", data scientist, research scientist, NLP, computer vision, and similar ML/research roles are blocked.
3. **Entry-level bias tightened** — PM/TPM roles are no longer allowlisted, common mid/senior title signals such as "Software Engineer II", "mid-level", architect, staff, principal, and lead are blocked, and normalized jobs with `experience_level` of `mid` or `senior` are dropped.

## Known filter tradeoffs

- Generic "Software Engineer" titles are still allowed because SimplifyJobs/New-Grad is already scoped and many valid entry-level portal roles omit "junior" or "associate".
- Titles containing "machine learning" or explicit "ML" are blocked even if they also contain "software engineer" to avoid drifting into ML-specific jobs.

---

## Fixed in this session (commit afaa5b6)

1. **"Enhancing with AI…" stuck indefinitely** — `chrome.storage.session` was throwing on Workday and crashing `runTier2AndFinish` before it could set `status: review`. Fixed with try-catch.
2. **Phone Extension filled incorrectly** — "Phone Extension" label matched `/phone/` pattern. Fixed by adding `exclude: /ext(ension)?/` to the phone FIELD_MAP entry.
3. **Cancel button** — Added to `FillingState` so the user can abort mid-fill at any time.

---

## Known remaining issues (from smoke test)

### Address parsing (profile data issue)
The profile stores address as "Portland, OR" (city + state, no street, no zip). The extension has no street address to fill and extracts the zip incorrectly. User needs to add their full address to their Backlog profile, OR we add separate address subfields to the profile.

### State dropdown not filled (Phase 10B.2)
Workday state/country/city use async custom comboboxes (not `<select>`). Clicking them triggers a dropdown that needs: type → wait → click match. Deferred to Phase 10B.2.

### "Worked at Workday" radio (Yes/No)
Yes/No radio buttons not handled. The `FIELD_MAP` has checkbox/yes-no patterns but not radio group detection. Needs investigation of the actual Workday DOM structure.

---

## Next smoke test checklist

1. Reload extension after this commit
2. Fill out Workday application page 1
3. Verify phone extension is now empty
4. Verify sidebar exits "filling" state (no longer stuck)
5. Test Cancel button works
6. Check address Line 1 — note what value appears
7. Continue to page 2 and note behavior

---

## Phase 10B.2 (deferred)

- Async Workday combobox fill (country/state/city)
- Radio button (Yes/No) field support
- Workday DOM fixture capture for regression tests
- E2E Playwright scan → apply flow
