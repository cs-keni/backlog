# Engineering Log

Reverse-chronological. One entry per meaningful session.

---

## 2026-05-21 — Wave 2 P5 UX polish (Codex)

### Implemented

- Updated Feed card quick apply wording from `✓ Applied` to `Mark Applied`, with disabled `✓ Applied` after success.
- Updated DSA problem rows from action-style solved wording to `Mark Solved` for unsolved rows and `✓ Solved` for solved rows.
- Replaced Tracker empty-state copy/actions with the Wave 2 browse/log CTAs.
- Added `whitespace-nowrap` to the Prep Story Bank heading.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed

---

## 2026-05-21 — Wave 2 P0 bug fixes (Codex)

### Implemented

- Hardened `POST /api/jobs/manual` against company upsert misses, duplicate job URLs, duplicate user/job applications, and no-URL manual jobs.
- Added `supabase/migrations/027_allow_manual_job_url_null.sql`.
- Added `onChange` to the notification timezone select to stop React controlled-input warnings.
- Made company enrichment provider failures return existing company data instead of a UI-visible 500.
- Added `src/tests/integration/manual-jobs.test.ts` for no-URL and duplicate-URL manual job paths.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/integration/manual-jobs.test.ts` — 2 passed

### Gotchas

- Wave 2 migration numbering shifted: P1 DSA track should use `028_add_dsa_track.sql`; P4 interview kits should use `029_interview_kits.sql`.
- Migration 027 was applied in Supabase after the P0 commit.

---

## 2026-05-21 — Wave 2 planning + docs cleanup (Claude Code)

### What changed

- Ran `/qa-only` on main branch. QA score: **77/100 (B+)**. Full report: `.gstack/qa-reports/qa-report-localhost-2026-05-21.md`.
- Ran `/plan-ceo-review` in SCOPE EXPANSION mode. Produced Wave 2 plan.
- **Wave 2 spec written to `docs/WAVE2_PLAN.md`** — full implementation spec for all 6 phases.
- Docs cleanup: deleted `GRADE_BOOST_PLAN.md` (complete), rewrote `PRIORITY.md`, pruned `CODEX_IDEAS.md`, updated `AI_CONTEXT.md`, added Wave 2 deferred items to `TODOS.md`.
- Commit: `9effe14`

### Wave 2 scope accepted

| Phase | What |
|-------|------|
| P0 | Fix Log Application, Settings toast, company enrich 500s |
| P5 | Button labels, Tracker empty state, STORY BANK CSS |
| P1 | DSA track modes 75/150/250 + interview-aware Today queue |
| P2 | Application health scores on Tracker cards |
| P3 | Callback rate analytics breakdown |
| P4 | Interview day kit (streaming LLM brief) |

### No code changes

Planning session only. All phases ready for Codex to implement from `docs/WAVE2_PLAN.md`.

### Known issues for next session

- BUG-001 root cause not yet confirmed — add server logging first, then fix per decision tree in WAVE2_PLAN.md.
- Migrations 020 and 021 are written but not applied in Supabase. Apply before relying on address fields or extension answer cache.

---

## 2026-05-20 — Phase 9 E2E and CI hardening (Codex)

### Implemented

- Added E2E fixture mode guarded by both `NEXT_PUBLIC_E2E_TEST_MODE=1` and the `backlog_e2e_user=1` cookie.
- Added fixture APIs/data for Playwright coverage of feed, tracker drag, prep STAR generation/save, and tracker bulk archive.
- Added `e2e/global-setup.ts`, `src/tests/e2e/fixtures/llm-mock.ts`, and four Phase 9 Playwright specs.
- Updated Playwright to invoke `node node_modules/next/dist/bin/next dev` directly and to optionally load `extension/dist`.
- Updated GitHub E2E workflow to install/build the extension and run with deterministic local fixture env vars.
- Scoped root Vitest to app tests so worker/extension suites are not duplicated in the root app job.
- Added missing `@vitest/coverage-v8`, removed stale 80% coverage thresholds, and refreshed `extension/package-lock.json` so CI `npm ci` works.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit` — passed
- `npm run test` — 115 passed
- `node node_modules/vitest/vitest.mjs run --coverage --reporter=json` — passed
- `cd worker && node ../node_modules/typescript/bin/tsc --noEmit` — passed
- `cd worker && node node_modules/vitest/vitest.mjs run` — 115 passed
- `cd extension && npm ci` — passed
- `cd extension && node node_modules/vitest/vitest.mjs run` — 84 passed
- `cd extension && npm run build` — passed
- `NEXT_PUBLIC_E2E_TEST_MODE=1 ... npx playwright test --reporter=line` — 6 passed
- `node node_modules/next/dist/bin/next build` — passed

