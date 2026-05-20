# Current Task

**Last updated:** 2026-05-20
**Status:** All P1–P3 phases complete. Polish Pass in progress — closing the remaining gaps between A- and clean A.

---

## Active plan: Grade Boost — All Sections to A

Full spec is in **`docs/GRADE_BOOST_PLAN.md`**. Read it before starting any phase. It contains:
- Architecture decisions with exact code shapes
- Design specs for every new UI element (bulk action bar, preset chips, Easy/Hard buttons, etc.)
- Test specs per phase
- Migration file names

---

## Agent ownership

Some phases are reserved for Claude Code due to animation sequencing, subtle DOM interaction, or "feels right" judgment that's hard to verify without live testing. Do not implement reserved phases — leave them for Claude Code.

| Phase | Owner | Reason |
|-------|-------|--------|
| Phase 2a — Workday comboboxes | **Claude Code** | MutationObserver timing + country→state cascade only surfaces bugs on real Workday pages, not unit tests |
| Phase 3b — Bulk action bar UI | **Claude Code** | Framer Motion spring + DnD interaction with select mode + portal need to feel right in motion |
| Phase 8b — Easy/Hard SR buttons | **Claude Code** | 300ms Hard flash sequence is a tight state machine; wrong sequencing causes double-fires or broken feel |
| Everything else | **Codex** | Specs are complete; API routes, migrations, tests, decompositions are mechanical |

---

## Implementation priority

### P1 — Core loop broken (do these first)
- **Phase 1** — Notification dispatcher (email + push + dedup + quiet hours) — **implemented; migration applied in Supabase**
  - Implemented in worker notification modules: `worker/src/notifications/dispatcher.ts`, `email.ts`, `push.ts`
  - Migration written: `supabase/migrations/025_notification_log_schema.sql`
- **Phase 2a** — Workday async comboboxes — **implemented** (`extension/src/content/fill-workday.ts`, commit `cf60859`)
- **Phase 2b** — File upload FETCH_FILE protocol — **implemented**

### P2 — High leverage, low risk
- **Phase 2c** — Post-submit detection → mark Applied — **implemented**
- **Phase 2d** — Initiate from Backlog (URL param + background fetch + sidebar badge) — **implemented**
- **Phase 2e** — Extension debug export button — **implemented**
- **Phase 7** — Abort controller + saved filter presets — **implemented**
- **Phase 8a** — DSA counter drift fix (daily_activity table, migration 024) — **implemented**

### P3 — Quality + maintainability
Suggested order: 3a → 3b → 4 → 5 → 6 → 2f/g → 8b → 9

| Phase | Owner | Status |
|-------|-------|--------|
| **Phase 3a** — Tracker integration tests | Codex | implemented |
| **Phase 3b** — Bulk action bar UI (floating action bar, portal, Framer Motion) | **Claude Code** | implemented |
| **Phase 4** — Analytics decomposition + company graph skeleton | Codex | implemented |
| **Phase 5** — Prep decomposition + re-enrich button | Codex | implemented |
| **Phase 6** — Profile security (scoped SELECT + ownership tests) | Codex | implemented |
| **Phase 2f/g** — fill.ts + Sidebar.tsx decomposition | Codex | implemented |
| **Phase 8b** — Easy/Hard SR buttons (300ms flash state machine, migration 023) | **Claude Code** | implemented |
| **Phase 9** — E2E tests (Playwright global setup) | Codex | implemented |

---

## Polish Pass — Closing A- → A Gaps

Full grade review completed 2026-05-20. Every section is A- or better. Four gaps remain before everything is a clean A.

### Grade snapshot (post Phase 9)

| Section | Grade | Gap |
|---------|-------|-----|
| Notifications | A- | Quiet hours check is UTC-only — no per-user timezone |
| Extension | A | No code gap; manual Workday smoke test is the only remaining step (Kenny) |
| Application Tracker | A | — |
| Analytics | A- | No integration test for `GET /api/analytics/company-graph` |
| Interview Prep | A- | Phase 5c LLM prompt unit tests never landed |
| Profile | A | — |
| Job Feed | A | — |
| DSA | A | — |
| E2E | B+ | 5 specs at ~20 LOC each — happy paths only, no error paths, no negative tests |

### Polish Pass task list

