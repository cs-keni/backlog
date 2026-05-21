# Handoff

> Whoever is picking this up — Claude Code or Codex — read this first. Then read `docs/CURRENT_TASK.md`.

---

## Session: 2026-05-21 — Quality pass: 84→90 grade improvements (Claude Code)

### What changed

- **5 new integration test suites** — keyword-gap, salary-playbook, jobs-feedback, source-preferences, ats-platform. 47 new tests; total now 211 (88 unit + 123 integration).
- **salary-playbook route refactored** — extracted `loadSalaryContext()` helper shared by GET and POST, replacing the internal `GET(new Request('http://localhost/...'))` self-call smell.
- **salary-playbook structured output** — POST now prompts for and parses JSON `{ recruiter_call, email_counter, deadline_extension }` instead of unstructured plain text.
- **SalaryPlaybook component** — tabbed script UI (Recruiter call / Email counter / Deadline extension) + skeleton while initial GET resolves.
- **KeywordGap component** — skeleton during initial fetch (was silently rendering `null`).
- **ResumeTailor component** — button shows "Loading…" and stays disabled during initial fetch.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/` — 211 passed (88 unit + 123 integration)

### Remaining high-value improvements (to reach 92+)

- Integration tests for cover-letter, resume/tailor, and star-responses routes
- E2E smoke test for Tracker detail panel (open application → see keyword gap skeleton → click Analyze)
- ApplicationDetail side panel: show skeleton while `detailMeta` is null (currently blank layout)

---

## Session: 2026-05-21 — Wave 3 remaining phases P2/P5/P0/P3 (Codex)

### What changed

- Implemented P2 per-ATS completeness:
  - Added migrations `031_applications_ats_platform.sql` and `032_users_ats_profile_fields.sql`.
  - Added ATS URL detection, completeness scoring, manual platform override route, and Tracker detail UI.
  - New applications detect ATS platform on insert without overwriting existing/manual rows.
- Implemented P5 negative relevance feedback:
  - Added migration `033_job_feedback.sql`.
  - Added `POST /api/jobs/feedback`, dismiss reason menu on Feed cards, and threshold-based soft filters.
  - Filters activate only at 5 matching signals for `too_far` and `wrong_stack`.
- Implemented P0 keyword gap analysis:
  - Added migration `034_keyword_gaps.sql`, prompt helper, `GET/POST /api/prep/keyword-gap`, and Tracker detail UI.
  - Resume replacement now invalidates cached keyword gaps.
- Implemented P3 salary negotiation playbook:
  - Added migration `035_users_comp_target.sql`.
  - Added static comp band lookup, `GET/POST /api/prep/salary-playbook`, and offer-only Tracker detail UI.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/ats-completeness.test.ts src/tests/unit/feedback-filters.test.ts src/tests/unit/keyword-gap-prompt.test.ts src/tests/unit/comp-bands.test.ts src/tests/unit/application-checklist.test.ts src/tests/unit/freshness.test.ts src/tests/unit/source-preferences.test.ts src/tests/unit/application-card.test.tsx` — 19 passed

### Remaining work

- Apply migrations `030` through `035` in Supabase before production use of Wave 3.
- Broader integration/regression pass is still recommended.

---

## Session: 2026-05-21 — Wave 3 P6/P8/P1/P7/P4 partial implementation (Codex)

### What changed

- Implemented P6 application packet checklist in Tracker detail, derived from resume, cover letter, interview kit, and applied date data.
- Implemented P8 company reuse banner in Tracker detail, backed by prior applications at the same company.
- Implemented P1 resume tailor UI against the actual existing route contract: `GET/POST /api/resume/tailor` with `job_id`, returning a PDF URL.
- Implemented P7 job freshness labels in Feed cards and Tracker detail using `jobs.fetched_at`.
- Implemented P4 source preferences:
  - Added `supabase/migrations/030_source_preferences.sql`.
  - Added `PUT /api/user/source-preferences`.
  - Added source preference merge helpers and tests.
  - Added pin/hide controls to Analytics source yield.
  - Hidden sources are excluded from the Feed query.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/application-checklist.test.ts src/tests/unit/freshness.test.ts src/tests/unit/source-preferences.test.ts src/tests/unit/application-card.test.tsx` — 9 passed

### Remaining work

- Continue Wave 3 at **P2 per-ATS completeness score**.
- Apply migration `030_source_preferences.sql` in Supabase before relying on P4 source preferences in production.
- Broader regression run still recommended after the remaining Wave 3 phases.

---

## Session: 2026-05-21 — Wave 3 planning + interview kit streaming fix (Claude Code)

### What changed

- **`src/app/api/prep/interview-kit/route.ts`** — fixed fake streaming. Replaced blocking `generateInterviewKit()` + simulated chunk loop with `anthropic.messages.stream()` piped directly to a `ReadableStream`. Tokens now appear within ~1-2s instead of after the full LLM response completes.
- **`src/tests/integration/interview-kit.test.ts`** — fixed mock: changed target to `@anthropic-ai/sdk`, used a plain constructor function (not arrow) for `MockAnthropic`, used plain function for `stream` so `vi.resetAllMocks()` doesn't clear the module-level singleton's method.
- **`docs/WAVE3_PLAN.md`** — written. Full Codex implementation spec for Wave 3 (9 phases). Read this before starting any Wave 3 phase.
- **`docs/PRIORITY.md`**, **`docs/AI_CONTEXT.md`**, **`docs/CURRENT_TASK.md`**, **`docs/ENGINEERING_LOG.md`** — updated to reflect Wave 3.

### What's next

**Wave 3 is ready to implement.** Full spec: `docs/WAVE3_PLAN.md`.

Execute phases in this order (each independently deployable):

| Phase | What | Notes |
|-------|------|-------|
| **P6** | Application packet checklist | No migration, no risk — start here |
| **P8** | Company reuse banner | Read-only query |
| **P1** | Resume tailor UI | Backend built — verify route contract before wiring UI |
| **P7** | Job freshness badge | Display only, `jobs.fetched_at` exists |
| **P4** | Source yield feedback loop | Migration 030 |
| **P2** | Per-ATS completeness score | Migrations 031, 032 |
| **P5** | Negative relevance feedback | Migration 033 |
| **P0** | ATS keyword gap analysis | Migration 034, LLM call (Haiku) |
| **P3** | Salary negotiation playbook | Migration 035, LLM call + static comp bands |

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/integration/interview-kit.test.ts src/tests/unit/interview-kit-prompt.test.ts` — passed

