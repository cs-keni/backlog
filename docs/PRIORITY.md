# Priority List

Last updated: 2026-05-18

This is the current working priority order. `Owner: Codex` means Codex can take it without needing Claude's extension-specific context. `Owner: Claude` means it is best left to Claude unless Kenny explicitly redirects it.

---

## P0 — Production Feed Health

### 1. Verify portal/search inserts after migration 19

Owner: Codex

Status: in progress.

Why: Render logs showed `jobs_source_check` rejecting `source='portal'` before/around migration rollout. Migration 19 was applied successfully by Kenny afterward, but the next worker run should be checked.

Next checks:

- Confirm new Render logs no longer show `violates check constraint "jobs_source_check"`.
- Confirm portal/search jobs write with `source='portal'`.
- Confirm analytics source breakdown counts portal jobs separately.

### 2. Tune job discovery quality

Owner: Codex

Status: in progress; Brave query tuning updated 2026-05-18.

Why: Brave Search ran but returned zero results with overly strict quoted/exclusion queries. Portal scan also let broad non-entry roles through.

Current direction:

- Brave Search now uses ATS/careers-oriented queries and a past-month freshness window.
- Normalized portal/search jobs now require explicit entry-level signals (`new grad`, `junior`, `associate`, `entry-level`, etc.) before writing.
- 2026-05-18 Render logs: broad career queries produced candidates, but quoted ATS queries returned 0 results; relevant Brave/portal jobs were all duplicates.
- 2026-05-18 follow-up: default Brave budget now prioritizes broad career queries, includes Portland/remote-specific discovery, and logs per-query raw/candidate/extracted/accepted metrics.
- Continue tuning after the next Render run by pruning any default-budget query with repeated zero candidate/extracted counts.

---

## P1 — Extension Reliability

### 3. Workday debug export / observability

Owner: Claude

Why: Workday support is now limited more by real-page observability than by generic selector ideas.

Expected work:

- Add redacted debug export from the sidebar.
- Include visible labels, automation IDs, roles, placeholders, filled/skipped state, and phase.
- Use this to capture failures from real applications.

### 4. Real Workday fixture capture

Owner: Claude

Expected work:

- Capture a real Workday page/field fixture.
- Add deterministic regression tests against that fixture.
- Validate combobox, skills, work-history, and education helpers on real DOM shapes.

### 5. Workday auto-advance safety

Owner: Claude

Expected work:

- Add visible modal/dialog guard before clicking Next/Continue.
- Avoid auto-advancing past prompts the user needs to review.

---

## P2 — Profile Data Quality

### 6. Structured address fields

Owner: Codex or Claude

Status: implemented in code; migration 020 needs Supabase apply.

Why: Address parsing is brittle and affects Workday plus generic ATS forms.

Expected work:

- Add `street_address`, `city`, `state`, `postal_code` fields. Done in migration 020.
- Update Profile UI and extension profile API. Done.
- Extension should prefer structured fields and keep `parseAddress()` as fallback. Done.

### 7. Prior-employer radio logic

Owner: Claude

Expected work:

- For “previously worked here?” questions, compare current application company to `profile.workHistory`.
- Default to `No` only when no confident match exists.

---

## P3 — Cost / Token Optimization

### 8. Batch extension open-ended answers

Owner: Codex

Expected work:

- Add a batch endpoint for multiple open-ended questions on one page.
- Share profile/job context once instead of per question.
- Keep saved-answer lookup first.

### 9. Cache generated extension answers

Owner: Codex

Expected work:

- Normalize question text.
- Reuse generated answers for repeated questions.
- Track answer source as saved/cached/generated.

### 10. Worker run budget reporting

Owner: Codex

Status: baseline implemented.

Expected work:

- Log Brave query count, candidate URLs, extracted jobs, relevant jobs, inserted jobs. Baseline done.
- Log normalization/enrichment attempts. Baseline done for source summaries and portal enrichment budget.
- Optional later: persist worker run summaries.

---

## P4 — Product Workflow

### 11. Aggressive Portland SWE discovery

Owner: Codex

Status: baseline implemented in Brave Search; monitor production yield.

Expected work:

- Add a more aggressive search path for software engineering jobs in Portland, Oregon.
- Expand beyond the current general Brave/portal discovery strategy where useful.
- Keep the feed scoped to software engineering roles and current entry-level/new-grad preferences.
- Add observability so the Portland-specific search can be tuned from worker logs. Baseline done with per-query Brave metrics.

### 12. Daily apply queue

Owner: Codex

Expected work:

- Add a focused queue of the top newest/relevant jobs.
- Quick actions: save, open application, hide, mark applied.

### 13. Negative relevance feedback

Owner: Codex

Expected work:

- Add “Not relevant” reasons: too senior, ML/data/research, not SWE, location, duplicate/closed.
- Use feedback to tune filters and Brave queries.

### 14. Source yield analytics

Owner: Codex

Status: baseline implemented 2026-05-18.

Expected work:

- Track applications, responses, and interviews by source (`github`, `portal`, `manual`). Done in Analytics source yield.
- Use source performance to decide which discovery channels deserve more budget.

---

## P5 — Maintenance

### 15. Docs/test backlog cleanup

Owner: Codex

Status: in progress; added analytics source breakdown and `filterNewJobs` tests.

Expected work:

- Continue reconciling stale `TODOS.md`, `TESTING-SUITE.md`, and `PHASES.md` against actual code.
- Add missing tests for analytics source breakdown and `filterNewJobs`. Done 2026-05-18.
