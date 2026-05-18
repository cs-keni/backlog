# Current Task

**Last updated:** 2026-05-18
**Status:** Brave Search discovery added for entry-level SWE jobs

---

## Fixed in latest Codex session

1. **Brave Search source added** — worker aggregation now runs a Brave Web Search discovery pass after GitHub and curated portal scans when `BRAVE_SEARCH_API_KEY` is present.
2. **Cost controls** — defaults to 6 search queries per aggregation run (`BRAVE_SEARCH_QUERY_LIMIT`, default `6`) and uses Brave Web Search only, not Answers API.
3. **Search result filtering** — skips broad job-board result pages and only attempts direct ATS/company job URLs that look like actual postings.
4. **Extraction path** — supports direct Greenhouse/Lever APIs plus generic JSON-LD `JobPosting` pages without adding extra GPT calls.
5. **Experience gate** — Brave-discovered jobs are dropped when the posting appears to require 3+ years of professional/relevant software experience.

## Checks run

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 44 tests passed
- `cd worker && npm run build` — passed

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