### Gotchas

- Wave 2 migrations 028 and 029 still need to be applied in Supabase for interview kit persistence in production.
- P1 resume tailor: read `src/app/api/resume/tailor/route.ts` before wiring the UI — confirm whether it streams or returns JSON/PDF, then adapt the UI accordingly.
- P2 ATS completeness: do NOT backfill existing `applications` rows. New applications only.
- P5 negative feedback: soft filters must NOT activate until N≥5 dismissals with the same reason.

---

## Session: 2026-05-21 — Wave 2 P4 interview day kit (Codex)

### What changed

- Added `supabase/migrations/029_interview_kits.sql`.
- Added interview-kit prompt/generation helper in `src/lib/llm/interview-kit.ts`.
- Added `POST/GET /api/prep/interview-kit` and `POST /api/prep/interview-kit/save`.
- Added `InterviewKit` component and rendered it in Tracker detail for `technical` and `final` applications.
- Added prompt, streaming route, and component tests.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/interview-kit-prompt.test.ts src/tests/integration/interview-kit.test.ts src/tests/unit/interview-kit-component.test.tsx` — 4 passed

### Remaining work

- Apply `supabase/migrations/028_add_dsa_track.sql` and `supabase/migrations/029_interview_kits.sql` in Supabase before relying on P1/P4 persistence in production.
- A broader regression run is still recommended after migrations are applied.

---

## Session: 2026-05-21 — Wave 2 P3 conversion analytics (Codex)

### What changed

- Added `src/lib/analytics/conversion.ts` for callback-rate breakdowns by company tier, title keyword, and source.
- Analytics API now returns `conversionStats` with total callbacks and filtered buckets requiring at least 2 applications.
- Added `ConversionStats` component and rendered it below the existing analytics charts.
- Added tests for FAANG callback rate, callback status counting, placeholder mode, stat-card rendering, and existing analytics API compatibility.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/conversion-stats.test.tsx src/tests/integration/analytics.test.ts` — 8 passed

### Remaining work

- P4 interview day kit is next. Use migration `029_interview_kits.sql`.

---

## Session: 2026-05-21 — Wave 2 P2 tracker health scores (Codex)

### What changed

- Added `src/lib/tracker/company-tier.ts` for FAANG/large/mid/startup tier detection.
- Added `src/lib/tracker/health.ts` for tier-specific response windows and green/yellow/red application health.
- Tracker `ApplicationCard` now shows a 6px health dot for `applied` cards with tooltip copy: days since application and typical response window.
- Added unit/component tests for tier detection, health scoring, and card health-dot rendering.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/tracker-health.test.ts src/tests/unit/application-card.test.tsx` — 6 passed

### Remaining work

- P3 callback-rate analytics breakdown is next.

---

## Session: 2026-05-21 — Wave 2 P1 DSA intelligence (Codex)

### What changed

- Added `supabase/migrations/028_add_dsa_track.sql` for `users.dsa_track`.
- Added `PATCH /api/dsa/track` with auth guard and `75 | 150 | 250` validation.
- Added Blind 75, NeetCode 150, and NeetCode 250 track sets in `src/lib/dsa/neetcode150.ts`; NeetCode 250 follows the official current per-pattern counts from `neetcode.io/practice/practice/neetcode250`.
- Added DSA track segmented control and persisted optimistic track switching.
- Filtered DSA Today, Calendar, Problem Logger, counts, recommendations, and solves by active track.
- Added interview-aware Today focus for open technical/final applications using `src/lib/dsa/company-patterns.ts`.
- Added tests for track datasets, recommendation compatibility, track API, company pattern matching, and TodayPanel interview focus.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/dsa-tracks.test.ts src/tests/unit/dsa-recommend.test.ts src/tests/unit/company-patterns.test.ts src/tests/unit/dsa-today-panel.test.tsx src/tests/integration/dsa-track.test.ts` — 22 passed
- `git diff --check` — passed

