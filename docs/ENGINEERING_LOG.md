# Engineering Log

Reverse-chronological. One entry per meaningful session.

---

## 2026-05-18 — Worker run summaries (Codex)

### Implemented

- Added structured Brave Search discovery metrics:
  - query count
  - raw result count
  - candidate URL count
  - extracted job count
  - experience-skip count
- Added aggregator summaries for:
  - GitHub parsed/relevant/new-before-normalization counts
  - portal fetched/relevant/new-before-enrichment counts
  - portal enrichment budget
  - Brave query/extraction/relevance/new counts
  - end-of-run written count by source
- Updated `docs/PRIORITY.md` to mark worker budget reporting baseline done.

### Checks

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 48 passed
- `cd worker && npm run build` — passed

### Gotcha

This is log-only budget reporting. Persisted worker-run history is still a future enhancement.

---

## 2026-05-18 — Render log follow-up and discovery tuning (Codex)

### Implemented

- Added `docs/PRIORITY.md` with the current prioritized work list and Codex/Claude ownership.
- Tuned Brave Search discovery after Render logs showed 0 web results:
  - replaced strict quoted/exclusion queries with ATS/careers-oriented queries
  - defaulted `BRAVE_SEARCH_QUERY_LIMIT` to `8`
  - defaulted `BRAVE_SEARCH_FRESHNESS` to `pm`
- Tightened normalized portal/search filtering:
  - require explicit entry-level signal for normalized jobs
  - block `Sr` titles without requiring a dot
  - block non-US city signals embedded in titles
- Added tests for the above cases.

### Checks

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 48 passed
- `cd worker && npm run build` — passed

### Gotchas

- `jobs_source_check` log failures should be resolved by migration 19, which Kenny reported was applied successfully. Confirm on next Render run.
- Brave Search was working at the API-call level, but the old queries were too restrictive. The new approach relies on broader search plus stricter downstream filtering.

---

## 2026-05-18 — Source tracking cleanup (Codex)

### Implemented

- Removed ignored local build artifacts: `.next/` and `extension/dist/`.
- Added `supabase/migrations/019_allow_portal_job_source.sql` so `jobs.source` accepts `github`, `portal`, and `manual`.
- Updated app source typing and analytics:
  - `src/lib/jobs/types.ts`
  - `src/app/api/analytics/route.ts`
  - `src/app/(app)/analytics/page.tsx`
  - `src/components/feed/JobDetail.tsx`
- Cleaned stale source/relevance docs in `PHASES.md` and `TESTING-SUITE.md`.

### Checks

- `npm run test -- src/tests/integration/jobs-feed.test.ts` — 12 passed
- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 44 passed
- `npx tsc --noEmit` — passed

### Gotcha

Apply migration `019_allow_portal_job_source.sql` in Supabase before relying on portal/search-discovered inserts in an environment that still has the original `jobs_source_check`.

---

## 2026-05-18 — Extension/product idea memo (Codex)

### Added

- `docs/CODEX_IDEAS.md` with:
  - Workday extension review thoughts for Claude.
  - Token/cost optimization ideas.
  - Backlog product ideas.
  - Notes that `TODOS.md` / `TESTING-SUITE.md` are partially stale relative to current code.

### Key recommendation

For Workday, prioritize real DOM fixture/debug export work before more broad heuristics. The implementation already has timeout fallback and several Workday async fill helpers; the next bottleneck is observability from real failed applications.

---

## 2026-05-18 — Brave Search discovery source (Codex)

### Implemented

- Added `worker/src/search/brave.ts` to discover entry-level SWE job URLs through Brave Web Search.
- Added targeted queries for new grad, junior, associate, entry-level, early-career, AI software engineer, applied AI engineer, and LLM software engineer roles.
- Added cost controls:
  - `BRAVE_SEARCH_API_KEY` enables the source.
  - `BRAVE_SEARCH_QUERY_LIMIT` defaults to `6` per aggregation run.
  - `BRAVE_SEARCH_FRESHNESS` defaults to `pw`.
- Added cheap search-result filtering before fetching pages:
  - skip broad job boards such as Indeed/LinkedIn/Glassdoor/ZipRecruiter
  - keep likely direct ATS/company job URLs
- Added extraction for Greenhouse, Lever, and generic JSON-LD `JobPosting` pages.
- Added less-than-3-years gate that blocks explicit 3+ years professional/relevant experience requirements.
- Wired the source into `worker/src/aggregator.ts` after portal scanning.
- Added `worker/tests/unit/brave-search.test.ts`.

### Checks

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 44 passed
- `cd worker && npm run build` — passed

### Gotchas

- No live Brave API test was run locally; the API key is configured in Render.
- Search-discovered jobs write with source `portal`; see migration `019_allow_portal_job_source.sql`.
- The source is intentionally conservative and may skip pages that require JavaScript or lack JSON-LD.

---

## 2026-05-18 — Entry-level SWE relevance filter (Codex)

### Implemented

- Tightened `worker/src/jobs/relevance-filter.ts` so raw GitHub jobs are filtered before GPT normalization and portal jobs are filtered before enrichment using a positive software-engineering title gate.
- Removed previous PM/TPM allow behavior; the feed now targets software engineering only.
- Added blocks for ML/data/research tracks, including Machine Learning Engineer, Data Scientist, Research Scientist, NLP, computer vision, and deep learning.
- Kept AI engineering in scope for product/software titles such as AI Software Engineer, Applied AI Engineer, GenAI/LLM software roles.
- Added mid-level filtering for title signals like Software Engineer II and normalized `experience_level` values of `mid` / `senior`.
- Expanded `worker/tests/unit/relevance-filter.test.ts` to cover allowed and blocked edge cases.