### Gotchas

- The root `vitest` wrapper was fixed after root `npm install`, but direct entrypoints remain more reliable in this WSL checkout.
- The extension has pre-existing standalone typecheck failures; CI only runs extension tests and build.
- Playwright requires elevated execution locally because the sandbox blocks binding the Next dev server port.

---

## 2026-05-20 — Phase 3b: Bulk action bar (Claude Code)

### What happened

Codex completed Phase 3a (tracker integration tests). Picked up Phase 3b as reserved.

### Commit

`cc6c7a2` — Implement Phase 3b: bulk action bar (select mode + batch archive)

### What changed

- **`src/app/api/applications/batch/route.ts`** (new)
  - `POST /api/applications/batch` — accepts `{ ids, action: 'archive' | 'status', status? }`
  - Ownership check: queries all IDs filtered by `user_id` before any write; returns 403 if count < ids.length
  - 422 on empty ids or invalid action/status; 200 with `{ updated: N }` on success
- **`src/components/tracker/BulkActionBar.tsx`** (new)
  - Portal render via `createPortal(…, document.body)` to escape overflow:hidden ancestors
  - Pill bar: count badge, divider, Archive button (spinner on in-flight), inline error, dismiss ×
  - Spring animation: `stiffness 350, damping 35` (matches existing detail panel)
  - `position: fixed; bottom: max(24px, calc(env(safe-area-inset-bottom) + 8px))` for safe area
  - Escape key → dismiss (useEffect listener attached/cleaned on mount)
- **`src/components/tracker/ApplicationCard.tsx`**
  - Added `selectMode` and `isBulkSelected` props
  - `useDraggable` disabled when `selectMode` is true (prevents accidental drag during multi-select)
  - Checkbox overlay (absolute top-right) shown only in select mode; filled blue when selected
  - Bulk-selected card style: `bg-zinc-900/80 ring-1 ring-blue-500/40`
- **`src/components/tracker/TrackerBoard.tsx`**
  - Select mode state + selectedIds Set + bulkLoading + bulkError
  - "Select" button in toolbar (right of archive toggle); shows "Cancel · N selected" when active
  - Archive toggle hidden while in select mode (avoids conflicting affordances)
  - Kanban card clicks route to `toggleBulkSelect` in select mode, detail panel selection otherwise
  - `handleBulkArchive`: optimistic archive → POST batch → rollback on failure → 2s error then clear
  - `AnimatePresence` wraps BulkActionBar for enter/exit spring animation
- **`src/tests/integration/applications.test.ts`**
  - 3 new tests: own IDs → 200, foreign ID → 403, empty → 422