### Remaining work

- Apply `supabase/migrations/028_add_dsa_track.sql` in Supabase before relying on track persistence in production.
- P2 application health scores are next.

---

## Session: 2026-05-21 — Wave 2 P5 UX polish (Codex)

### What changed

- Feed job-card quick action now says `Mark Applied`; after success it shows disabled `✓ Applied`.
- DSA unsolved problem rows now say `Mark Solved`; solved rows show a non-action `✓ Solved` status.
- Tracker zero-application state now shows the Wave 2 guidance copy with Browse jobs and Log Application CTAs.
- Prep Story Bank heading now has `whitespace-nowrap` to prevent the uppercase letter-spacing wrap glitch.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed

### Remaining work

- P1 is next. Use `supabase/migrations/028_add_dsa_track.sql` for the DSA track migration.

---

## Session: 2026-05-21 — Wave 2 P0 bug fixes (Codex)

### What changed

- Fixed `POST /api/jobs/manual` to:
  - log serialized Supabase errors for company/job/application writes,
  - tolerate company profile upsert returning no row by falling back to a select,
  - reuse existing jobs on URL unique conflicts,
  - upsert duplicate user/job applications instead of failing,
  - avoid duplicate timeline rows when the status is unchanged.
- Added `supabase/migrations/027_allow_manual_job_url_null.sql` so manually logged jobs can omit a posting URL.
- Fixed the notification timezone select controlled-input warning by adding `onChange`.
- Made company enrichment provider failures best-effort: logs provider error metadata and returns the existing company row instead of surfacing a 500 to the UI.
- Added focused integration coverage for manual no-URL and duplicate-URL paths.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/integration/manual-jobs.test.ts` — 2 passed

### Remaining work

- Migration `027_allow_manual_job_url_null.sql` was applied in Supabase after this commit.
- Because P0 consumed migration `027`, use `028_add_dsa_track.sql` for P1 and `029_interview_kits.sql` for P4.

---

## Session: 2026-05-21 — Wave 2 planning (Claude Code)

### What happened

- Ran `/qa-only` on main — scored 77/100 (B+). Full report at `.gstack/qa-reports/qa-report-localhost-2026-05-21.md`.
- Ran `/plan-ceo-review` in SCOPE EXPANSION mode. Produced full spec for Wave 2.
- Wave 2 spec written to `docs/WAVE2_PLAN.md` — read this before implementing anything.

### What's ready to implement

Six phases, in order:

**P0 (bugs — ship these first):**
- BUG-001: `POST /api/jobs/manual` returns "Failed to create job" on new user save. Two likely causes (unique constraint or company_profiles null race) — add logging to diagnose first, then fix per decision tree in WAVE2_PLAN.md.
- BUG-002: Settings page emits "1 Issue" toast — `NotificationSettings.tsx:301` `<select>` has `value` + `onBlur` but no `onChange`. One-line fix.
- BUG-003: Company enrich API fires 500s from `JobDetail.tsx:82`. Add silent catch around the fire-and-forget; verify provider API key.

**P5 (UX polish — ship with P0):**
- Button label semantics: "Mark Applied" / "Mark Solved" (action verbs for unsolved state)
- Tracker empty state: guidance copy + CTA buttons when 0 applications
- "STORY BANK" CSS glitch: add `whitespace-nowrap` to the heading

**P1–P4:** DSA tracks (migration 028), interview-aware Today queue, application health scores, callback rate analytics, interview day kit (migration 029, streaming).

### No changes made to code this session

This was a pure planning session. No files edited except docs/.

---

## Session: 2026-05-21 — Polish Pass PP-1 through PP-4 (Codex)

### What changed

- PP-1 Notifications:
  - Added `supabase/migrations/026_add_notification_timezone.sql`.
  - Added notification timezone persistence through settings/profile APIs and a timezone selector in notification settings.
  - Updated worker notification quiet-hour evaluation to compare against each user's IANA timezone.
  - Added dispatcher unit coverage for timezone-specific pending vs sent behavior.
- PP-2 Analytics:
  - Added unauthenticated 401 coverage for `GET /api/analytics/company-graph`; existing happy path already covers graph shape/Jaccard output.
- PP-3 Interview Prep:
  - Added `src/tests/unit/llm-prompts.test.ts` for STAR builder, cover-letter generator, interview-guide generator, and extension answer-question prompt shape.
- PP-4 E2E:
  - Expanded all 5 existing Playwright specs to 40–60 LOC each with negative/boundary coverage.
  - Added E2E fixture branch for forced company refresh cooldown.
  - Deferred Anthropic-backed route imports in resume tailor and cover-letter routes so E2E fixture requests do not compile LLM paths.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `npm run test` — 120 passed
- `npm run test -- src/tests/integration/analytics.test.ts src/tests/unit/llm-prompts.test.ts` — 8 passed
- `cd worker && node node_modules/vitest/vitest.mjs run tests/unit/dispatcher.test.ts` — 13 passed
- `cd worker && node ../node_modules/typescript/bin/tsc --noEmit` — passed
- `cd worker && node node_modules/vitest/vitest.mjs run` — 117 passed
- `cd extension && npm test` — 84 passed
- `NEXT_PUBLIC_E2E_TEST_MODE=1 ... npx playwright test --reporter=line --workers=1` — 12 passed
- `git diff --check` — passed

### Notes / risks

- Apply `supabase/migrations/026_add_notification_timezone.sql` in Supabase before relying on per-user quiet-hour timezones in production.
- Local Playwright needed elevated execution for localhost binding and `--workers=1`; CI already uses one worker.
- Local `npm run lint` still fails because the repo has many existing lint errors and generated coverage/extension files are picked up; direct eslint reported pre-existing React Compiler warnings plus existing worker test `any` usage.
- Local `cd worker && npm test` still fails because the worker Vitest binary wrapper is broken in this workspace; direct `node node_modules/vitest/vitest.mjs run` passed.
- Browser logs still show pre-existing hydration warnings in feed/tracker (`button` nesting in feed filters and DnD described-by ids), but the E2E suite passes.
- GitHub Actions still needs to be watched after push.

---

## Polish Pass plan (Claude Code, 2026-05-20)

All P1–P3 phases are complete. A full grade review surfaced four remaining gaps. Codex owns all four — see `docs/CURRENT_TASK.md` § "Polish Pass" for full specs including migration SQL, file paths, and test patterns. Summary:

| Task | What to do |
|------|-----------|
| **PP-1 Timezone** | Add `notification_timezone` to `users` (migration 026), timezone picker in settings, update `isInQuietHours` to use user's local time |
| **PP-2 Graph test** | `GET /api/analytics/company-graph` integration test — happy path + auth guard |
| **PP-3 LLM prompt tests** | Unit tests for STAR, cover-letter, and question-answer prompts — mock SDK, assert shape |
| **PP-4 E2E depth** | Flesh out all 5 specs to 40–60 LOC; one error/negative test per spec |

Suggested order: PP-2 (15 min) → PP-1 (45 min) → PP-3 (30 min) → PP-4 (45 min).

Do all four before marking the polish pass complete. Claude Code has no remaining tasks in this pass.

---

## Session: 2026-05-20 — Phase 9 E2E + CI hardening (Codex)

### What changed

- Added cookie-gated E2E fixture mode (`NEXT_PUBLIC_E2E_TEST_MODE=1` + `backlog_e2e_user=1`) that bypasses Supabase only for Playwright-authenticated sessions.
- Added deterministic fixture data and mock responses for feed, tracker, prep questions, STAR responses, materials, and filter preset reads.
- Added Playwright global setup and Phase 9 specs:
  - `login-feed.spec.ts`
  - `tracker-drag.spec.ts`
  - `prep-star.spec.ts`
  - `bulk-tracker.spec.ts`
- Updated Playwright config to use the direct Next entrypoint, extend first-compile timeouts, and support optional extension loading from `extension/dist`.
- Updated GitHub E2E workflow to build/load the extension and use fixture-mode env vars instead of live Supabase/LLM secrets.
- Scoped root Vitest to app tests only; worker and extension tests remain in their dedicated CI steps.
- Added `@vitest/coverage-v8`, removed stale global 80% thresholds, and refreshed the extension lockfile so `npm ci` passes.

### Checks run

- `node node_modules/typescript/bin/tsc --noEmit` — passed
- `npm run test` — 115 passed
- `node node_modules/vitest/vitest.mjs run --coverage --reporter=json` — passed, coverage artifact generated
- `cd worker && node ../node_modules/typescript/bin/tsc --noEmit` — passed
- `cd worker && node node_modules/vitest/vitest.mjs run` — 115 passed
- `cd extension && npm ci` — passed
- `cd extension && node node_modules/vitest/vitest.mjs run` — 84 passed
- `cd extension && npm run build` — passed
- `NEXT_PUBLIC_E2E_TEST_MODE=1 ... npx playwright test --reporter=line` — 6 passed
- `node node_modules/next/dist/bin/next build` — passed

### Notes / risks

- Local standalone `cd extension && node node_modules/typescript/bin/tsc --noEmit` still reports pre-existing extension type errors; the GitHub workflow does not run that command.
- Local sandbox cannot bind the Next dev server port, so Playwright was run with elevated execution.
- GitHub Actions still needs to be watched after push.

---

## Session: 2026-05-20 — Phase 8b Easy/Hard SR buttons (Claude Code)

### What changed

- **`supabase/migrations/023_add_review_difficulty.sql`** — adds `difficulty text check (difficulty in ('easy', 'hard'))` nullable to `lc_reviews`
- **`src/lib/dsa/schedule.ts`** — `computeNextInterval(currentInterval, difficulty)` using Leitner ladder `[1, 3, 7, 14, 30]`; also exports `dateDiffDays` and `addDays` helpers
- **`src/app/api/dsa/reviews/[id]/route.ts`** — PATCH now accepts optional `{ difficulty }`. With difficulty: fetches current review + most recent prior completed review to compute `currentInterval`, marks done with `difficulty` stamped, inserts new `lc_reviews` row at `today + nextInterval`. Without difficulty: legacy behavior (mark `completed_at` only) — existing callers unaffected.
- **`src/components/dsa/TodayPanel.tsx`** — replaces single 28×28 checkmark button with Easy/Hard pair. Hard: both buttons disabled immediately → PATCH fires (parallel) → 300ms "↺ Back tomorrow" flash → `onReviewComplete` triggers exit. Easy: PATCH awaited → `onReviewComplete`. Both share the same `completing` Set for disabled state.
- **`src/lib/dsa/types.ts`** — `LcReview.difficulty: 'easy' | 'hard' | null`

### Checks run

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/unit/dsa-schedule.test.ts src/tests/integration/dsa-reviews.test.ts` — 18 passed (8 pre-existing + 8 new schedule + 2 new review difficulty tests)