| Task | Owner | Effort | Section |
|------|-------|--------|---------|
| **PP-1** Timezone-aware quiet hours: add `notification_timezone` to `users` table (migration `026`), timezone picker in notification settings, update `isInQuietHours` to convert UTC now → user local time | **Codex** | M | Notifications |
| **PP-2** Company-graph integration test: `GET /api/analytics/company-graph` returns `{ nodes, edges }` with correct Jaccard — happy path + auth guard | **Codex** | S | Analytics |
| **PP-3** LLM prompt unit tests: mock Anthropic SDK at transport via MSW; assert prompt shape (not response content) for STAR builder, cover letter generator, and question generator | **Codex** | M | Interview Prep |
| **PP-4** E2E depth: flesh out all 5 existing specs to 40–60 LOC each; add at least one error/negative test per spec (bad auth redirect, empty selection, filter with no results, failed drag rollback) | **Codex** | M | E2E |

### PP-1 implementation notes (Timezone)

- New migration `supabase/migrations/026_add_notification_timezone.sql`: `ALTER TABLE users ADD COLUMN notification_timezone text DEFAULT 'UTC'`
- Settings page (`src/app/(app)/settings/page.tsx`): add a timezone selector. Use a `<select>` populated from the IANA timezone list (can hardcode the most common ones: US/EU/AU, ~30 entries). Save via `PATCH /api/profile`.
- `worker/src/notifications/dispatcher.ts`: include `notification_timezone` in the user select query. Update `isInQuietHours(now, start, end, timezone)` to convert `now` to the user's local time before comparing: `new Date(now.toLocaleString('en-US', { timeZone: timezone }))`.
- Tests: update dispatcher unit tests to cover timezone conversions — user in UTC+9 during their local quiet hours should get `pending`, user in UTC-8 should not.

### PP-3 implementation notes (LLM prompt tests)

LLM-calling routes to cover:
- `src/app/api/prep/star/route.ts` (or wherever STAR generation lives) — assert prompt includes user's work history and the target company name
- `src/app/api/cover-letter/route.ts` — assert prompt includes job description, user profile, and template selection logic
- `src/app/api/extension/answer-question/route.ts` — question normalization + cache miss path calls Claude

Pattern: mock `@anthropic-ai/sdk` at module level in vitest, capture the `messages.create` call args, assert the `messages` array shape and `system` prompt content. Do NOT assert on response content — only on what we send.

### PP-4 implementation notes (E2E depth)

For each of the 5 specs, add:
1. A second `test()` that exercises an error or boundary condition
2. At least 2 additional `expect()` assertions in the happy path test

Suggested additions per spec:
- `auth.spec.ts`: test that unauthenticated `/tracker` redirects to `/login`
- `login-feed.spec.ts`: test that filter preset appears in sidebar after saving; test that feed with active filters shows reset button
- `tracker-drag.spec.ts`: test that dragging to the same column does NOT show a toast
- `bulk-tracker.spec.ts`: test that clicking "Select" with 0 cards selected does NOT show the bulk bar; cancel exits select mode
- `prep-star.spec.ts`: test that re-enrich button shows loading state; test that 429 cooldown message appears

---

## Key design decisions already made (do not re-litigate)

- Bulk select: toolbar "Select" button activates mode (NOT hover-to-reveal) — hover is invisible on desktop and broken on mobile
- Filter preset apply: REPLACE current filters (not merge)
- Easy/Hard buttons: icon + short text ("✓ Easy" / refresh icon "Hard") — NOT emoji
- Hard button: 300ms "Back tomorrow" inline flash before card exits
- Floating bulk bar: `position: fixed, bottom: max(24px, calc(env(safe-area-inset-bottom) + 8px))`, portal render, spring stiffness 350 damping 35

Full visual specs for all UI elements are in `docs/GRADE_BOOST_PLAN.md` under `*-DESIGN:` sections.

---

## Pending migrations to apply in Supabase

- `020_add_structured_address_fields.sql` — adds street_address, city, state, postal_code
- `021_extension_answer_cache.sql` — adds extension_answer_cache table
- `022_add_filter_presets.sql` — applied; adds saved job-feed filter presets
- `023_add_review_difficulty.sql` (to be written — Phase 8b)
- `024_add_daily_activity.sql` — written; apply in Supabase before relying on DSA new-today counts
- `025_notification_log_schema.sql` — applied; adds notification status/error and sent-only dedupe index

---

## Checks to run after any change

```bash
npx tsc --noEmit
npm run test -- <relevant test file>
cd extension && npm run test -- <relevant test file>
cd extension && npm run build
```

Note: on 2026-05-20 the npm binary wrappers for `vitest`, `next`, and worker `tsc` were broken in this workspace. Direct entrypoints worked:

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/next/dist/bin/next build
cd worker && node node_modules/vitest/vitest.mjs run
cd extension && node node_modules/vitest/vitest.mjs run
```
