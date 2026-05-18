# Handoff

> Whoever is picking this up — Claude Code or Codex — read this first. Then read `docs/CURRENT_TASK.md`.

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