### Known residuals

- Apply `supabase/migrations/023_add_review_difficulty.sql` in Supabase before difficulty stamping takes effect in production.
- Phase 9 (E2E Playwright infrastructure) is the only remaining P3 phase — Codex-owned.

---

## Session: 2026-05-20 — Phase 3b bulk action bar (Claude Code)

### What changed

- Added `POST /api/applications/batch` — ownership check, archive or status bulk update.
- Added `BulkActionBar` portal component: pill bar with spring animation, count badge, Archive button (optimistic + rollback), inline error, Escape to dismiss.
- `ApplicationCard` now accepts `selectMode` / `isBulkSelected`; drag disabled in select mode; checkbox overlay in top-right.
- `TrackerBoard` toolbar gets a "Select" button that activates select mode and hides the archive toggle. Card clicks toggle bulk selection in select mode; `AnimatePresence` wraps the bar for enter/exit animation.
- 3 integration tests for batch route (own IDs → 200, foreign ID → 403, empty → 422).

### Checks run

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts` — 17 passed

### Known residuals

- Phase 8b (Easy/Hard SR buttons) remains Claude-reserved.
- Codex can now pick up Phase 4, 5, 6, 2f/g, and 9.

---

## Session: 2026-05-20 — Phases 4, 5, 6, 2f/g (Codex)

### What changed

- Phase 4:
  - Split analytics UI out of `src/app/(app)/analytics/page.tsx` into focused components under `src/components/analytics`.
  - Moved company graph data fetch into the analytics page and made `CompanyGraph` render from provided data.
  - Added graph ghost-node loading/simulation-settling skeleton and fade-in after `onEngineStop`.
  - Added company graph Jaccard integration coverage.
- Phase 5:
  - Split question-bank UI into `QuestionList`, `CulturalSignals`, `QuestionsToAsk`, and `StoryMatch` components.
  - Added force re-enrich support to `POST /api/company/[id]/enrich` with a 24-hour cooldown.
  - Added “Refresh company data” UI in Prep with loading and cooldown/error messaging.
- Phase 6:
  - Replaced extension profile `select('*')` with an explicit profile column list.
  - Added explicit owner SELECT checks before PATCH/DELETE for work history, education, projects, and saved answers.
  - Added profile mutation integration tests, including resume upload text persistence and match-score invalidation.
- Phase 2f/g:
  - Extracted extension fill helpers into `fill-address.ts` and `fill-fields.ts`.
  - Extracted sidebar scan preview, filling, review, and error/debug export states into separate sidebar modules.

### Checks run

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/analytics.test.ts src/tests/integration/profile.test.ts src/tests/integration/applications.test.ts` — 28 passed
- `cd extension && node ../node_modules/vitest/dist/cli.js run src/content/fill.test.ts src/content/fill-workday.test.ts src/background/fill-proxy.test.ts --pool=threads` — 59 passed
- `cd extension && node node_modules/vite/dist/node/cli.js build && node node_modules/vite/dist/node/cli.js build --config vite.sidebar.config.ts` — passed
- `node node_modules/next/dist/bin/next build` — passed

