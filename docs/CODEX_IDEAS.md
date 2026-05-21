# Codex Ideas

Last updated: 2026-05-21

Lightweight idea bank. Items here are not yet in a plan — promote to `docs/WAVE2_PLAN.md` or `TODOS.md` when actively working on them.

**Already implemented (removed from list):** Workday debug export button (Phase 2e), extension debug diagnostics, bulk action bar (Phase 3b), filter presets (Phase 7), timezone-aware quiet hours (PP-1), E2E depth (PP-4).

---

## Extension

### Workday observability improvements

1. **Capture real Workday DOM fixtures**
   - Most important before adding more selectors.
   - On a real Workday application page, run `document.documentElement.outerHTML` in console.
   - Save to `extension/src/test/fixtures/workday-page1.html`.
   - Use in `fill.test.ts` to test against real DOM shapes (nested shadow roots, repeated automation IDs, async mount order).

2. **Make Workday fills observable per phase**
   - Internal logs should record fill results by phase: deterministic text / combobox / work history / education / skills / Tier 2 / Tier 3.
   - Sidebar can still show a simple total, but structured logs make debugging much cheaper.

3. **Address fields should be structured profile fields**
   - `parseAddress()` is a fragile fallback.
   - Migration 020 already adds `street_address`, `city`, `state`, `postal_code` — apply it, update Profile UI, update extension to prefer structured fields.

4. **Modal guard before auto-advance**
   - Before clicking Next/Continue, check for visible modals: `[role="dialog"]`, `aria-modal="true"`.
   - Surface "Modal detected — review before continuing" instead of clicking through.
   - Already in TODOS.md.

---

## Token / Cost Optimization

1. **Cache generated extension answers**
   - Key by normalized question text + coarse job/company context.
   - Migration 021 is written; apply in Supabase, then wire lookup in `/api/extension/answer-question`.

2. **Batch open-ended extension answers**
   - Current flows call `answerQuestion` per field. One Sonnet call can answer all fields with shared profile/job context.

3. **Tier 2 field analysis cache**
   - Cache Haiku analysis by ATS + normalized label + input type + option list hash.

4. **Worker enrichment budget**
   - Add per-run caps for job URL fetches, OpenAI batches, Brave queries.
   - Log a compact cost summary per run.

5. **Lazy match scoring**
   - Keep scores lazy and cached. Add "score top N newest jobs only" background job if feed scanning gets slow.

---

## Product Ideas (not yet in Wave 2)

1. **Negative relevance feedback**
   - "Not relevant" reasons: too senior, ML/data, not SWE, location, sponsorship, duplicate.
   - Feed back into filters and future Brave query tuning.

2. **Job freshness + closing risk**
   - Show "posted today/this week" and recheck whether the URL is still live before surfacing old jobs.

3. **Application packet checklist**
   - Per job: resume ready, cover letter done, common answers ready, extension profile complete, applied.
   - Makes Backlog feel like a cockpit, not just a tracker.

4. **Company reuse across applications**
   - When applying to a company already in tracker: surface prior applications, past answers, recruiter contacts, interview notes.

5. **Profile completeness by ATS**
   - Instead of one generic score: "Greenhouse readiness 90%, Workday readiness 60% (missing street address)."

6. **Source yield as a feedback loop**
   - Track which source (GitHub, portal, Brave, manual) produced applications and interviews.
   - Bias future discovery budget toward sources that lead to callbacks.
   - Baseline analytics in place; close the loop with discovery-side tuning.
