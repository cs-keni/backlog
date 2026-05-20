# Current Task

**Last updated:** 2026-05-20
**Status:** Phase 1, Phase 2a-2e, Phase 7, and Phase 8a are implemented. Phase 2f/g decomposition is intentionally deferred to P3.

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
- **Phase 3** — Tracker integration tests + bulk ops (floating action bar)
- **Phase 4** — Analytics decomposition + company graph skeleton
- **Phase 5** — Prep decomposition + re-enrich button
- **Phase 6** — Profile security (scoped SELECT) + ownership tests
- **Phase 2f/g** — fill.ts + extension Sidebar.tsx decomposition
- **Phase 8b** — Adaptive SR intervals (Easy/Hard buttons, migration 023)
- **Phase 9** — E2E tests (Playwright global setup)

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

Note: on 2026-05-20 the npm binary wrappers for `vitest` and worker `tsc` were broken in this workspace. Direct entrypoints worked:

```bash
node node_modules/typescript/lib/tsc.js --noEmit
cd worker && node ../node_modules/typescript/lib/tsc.js -p tsconfig.json
cd worker && node node_modules/vitest/dist/cli.js run tests/unit/dispatcher.test.ts --pool=threads
```