### Known residuals

- Phase 8b remains Claude-reserved.
- Phase 9 E2E infrastructure/tests remain for Codex.

---

## End-of-day wrap — 2026-05-21 (Claude Code)

### State check

All P1 and P2 phases are complete. Git log confirms:
- `6780afd` Phase 8a (DSA daily_activity)
- `491b3d2` Phase 7 (filter presets + abort)
- `3e5119f` Phase 2b-2e (file upload, post-submit, initiate-from-backlog, debug export)
- `cf60859` Phase 2a (Workday comboboxes)
- `a513886` Phase 1 (notification dispatcher)

`CURRENT_TASK.md` updated: date → 2026-05-21, P3 table with owner column added.

### What's next (P3)

Suggested order for Codex: **3a → 4 → 5 → 6 → 2f/g → 9**

Claude Code picks up: **3b** (bulk action bar) and **8b** (Easy/Hard SR buttons) when available.

Pending Supabase migrations (apply before depending on them in production):
- `020_add_structured_address_fields.sql`
- `021_extension_answer_cache.sql`
- `024_add_daily_activity.sql`

---

## Session: 2026-05-20 — Phase 3a tracker integration tests (Codex)

### What changed

- Expanded `src/tests/integration/applications.test.ts` coverage for tracker status mutations:
  - status changes update `last_updated` and write a timeline row with `from_status`/`to_status`
  - unchanged status updates do not duplicate timeline entries
- Added extension apply integration coverage for:
  - untracked ATS URL creates a hidden job stub, application, and initial extension timeline row
  - Backlog-initiated saved application transitions to applied with one timeline row
  - failed extension API-key auth returns 401 without touching Supabase