### Checks run

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts` — 17 passed (14 pre-existing + 3 new)

---

## 2026-05-20 — Phase 2a: Workday async comboboxes (Claude Code)

### What happened

Reviewed Codex's Phase 1 notification dispatcher (clean, approved). Implemented Phase 2a.

### Commit

`cf60859` — Implement Phase 2a: Workday async combobox fills (country/state cascade)

### What changed

- **`extension/src/content/fill-workday.ts`** (new)
  - `fillWorkdayCombobox(container, value)` — MutationObserver-based, 1000ms timeout; observer attaches before `trigger.click()` (critical: click handler may append options synchronously, so observer must pre-exist the click).
  - `waitForChildListChange(container, timeoutMs)` — resolves on first childList mutation or timeout fallback; drives the country → state cascade.
- **`extension/src/content/fill.ts`**
  - `WORKDAY_COMBOBOX_MAP` now has 4 entries: Country, State/Province, Work Authorization, Phone Country Code. Was state-only. Removed `buttonSelector` (no longer needed; trigger discovery is inside `fillWorkdayCombobox`).
  - `fillWorkdayComboboxes` runs country → state cascade (fill country → `waitForChildListChange(stateContainer, 300)` → fill state) then processes remaining entries.
  - Removed `clickWorkdayCombobox` (polling approach replaced). Kept `waitForListboxOptions` for the education degree picker in `fillWorkdayEducationInternal` — will be removed in Phase 2f.
- **`extension/src/content/fill-workday.test.ts`** (new)
  - 9 tests: exact match, case-insensitive, starts-with fallback, no trigger, no match, 1000ms timeout, childList mutation detection, fallback timeout, full cascade sequence.

### Key gotcha discovered

In jsdom (and real browsers), click event handlers fire synchronously. If the handler appends option elements to `document.body`, the mutation happens before the MutationObserver is set up — if you call `trigger.click()` before `observer.observe()`. Fix: always attach the observer BEFORE clicking the trigger.

### Phase 1 review notes

Codex's dispatcher is solid. One edge case worth knowing: when `pushResult.expired > 0` AND `pushResult.delivered` is true, `logStatusRows` writes both `expired` and `sent` rows for the same (user_id, job_id, channel='push') — the expired rows are noise but don't break dedup (unique index only covers `status='sent'`). Not blocking.

### What's next

Phase 2b (file upload FETCH_FILE protocol) is Codex-owned. Phase 3b (bulk action bar) and Phase 8b (Easy/Hard SR buttons) are reserved for Claude Code.

---

## 2026-05-19 — Grade boost planning (Claude Code)

### What happened

Planning-only session. Three full review passes completed (CEO + Eng + Design). No code written.

Full plan committed to `docs/GRADE_BOOST_PLAN.md`. Start there.

### Key decisions

- Notification dedup query must use `WHERE status='sent'` — failed rows must not block retry
- `daily_activity` table (migration 024) fixes DSA counter drift — `solved_at` overwrite bug makes any lc_solves derivation wrong
- Bulk select: toolbar "Select" button activates mode, NOT hover-to-reveal (hover is broken on touch)
- Filter preset apply = replace (not merge)
- Easy/Hard SR buttons: icon + text, Hard shows 300ms "Back tomorrow" flash before card exits
- Ownership checks on mutation routes must use explicit SELECT + 403, not rely on RLS (RLS returns 404 silently)
- Extension cover letter source: job-specific, fetched from `/api/applications?jobId=X` — not profile-level
- Initiate-from-Backlog URL construction: use `URL.searchParams.set()`, not string concat

### Migrations needed (not yet written)

- `022_add_filter_presets.sql`
- `023_add_review_difficulty.sql`
- `024_add_daily_activity.sql`
- `025_notification_log_schema.sql`

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

## 2026-05-18 — Extension answer cache (Codex)

- Added `extension_answer_cache` for generated open-ended application answers.
- `/api/extension/answer-question` resolution order is now saved answer → cached generated answer → Sonnet generation.
- Cache keys use normalized question text, so punctuation/casing differences reuse answers.
- Migration 021 must be applied in Supabase to enable cache persistence.

## 2026-05-18 — Structured address fields (Codex)

- Added nullable structured address fields on `users`: `street_address`, `city`, `state`, `postal_code`.
- Extension autofill now prefers structured address values over parsing the legacy `address` string, with legacy parsing kept as fallback.
- Migration 020 must be applied in Supabase before the new profile fields can be saved in production.

## 2026-05-18 — Source yield analytics (Codex)

- Added analytics source-yield grouping so GitHub, portal/search, and manual sources can be compared by submitted applications, responses, interviews, and offers.
- Unknown/legacy job sources intentionally fall into the GitHub bucket to preserve the existing source-breakdown behavior.
- Source yield is all-time across applications, while the feed source breakdown remains range-limited to jobs fetched in the selected window.

## 2026-05-18 — Brave Portland discovery tuning (Codex)

- Reordered Brave default query budget around the production-observed winners: broad career queries produced candidates, while quoted new-grad ATS queries returned zero raw results.
- Added Portland-specific and remote-specific entry-level SWE search queries to the default 8-query budget.
- Added per-query Brave metrics so future Render logs can show which queries produced raw results, candidate URLs, extracted jobs, and accepted jobs.

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

## 2026-05-20 — Phase 1 notification dispatcher (Codex)

### Implemented

- Added `supabase/migrations/025_notification_log_schema.sql` with `notification_log.status`, `error`, retry indexes, and a sent-only partial unique index for `(user_id, job_id, channel)`.
- Reworked `worker/src/notifications/dispatcher.ts` into a digest dispatcher:
  - one email/push digest per user/channel/run
  - Jaccard threshold plus profile filter matching
  - quiet-hour matches recorded as `pending`
  - `failed` rows retry on later worker runs
  - `sent` rows are the only dedupe blocker
  - push 404/410 deletes expired subscriptions and logs `expired`
- Updated email/push senders to throw on misconfiguration/provider failure so the dispatcher records retryable failures.
- Worker now invokes the dispatcher every run, including zero-write runs, so pending/failed notifications are not stranded.
- Settings recent-notification history filters to `status = 'sent'`.

### Checks

- `cd worker && node node_modules/vitest/dist/cli.js run tests/unit/dispatcher.test.ts tests/unit/discord.test.ts --pool=threads` — 19 passed
- `cd worker && node ../node_modules/typescript/lib/tsc.js -p tsconfig.json` — passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `git diff --check` — passed

### Gotchas

- The plan mentioned `src/lib/notifications/*`, but Resend/Web Push are worker dependencies, so the implementation stays in `worker/src/notifications/*`.
- A full unique constraint on `(user_id, job_id, channel)` conflicts with failed-row retry. Migration 025 uses a partial unique index where `status = 'sent'` instead.
- Local npm binary wrappers for `vitest` and worker `tsc` are broken in this checkout; direct package entrypoints worked.

## 2026-05-20 — Phase 2b-2e extension core gaps (Codex)

### Implemented

- Added extension `FETCH_FILE` background proxy and content-side file upload helpers for resume and job-specific cover letter inputs.
- Added extension API-key support to `/api/jobs/:id`, `/api/applications?jobId=...`, and `/api/cover-letter/:id/pdf` so the extension can hydrate job context and fetch generated cover-letter PDFs.
- Changed Backlog feed apply action to open ATS URLs with `backlog_job_id` using `URL.searchParams`; background stores job context and strips the param.
- Replaced immediate submit-click applied marking with a submit-attempt → confirmation-detection flow:
  - Greenhouse `/applications/confirmation`
  - Lever `/apply/confirmation`
  - Workday `/applied`
  - Generic navigation followed by no remaining `<form>`
- Added sidebar job context badge and debug JSON export in review/error states.

### Checks

- `cd extension && node ../node_modules/vitest/dist/cli.js run src/content/fill.test.ts src/content/detect.test.ts src/background/fill-proxy.test.ts --pool=threads` — 75 passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts src/tests/integration/jobs-feed.test.ts` — 22 passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `cd extension && node node_modules/vite/dist/node/cli.js build && node node_modules/vite/dist/node/cli.js build --config vite.sidebar.config.ts` — passed
- `git diff --check` — passed

### Gotchas

- Extension `tsc --noEmit` still reports the same pre-existing WeakRef/sidebar-css/popup diagnostics from Phase 2a; production Vite builds pass.
- Cover letter upload depends on an existing generated cover letter for the Backlog job; otherwise it is skipped and included in debug export/manual-input review.
- Phase 2f/g decomposition is still not done and should remain P3.

## 2026-05-20 — Phase 7 job feed presets + abortable fetches (Codex)

### Implemented

- Added feed `search` to `FeedFilters`, query param construction, and the filter sidebar UI.
- Added `AbortController` handling for primary feed fetches so debounced search/filter/sort changes cancel stale in-flight requests.
- Added `supabase/migrations/022_add_filter_presets.sql` with:
  - `filter_presets` table
  - versioned JSON check (`filters.version = 1`)
  - RLS policies scoped to `auth.uid()`
  - DB-level 20-preset BEFORE INSERT trigger
- Added `/api/filter-presets` GET/POST and `/api/filter-presets/[id]` DELETE with auth, schema validation, max-20 API check, and 50-char name validation.
- Added saved preset UI in `FilterSidebar`: save modal, replacement apply behavior, active chip state, click-active-to-clear, inline delete, empty state, and 10+ count badge.

### Checks

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/filter-presets.test.ts src/tests/integration/jobs-feed.test.ts` — 17 passed
- `node node_modules/next/dist/bin/next build` — passed after rerun with network access for Google font fetches
- `git diff --check` — passed

### Gotchas

- `npm run build` still fails because `node_modules/.bin/next` cannot resolve `../server/require-hook`; direct `node node_modules/next/dist/bin/next build` works.
- User confirmed migration 022 is applied in Supabase.

## 2026-05-21 — Phase 8a DSA counter drift fix (Codex)

### Implemented

- Added `supabase/migrations/024_add_daily_activity.sql` with `daily_activity`, own-row RLS, `(user_id, problem_slug, date)` uniqueness, and an index for new-solve counts.
- Updated `POST /api/dsa/solves` to write a daily activity row based on whether the `lc_solves` row existed before the upsert.
- Used duplicate-ignore activity upserts so a same-day re-solve cannot downgrade an earlier `is_new_solve = true` first-solve row.
- Updated `/dsa` server page to derive `newSolvesToday` from `daily_activity` count for today instead of `lc_solves` timestamps.
- Updated DSA client solve logging so the UI count increments only when the API returns `isNewSolve: true` for today.

### Checks

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/dsa-solves.test.ts src/tests/unit/dsa-schedule.test.ts src/tests/unit/dsa-recommend.test.ts` — 23 passed
- `node node_modules/next/dist/bin/next build` — passed

### Gotchas

- Migration 024 is written but still needs to be applied in Supabase.
- Phase 8b remains Claude-reserved.

## 2026-05-20 — Phase 3a tracker integration tests (Codex)

### Implemented

- Expanded `src/tests/integration/applications.test.ts` so status mutation tests assert `last_updated` and exact timeline payloads, not just insert call counts.
- Added `/api/extension/apply` integration coverage for extension-created applications:
  - unknown URL creates a hidden job stub, application row, and extension timeline row
  - explicit saved application ID transitions to applied with one timeline row
  - invalid extension API key short-circuits before Supabase access

### Checks

- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts` — 14 passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed

### Gotchas

- Extension-created job stubs still use `source: 'manual'` because migration 019 and the app type union only allow `github | portal | manual`; analytics already presents manual as pasted URLs or extension.
- Playwright rollback coverage remains for the later E2E phase.

## 2026-05-20 — Phases 4, 5, 6, 2f/g (Codex)

### Implemented

- Analytics UI split into focused `src/components/analytics/*` modules; analytics page now owns both analytics and company graph fetches.
- `CompanyGraph` now renders a graph-specific ghost-node skeleton during data load/simulation settle and fades the canvas in after `onEngineStop`.
- Prep question bank split into `QuestionList`, `CulturalSignals`, `QuestionsToAsk`, and `StoryMatch` modules.
- Company enrich endpoint accepts `{ force: true }`, bypasses the stale-data short circuit, and returns 429 when refreshed within the last 24 hours.
- Prep company panel has a refresh button with loading and inline cooldown/error states.
- Extension profile endpoint no longer uses `select('*')`; it selects only the fields needed by the extension.
- Work history, education, projects, and saved answers PATCH/DELETE routes explicitly read `user_id` before mutation and return 403 for foreign rows.
- Extension fill helpers split into `fill-address.ts` and `fill-fields.ts`; sidebar scan/fill/review/error states split into separate modules.

### Checks

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/analytics.test.ts src/tests/integration/profile.test.ts src/tests/integration/applications.test.ts` — 28 passed
- `cd extension && node ../node_modules/vitest/dist/cli.js run src/content/fill.test.ts src/content/fill-workday.test.ts src/background/fill-proxy.test.ts --pool=threads` — 59 passed
- `cd extension && node node_modules/vite/dist/node/cli.js build && node node_modules/vite/dist/node/cli.js build --config vite.sidebar.config.ts` — passed
- `node node_modules/next/dist/bin/next build` — passed

### Gotchas

- The profile ownership checks intentionally query by raw row id before mutation instead of relying on `.eq('user_id', user.id)` filtering, so foreign-row attempts return 403 rather than RLS-style 404.
- The resume route test uses a mocked Request-like object for `formData()` because jsdom/FormData can produce a different Blob realm than the route’s `instanceof Blob` check.

## 2026-05-21 — Polish Pass PP-1 through PP-4 (Codex)

### Implemented

- Added user `notification_timezone` migration and wired notification settings/profile APIs plus the settings timezone picker.
- Worker dispatcher now evaluates quiet hours in each user's IANA timezone and has timezone-specific unit coverage.
- Company graph integration coverage now includes unauthenticated 401 behavior.
- Added LLM prompt-shape tests for STAR generation, cover letters, interview guides, and extension answer-question cache misses.
- Expanded all five Playwright E2E specs to 40–60 LOC with negative/boundary coverage.
- Added an E2E fixture path for forced company refresh cooldown responses.
- Deferred Anthropic-backed imports in resume tailor and cover-letter routes so fixture-mode GET/POST requests do not compile LLM paths.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `npm run test` — 120 passed
- `npm run test -- src/tests/integration/analytics.test.ts src/tests/unit/llm-prompts.test.ts` — 8 passed
- `cd worker && node node_modules/vitest/vitest.mjs run tests/unit/dispatcher.test.ts` — 13 passed
- `cd worker && node ../node_modules/typescript/bin/tsc --noEmit` — passed
- `cd worker && node node_modules/vitest/vitest.mjs run` — 117 passed
- `cd extension && npm test` — 84 passed
- `NEXT_PUBLIC_E2E_TEST_MODE=1 ... npx playwright test --reporter=line --workers=1` — 12 passed
- `git diff --check` — passed

### Gotchas

- Migration 026 is written but still needs to be applied in Supabase.
- Local Playwright should use `--workers=1` for this repo; parallel Next dev workers produced intermittent chunk-load failures in the local WSL workspace.
- `npm run lint` still fails on existing repo lint debt/generated files; direct eslint also reports existing React Compiler issues outside this pass.
- `cd worker && npm test` still fails locally because the worker Vitest binary wrapper points at `node_modules/.bin/dist/cli.js`; use `node node_modules/vitest/vitest.mjs run`.
- Existing browser hydration warnings remain in feed/tracker, but they are not new to this polish pass and do not fail the suite.
