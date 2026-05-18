# Codex Ideas

Last updated: 2026-05-18

This is a lightweight idea bank for Claude Code / Codex. It is not a task queue by itself; promote items into `docs/CURRENT_TASK.md` when actively working on them.

---

## Extension Thoughts For Claude

The Workday extension work is already in a serious, useful state. The current code has:

- 5s Tier 2 timeout fallback in both popup/sidebar-style fill flows.
- Workday text fill via `data-automation-id`.
- Workday state combobox support.
- Workday skills autocomplete support.
- Workday work-history and education section add/fill helpers.
- Cancel and review states in the sidebar.

### Highest-leverage next Workday work

1. **Capture real Workday DOM fixtures**
   - This is the most important next step before adding more heuristics.
   - Synthetic tests will keep missing nested shadow-root/progressive-rendering issues.
   - Suggested artifact: `extension/src/test/fixtures/workday-page1.html`.
   - If full shadow DOM serialization is hard, capture a redacted debug dump instead: visible labels, automation IDs, roles, placeholders, element path, and nearest section text.

2. **Add a Workday debug export button**
   - In the sidebar review/error state, add a small dev-only button that copies a redacted JSON diagnostic:
     - URL host/path only
     - detected ATS/page type
     - visible fillable fields
     - labels
     - `data-automation-id`
     - role/aria attributes
     - whether each field was filled/skipped
     - skip reason
   - This would make user smoke tests much cheaper: Kenny can paste one compact diagnostic instead of describing page behavior manually.

3. **Make Workday fills observable per phase**
   - Record fill results as:
     - deterministic text
     - Workday combobox
     - work history
     - education
     - skills
     - Tier 2 profile values
     - Tier 3 open-ended answers
   - The sidebar can still show a simple total, but internal logs should reveal which phase failed.

4. **Add modal guard before auto-advance**
   - `TODOS.md` still has this and it is valid.
   - Before clicking Next/Continue, block if a visible modal/dialog exists:
     - `[role="dialog"]`
     - `[aria-modal="true"]`
     - obvious modal classes
   - Surface “Modal detected, review before continuing” instead of clicking through.

5. **Handle “previously worked here” with actual work history**
   - Current radio resolver defaults prior-employer questions to `No`.
   - Better: infer company from page context and compare against `profile.workHistory[].company`.
   - Keep default `No` when no confident company match exists.

6. **Address fields should become structured profile fields**
   - Current `parseAddress()` fallback is fragile.
   - Add user fields for street/city/state/postal code, then keep parsing only as fallback.
   - This benefits Workday and generic ATS forms.

### Workday caution

Avoid large new heuristics until there is one real captured failure case. Workday forms differ by tenant and application flow; the next gains probably come from better observability and fixtures, not more broad selectors.

---

## Token And Cost Optimization Ideas

1. **Cache extension question answers**
   - Key by normalized question text + coarse job/company context.
   - Before calling Sonnet, check:
     - saved answers
     - recently generated answers
     - previous answer for semantically identical question
   - Store source as `saved`, `cached_generated`, or `generated`.

2. **Batch open-ended extension answers**
   - Current flows can call `answerQuestion` per open-ended field.
   - Add a batch endpoint for multiple questions from one page.
   - One Sonnet call can answer all fields with shared profile/job context.

3. **Tier 2 field analysis cache**
   - Cache Haiku analysis by ATS + normalized label + input type + option list hash.
   - Many forms ask the same fields repeatedly.

4. **Worker enrichment budget**
   - Add per-run caps for:
     - job URL description fetches
     - OpenAI normalization batches
     - Brave Search queries
   - Log a compact cost summary per run.

5. **Description-first filtering**
   - For Brave-discovered jobs, keep doing cheap title/search-result filtering first.
   - Only run expensive extraction/enrichment if URL/title/snippet pass role + seniority gates.

6. **Lazy match scoring**
   - Keep match scores lazy and cached.
   - Add a “score top N newest jobs only” background job if feed scanning gets slow.

---

## Backlog Product Ideas

1. **Daily “apply queue”**
   - A focused page with the top 5-10 newest matching jobs.
   - Actions: save, open application, mark applied, hide, not relevant.
   - This keeps the workflow from becoming an infinite feed.

2. **Negative feedback loop**
   - Add “Not relevant” reasons:
     - too senior
     - ML/data/research
     - not SWE
     - location
     - sponsorship
     - duplicate/closed
   - Feed these reasons back into filters and future search query tuning.

3. **Job freshness and closing risk**
   - Show “posted today / this week” plus source confidence.
   - For discovered URLs, recheck whether the page is still live before highlighting it.

4. **Application packet checklist**
   - Per job:
     - resume ready
     - cover letter optional
     - common answers ready
     - extension profile complete
     - application opened
     - applied
   - This makes Backlog feel like a cockpit, not just a tracker.

5. **Company reuse**
   - If applying to a company already in the tracker, surface:
     - previous applications
     - previous answers
     - recruiter contacts
     - interview notes
     - company-specific cover letter tone

6. **Closed-loop job search analytics**
   - Track which source produced applications and responses:
     - GitHub
     - portal scan
     - Brave Search
     - manual
   - Then bias future discovery toward sources that actually lead to interviews.

7. **Saved answer library improvement**
   - Detect repeated application questions from extension usage.
   - Suggest saving generated answers that were edited or reused.

8. **Profile completeness by ATS**
   - Instead of one generic completeness score, show:
     - Greenhouse readiness
     - Lever readiness
     - Workday readiness
   - Example: “Workday readiness is low because address street/postal code is missing.”

---

## Docs/TODO Hygiene

`TODOS.md` is partially stale. Examples:

- Haiku timeout is already implemented.
- Workday combobox/work-history/education support exists, though it still needs live validation.
- Relevance filter test notes still mention allowing PM/TPM, but current user preference is software engineering only.

Suggested cleanup task: reconcile `TODOS.md` and `TESTING-SUITE.md` against current code before using them as planning truth.