- Kept extension-created jobs on `source: 'manual'` because the current `jobs.source` schema/type is `github | portal | manual`; the app already labels manual as “Pasted URLs or extension.”

### Checks run

- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts` — 14 passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed

### Known residuals

- Phase 3b remains Claude-reserved.
- The Playwright optimistic rollback coverage called out in the plan still belongs with E2E work; current code already has rollback on kanban drag failure, but no browser-level regression test was added in 3a.

---

## Session: 2026-05-21 — Phase 8a DSA counter drift fix (Codex)

### What changed

- Added `supabase/migrations/024_add_daily_activity.sql` with `daily_activity`, own-row RLS, and a `(user_id, problem_slug, date)` uniqueness guard.
- `POST /api/dsa/solves` now records a daily activity row after the `lc_solves` upsert:
  - first-time problem solve for that date gets `is_new_solve = true`
  - re-solve gets `is_new_solve = false`
  - duplicate same-day writes use `ignoreDuplicates` so a true first-solve row is not downgraded by a later re-solve.
- `/dsa` now derives `newSolvesToday` from `daily_activity` instead of `lc_solves.solved_at` / `created_at`.
- DSA solve logging passes API-returned `isNewSolve` through to the client count update.
- User confirmed `022_add_filter_presets.sql` has been applied in Supabase.

### Checks run

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/dsa-solves.test.ts src/tests/unit/dsa-schedule.test.ts src/tests/unit/dsa-recommend.test.ts` — 23 passed
- `node node_modules/next/dist/bin/next build` — passed

### Known residuals

- Apply `supabase/migrations/024_add_daily_activity.sql` in Supabase before relying on DSA new-today counts in production.
- Phase 8b remains Claude-reserved.

---

## Session: 2026-05-20 — Phase 7 job feed presets + abortable fetches (Codex)

### What changed

- **Phase 7a — Search debounce + abort**
  - Added a first-class feed `search` filter wired to `/api/jobs?search=...`.
  - Primary feed fetches now use `AbortController` and ignore stale responses, so fast filter/search changes do not race old results into the UI.
- **Phase 7b — Saved filter presets**
  - Added `supabase/migrations/022_add_filter_presets.sql` with `filter_presets`, RLS, versioned JSON schema check, and DB-level 20-preset trigger.
  - Added `GET /POST /api/filter-presets` and `DELETE /api/filter-presets/[id]`.
  - Filter sidebar can save current filters, apply presets by replacement, clear an active preset by clicking it again, and delete presets inline.
  - Preset chips follow the planned active/default/count/empty-state behavior.

### Checks run

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/filter-presets.test.ts src/tests/integration/jobs-feed.test.ts` — 17 passed
- `node node_modules/next/dist/bin/next build` — passed after rerun with network access for Google font fetches
- `git diff --check` — passed

### Known residuals

- `npm run build` still fails because the local `node_modules/.bin/next` wrapper cannot resolve `../server/require-hook`; the direct Next entrypoint works.
- User confirmed `supabase/migrations/022_add_filter_presets.sql` is applied in Supabase.
- Phase 2f/g remains deferred to P3.

---

## Session: 2026-05-20 — Phase 2b-2e extension core gaps (Codex)

### What changed

- **Phase 2b — File upload**
  - Added `FETCH_FILE` background proxy and focused proxy tests.
  - Added `fillFileInput()` / `fillFileInputs()` for resume and job-specific cover letter uploads.
  - Background fetch adds the extension API key for Backlog URLs, so generated cover-letter PDFs can be fetched through `/api/cover-letter/:id/pdf`.
  - `/api/applications?jobId=...` now supports extension API-key auth and returns a latest `cover_letter_url`.
  - `/api/cover-letter/:id/pdf` now accepts extension API-key auth.
- **Phase 2c — Post-submit detection**
  - Content script now reports `SUBMIT_ATTEMPTED` instead of immediately marking applied.
  - Background confirms Greenhouse, Lever, and Workday completion URL patterns before marking applied.
  - Generic submissions mark applied only after navigation to a page with no form.
  - `/api/extension/apply` accepts `jobId` / `applicationId` for Backlog-initiated applications.
- **Phase 2d — Initiate from Backlog**
  - Job detail action opens the job URL with `backlog_job_id` via `URL.searchParams`.
  - Background extracts/stores job context, strips the query param, and sidebar shows the job context badge.
  - `/api/jobs/:id` supports extension API-key auth and returns job URL/app context.
- **Phase 2e — Debug export**
  - Sidebar review/error states can download `backlog-debug-{timestamp}.json`.
  - Debug export redacts values to `[FILLED]`, `[SKIPPED]`, or `[SKIPPED: reason]`.

### Checks run

- `cd extension && node ../node_modules/vitest/dist/cli.js run src/content/fill.test.ts src/content/detect.test.ts src/background/fill-proxy.test.ts --pool=threads` — passed, 75 tests
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts src/tests/integration/jobs-feed.test.ts` — passed, 22 tests
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `cd extension && node node_modules/vite/dist/node/cli.js build && node node_modules/vite/dist/node/cli.js build --config vite.sidebar.config.ts` — passed
- `git diff --check` — passed

