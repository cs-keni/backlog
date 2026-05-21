# Priority List

Last updated: 2026-05-21

**Current wave:** Wave 3 — Outcome Engine. Full spec in `docs/WAVE3_PLAN.md`.

---

## Wave 2 — Complete (all Codex)

All phases implemented locally. Migrations 028 and 029 need Supabase application before production use.

---

## Wave 3 — Next Up (all Codex)

Full spec in `docs/WAVE3_PLAN.md`. Execute in this order:

| # | Phase | What | Status |
|---|-------|------|--------|
| 1 | P6 | Application packet checklist | Implemented locally |
| 2 | P8 | Company reuse banner | Implemented locally |
| 3 | P1 | Resume tailor UI (verify route contract first) | Implemented locally |
| 4 | P7 | Job freshness badge (display only) | Implemented locally |
| 5 | P4 | Source yield feedback loop + user source prefs | Implemented locally — migration 030 written |
| 6 | P2 | Per-ATS completeness score | Implemented locally — migrations 031, 032 written |
| 7 | P5 | Negative relevance feedback | Implemented locally — migration 033 written |
| 8 | P0 | ATS keyword gap analysis | Implemented locally — migration 034 written |
| 9 | P3 | Salary negotiation playbook | Implemented locally — migration 035 written |

---

## Extension — Ongoing (separate from Wave 3)

| # | What | Owner | Notes |
|---|------|-------|-------|
| E1 | Workday DOM fixture capture | Claude Code | Real page required; Kenny needs to run on a live Workday form |
| E2 | Next-button modal guard | Claude Code | Detect `[role="dialog"]` before auto-advancing |
| E3 | Prior-employer radio logic | Claude Code | Compare company name to `profile.work_experience` |
| E4 | Batch open-ended extension answers | Codex | One Sonnet call for all open-ended fields on a page |
| E5 | Cache generated extension answers | Codex | Migration 021 written; apply in Supabase, then wire lookup |

---

## Pending Supabase migrations

| Migration | Status | Blocks |
|-----------|--------|--------|
| `020_add_structured_address_fields.sql` | Written, not applied | Profile address fields |
| `021_extension_answer_cache.sql` | Written, not applied | Extension answer caching |
| `026_add_notification_timezone.sql` | Written, not applied | Per-user quiet hour timezones |
| `027_add_dsa_track.sql` | Written (Wave 2 P1) | DSA track modes |
| `028_interview_kits.sql` | Written (Wave 2 P4) | Interview day kit |
| `029_interview_kits_unique.sql` | Written (Wave 2 P4) | Interview kit unique constraint |
| `030_source_preferences.sql` | Written, not applied (Wave 3 P4) | Source yield prefs |
| `031_applications_ats_platform.sql` | Written, not applied (Wave 3 P2) | ATS completeness |
| `032_users_ats_profile_fields.sql` | Written, not applied (Wave 3 P2) | phone/address/linkedin |
| `033_job_feedback.sql` | Written, not applied (Wave 3 P5) | Negative relevance |
| `034_keyword_gaps.sql` | Written, not applied (Wave 3 P0) | Keyword gap cache |
| `035_users_comp_target.sql` | Written, not applied (Wave 3 P3) | Salary playbook |

---

## Deferred (Wave 4+)

- HTTP liveness checker — background URL dead-link detector; needs job queue infra first
- Warm referral radar — LinkedIn data access blocked
- Auto-apply queue — needs P4 source yield + P2 ATS completeness data first