### Checks

- `cd worker && npm run test -- tests/unit/relevance-filter.test.ts` — 35 passed
- `cd worker && npm run build` — passed

### Gotcha

`cd worker && npm run build` emits `worker/dist/`; it is untracked build output and was removed after the check.

---

## 2026-05-18 — Worker GPT-5 nano temperature compatibility (Codex)

- Render worker logs at 2026-05-18 09:00 PDT showed `gpt-5-nano` rejecting `temperature: 0` in the normalizer with `unsupported_value`.
- Removed `temperature` from worker `gpt-5-nano` calls in normalizer and enrichment fallback. The API accepts the model default instead.
- Production logs also confirmed migration 19 resolved the `jobs.source='portal'` check-constraint issue: portal/search inserts are no longer being rejected.
- Brave Search is yielding candidates but mostly duplicates. The zero-result quoted ATS queries are likely low-value compared with broader career queries.

## 2026-05-18 — Feed/source test coverage (Codex)

- Added direct worker coverage for `filterNewJobs()` so portal/search dedupe behavior is now tested alongside raw GitHub entry dedupe.
- Added `/api/analytics` integration coverage for separate `github`, `portal`, and `manual` source breakdown counts.
- Route handler tests can take ~30s locally because the root Vitest jsdom environment startup dominates runtime, even when the test body is fast.

## 2026-05-15 — Workday autofill Phase 10B implementation (Claude Code)

**Commit:** (see git log for hash)

### Implemented

- `extension/src/shared/types.ts` — `ScannedField` interface + `SCAN_FORM`/`APPLY_SCANNED` message types
- `extension/src/content/fill.ts` — full rewrite:
  - `computeFills(profile, ats)` — read-only scan returning `ScannedField[]` with `WeakRef`
  - `applyFills(fields)` — DOM write pass consuming `computeFills` output
  - `isElementFillable(el)` — visibility + disabled/readonly guard
  - `WORKDAY_ID_MAP` — `data-automation-id` regex → profile resolver for 15+ field types
  - Shadow boundary climbing in `getLabelForInput` (3 hops max, 80 char guard)
  - `queryShadowScoped` — form-container scoped traversal with full-doc fallback
- `extension/src/sidebar/Sidebar.tsx` — scan-preview UI:
  - "Scan form" primary → preview list (label + source badge) → "Apply N fields"
  - "Auto-fill (skip preview)" secondary for single-click flow
  - Workday async combobox note in preview panel
- `extension/src/content/fill.test.ts` — 48 tests, all passing
- `extension/src/test/setup.ts` — `CSS.escape` polyfill (jsdom 29 does not expose global `CSS`)
- `PHASES.md` — Phase 10B added with task list
- `docs/` — AI_CONTEXT.md, HANDOFF.md, CURRENT_TASK.md created for Codex collaboration

### Root cause discovered: CSS.escape not in jsdom 29

`computeFills` builds selectors via `\`#${CSS.escape(input.id)}\``. jsdom 29 does not expose a global `CSS` object, so this threw `TypeError: Cannot read properties of undefined (reading 'escape')`. The `try/catch` silently dropped the field. Fixed by polyfilling `CSS.escape` in `setup.ts`.

### Remaining (Phase 10B.2+)

- Async Workday combobox fill (country, state, city)
- Real Workday smoke test + DOM fixture capture
- E2E Playwright test for scan → apply flow

---

## 2026-05-15 — Workday autofill plan + docs (Claude Code)

**Commit:** `d1517c7` (session start, no new commit from this session — docs only)

### Plan review

Ran `/plan-eng-review` on the Workday autofill feature. 6 architectural decisions, Codex outside voice incorporated.

Key decisions:
- **D1**: Defer async Workday combobox fill to Phase 2 (pending live testing)
- **D2**: Pre-computed scan preview (`computeFills` → show preview → user clicks Apply → `applyFills`)
- **D3**: `WORKDAY_AUTOMATION_ID_MAP` (data-automation-id primary) + shadow-boundary label fallback
- **D4**: `queryShadowAll` scoped to form containers + document fallback
- **D5**: Full fill.test.ts coverage (regression + new Workday paths)
- **D6**: Test on live Workday form before claiming full support

Codex raised: visibility filtering (no guards against hidden/off-step fields), WeakRef stability for element handles, form container scoping safety. All incorporated.

### What's planned (not yet implemented)

See `docs/CURRENT_TASK.md`. Implementation of fill.ts, types.ts, Sidebar.tsx, fill.test.ts is next.

---

## 2026-04-28 — Phase 10A auto-apply engine (Claude Code)

**Commits:** Multiple (phase 8 → CORS fix → extension improvements)

- Multi-page auto-advance via `chrome.storage.session` keyed by tabId
- Background service worker orchestrates Tier 1 + Tier 2 fills on navigation
- Sidebar React component with filling/review states
- Haiku Tier 2 for unfilled field analysis
- Sonnet Tier 3 for open-ended question answering
- `queryShadowAll` added for Workday Shadow DOM traversal (basic version)
- Skills field detection + "Improve skills" button
- CORS proxy middleware for extension API routes

---

## 2026-04-04 — Phase 10A design (Claude Code)

- Auto-apply engine design doc written (see `~/.gstack/projects/cs-keni-backlog/`)
- 3-tier LLM strategy decided: deterministic → Haiku → Sonnet
- Multi-page navigation architecture designed
- Workday scoped as "best-effort" (later upgraded to Phase 1 targeted effort 2026-05-15)