### Known residuals

- `cd extension && node node_modules/typescript/lib/tsc.js -p tsconfig.json --noEmit` still reports the pre-existing WeakRef/sidebar-css/popup issues noted by Claude during Phase 2a. No new Phase 2b-2e type errors appeared beyond those existing diagnostics.
- Phase 2f/g decomposition remains deferred to P3.

---

## Session: 2026-05-20 — Phase 2a: Workday async comboboxes (Claude Code)

### What changed

- **`extension/src/content/fill-workday.ts`** (new)
  - `fillWorkdayCombobox(container, value)` — MutationObserver, 1000ms timeout; observer set up BEFORE trigger.click() (click handlers fire synchronously, so mutation can happen before observer if order is wrong).
  - `waitForChildListChange(container, timeoutMs)` — cascade helper; resolves on first childList mutation or 300ms fallback.
- **`extension/src/content/fill.ts`**
  - `WORKDAY_COMBOBOX_MAP` expanded to 4 fields: Country, State/Province, Work Authorization, Phone Country Code.
  - `fillWorkdayComboboxes` handles country → state cascade and remaining comboboxes.
  - Removed `clickWorkdayCombobox` (polling); kept `waitForListboxOptions` for education degree picker (remove in Phase 2f).
- **`extension/src/content/fill-workday.test.ts`** (new) — 9 tests, all passing.

### Checks run

- `node ../node_modules/vitest/dist/cli.js run --pool=threads` — 74 tests passed (3 suites)
- `node node_modules/typescript/lib/tsc.js -p tsconfig.json --noEmit` — no new errors (pre-existing WeakRef/sidebar errors unchanged)
- `node node_modules/vite/dist/node/cli.js build` — passed (content.js 33kB)

### Required follow-up

- Phase 2b-2e are now implemented by Codex.
- Phase 2f/g decomposition remains deferred to P3.

---

## Session: 2026-05-20 — Phase 1 notifications (Codex)

### What changed

- **`supabase/migrations/025_notification_log_schema.sql`**
  - Adds `notification_log.status` and `notification_log.error`.
  - Adds `pending`, `sent`, `failed`, and `expired` statuses.
  - Uses a partial unique index for `status = 'sent'` on `(user_id, job_id, channel)` so failed rows can be retried.
- **`worker/src/notifications/dispatcher.ts`**
  - Reworked into a digest dispatcher with per-user/per-channel matching.
  - Dedupe checks only `status = 'sent'`.
  - Quiet-hour matches become `pending` rows and are retried on later worker runs.
  - Failed email/push delivery becomes `failed` rows and is retryable.
  - Push 404/410 deletes the dead subscription and logs `expired`.
  - Matching now uses Jaccard threshold plus saved profile filter fields: location, remote preference, and salary minimum.
- **`worker/src/notifications/email.ts` / `push.ts`**
  - Email digest lists up to 10 jobs and uses the planned subject format.
  - Email/push misconfiguration and provider errors now throw so the dispatcher records retryable failures instead of marking sent.
- **`worker/src/index.ts`**
  - Calls the dispatcher every aggregation run, even when zero new jobs were written, so pending/failed rows can retry.
- **`src/app/(app)/settings/page.tsx`**
  - Recent notification history now shows only sent rows.
- **`worker/tests/unit/dispatcher.test.ts`**
  - Covers quiet-hour pending rows, retry after quiet hours, failed-row retry, sent dedupe, filter matching, and expired push cleanup.

### Checks run

- `cd worker && node node_modules/vitest/dist/cli.js run tests/unit/dispatcher.test.ts tests/unit/discord.test.ts --pool=threads` — passed, 19 tests
- `cd worker && node ../node_modules/typescript/lib/tsc.js -p tsconfig.json` — passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `git diff --check` — passed

### Required follow-up

- Apply `supabase/migrations/025_notification_log_schema.sql` in Supabase before deploying this worker path.
- Add `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_SUBJECT` to the worker environment if push notifications should send. Missing VAPID config now produces retryable failed push rows.
- The planned file names under `src/lib/notifications/*` were not used because Resend/Web Push dependencies currently live in the worker package. The production dispatcher is in `worker/src/notifications/*`.
- Local npm binary wrappers for `vitest` and worker `tsc` were broken in this checkout; direct package entrypoints worked and are listed in `docs/CURRENT_TASK.md`.

---

## Session: 2026-05-19 — Grade boost planning (Claude Code)

### What changed

No implementation this session — pure planning. Three review passes completed:

- **CEO review** (scope + strategy): 22 accepted items, 5 cherry-picks, 2 adversarial rounds
- **Eng review** (architecture + tests): 10 decisions, 17 implementation tasks, 9 test coverage gaps closed
- **Design review** (UI/UX): 4 decisions made, 6 design specs added to plan

Full plan committed to **`docs/GRADE_BOOST_PLAN.md`**. Read it before implementing any phase — it has exact code shapes, test specs, and design specs all inline.

### Key design decisions made today

