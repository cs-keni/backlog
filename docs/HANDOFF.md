# Handoff

> Whoever is picking this up — Claude Code or Codex — read this first. Then read `docs/CURRENT_TASK.md`.

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
  - Writes discovered jobs with source `portal` for now to avoid introducing a DB source enum migration risk.
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