| Decision | Chosen | Rejected |
|----------|--------|---------|
| Bulk select activation | Toolbar "Select" button (toggle mode) | Hover-to-reveal checkboxes (broken on touch) |
| Filter preset apply | Replace all current filters | Merge with current filters |
| Easy/Hard button style | Icon + short text ("✓ Easy" / "↺ Hard") | Emoji (🔁) or icon-only |
| Hard button feedback | 300ms "Back tomorrow" flash before exit | Immediate silent exit |

### Required follow-up (no code written yet)

All of Phase 1–9 as described in `docs/GRADE_BOOST_PLAN.md`. Priority order in `docs/CURRENT_TASK.md`.

### Checks run

None — planning only.

---

## Session: 2026-05-18 — Extension answer cache (Codex)

### What changed

- **`supabase/migrations/021_extension_answer_cache.sql`**
  - Adds `extension_answer_cache` with a unique `(user_id, normalized_question)` key.
- **`src/app/api/extension/answer-question/route.ts`**
  - Keeps saved answers first.
  - Checks generated-answer cache second and returns `source: 'cached'` on hit.
  - Calls Sonnet only on cache miss, then upserts the generated answer.
  - Exports `normalizeQuestionForCache()` for regression testing.
- **`src/tests/unit/extension-answer-cache.test.ts`**
  - Covers cache question normalization.

### Checks run

- `npm run test -- src/tests/unit/extension-answer-cache.test.ts` — passed, 2 tests
- `npx tsc --noEmit` — passed

### Required follow-up

- Apply `supabase/migrations/021_extension_answer_cache.sql` in Supabase.
- The endpoint is rollout-tolerant: if migration 021 is not applied yet, cache lookup/write errors are ignored by the current flow and generation still works.

---

## Session: 2026-05-18 — Structured address fields (Codex)

### What changed

- **`supabase/migrations/020_add_structured_address_fields.sql`**
  - Adds nullable `users.street_address`, `users.city`, `users.state`, and `users.postal_code`.
  - Keeps legacy `users.address` as a display/fallback field.
- **`src/components/profile/ProfileClient.tsx`**
  - Adds structured address inputs to Personal Info.
  - Saves the structured fields and composes the legacy `address` value when possible.
- **`src/app/api/profile/route.ts`**
  - Allows structured address fields in profile PATCH updates.
- **`src/app/api/extension/profile/route.ts`**
  - Uses `select('*')` for the user profile so new fields flow to the extension once migration 020 exists.
- **`extension/src/content/fill.ts`**
  - Address autofill now prefers structured address fields.
  - Legacy `address` parsing remains as fallback for old profiles or pre-migration payloads.
- **Types/tests**
  - Updated web and extension profile types.
  - Added extension fill regression coverage for structured address fields.

### Checks run

- `cd extension && npm run test -- src/content/fill.test.ts` — passed, 45 tests
- `cd extension && npm run build` — passed
- `npx tsc --noEmit` — passed

### Required follow-up

- Apply `supabase/migrations/020_add_structured_address_fields.sql` in Supabase.
- After migration, update Kenny's profile with full street/city/state/postal values so Workday address fields stop relying on brittle parsing.

---

## Session: 2026-05-18 — Source yield analytics (Codex)

### What changed

- **`src/app/api/analytics/route.ts`**
  - Added `sourceYield`, grouped by `github`, `portal`, and `manual`.
  - Tracks applications, submitted, responses, interviews, offers, response rate, and interview rate by source.
  - Keeps unknown/legacy sources in the GitHub bucket, matching existing source-breakdown behavior.
- **`src/app/(app)/analytics/page.tsx`**
  - Added a compact "Source yield" section to compare outcomes by source.
- **`src/tests/integration/analytics.test.ts`**
  - Extended analytics coverage to assert source-yield output.

### Checks run

- `npm run test -- src/tests/integration/analytics.test.ts` — passed, 2 tests
- `npx tsc --noEmit` — passed

### Remaining work

- Source yield is now visible, but it is only as good as application statuses being kept current.
- Negative feedback reasons are still not implemented.

---

## Session: 2026-05-18 — Brave Portland discovery tuning (Codex)

### What changed

- **`worker/src/search/brave.ts`**
  - Reordered default Brave queries based on production logs:
    - broad `"associate software engineer" "careers"` and `"early career software engineer" "careers"` queries now run first.
    - Portland-specific and remote-specific entry-level SWE queries are now inside the default 8-query budget.
    - low-yield quoted new-grad ATS queries are still available later but no longer consume default budget.
  - Added per-query metrics:
    - raw result count
    - candidate URL count
    - duplicate candidate count
    - extracted job count
    - skipped-by-experience count
    - accepted job count
  - Logs a compact per-query summary after extraction so the next Render run can show exactly which queries deserve budget.
- **`worker/tests/unit/brave-search.test.ts`**
  - Added coverage for default query ordering, Portland inclusion, and keeping low-yield new-grad ATS queries outside the default budget.

### Checks run

- `cd worker && npm run test -- tests/unit/brave-search.test.ts` — passed, 13 tests
- `cd worker && npm run build` — passed

### Next production check

- Watch the next Render run for the new `[brave-search] Per-query summary`.
- Keep queries with accepted jobs or strong candidate/extracted counts.
- Replace any default-budget query that repeatedly has `raw 0` or `candidates 0`.

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
