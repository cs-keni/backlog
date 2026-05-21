# Priority List

Last updated: 2026-05-21

**Current wave:** Wave 2 — Co-Pilot features. Full spec in `docs/WAVE2_PLAN.md`.

---

## Wave 2 — In Progress (all Codex)

| # | Phase | What | Status |
|---|-------|------|--------|
| 1 | P0 | Fix Log Application "Failed to create job" | Ready |
| 2 | P0 | Fix Settings "1 Issue" toast (React controlled input) | Ready |
| 3 | P0 | Fix company enrich 500s (add silent catch in JobDetail) | Ready |
| 4 | P5 | UX polish: button labels, Tracker empty state, STORY BANK | Ready |
| 5 | P1 | DSA track modes 75/150/250 + migration 027 | Ready |
| 6 | P1 | DSA interview-aware Today queue (company pattern map) | Ready |
| 7 | P2 | Application health scores on Tracker cards | Ready |
| 8 | P3 | Callback rate analytics breakdown | Ready |
| 9 | P4 | Interview day kit (streaming LLM, migration 028) | Ready |

---

## Extension — Ongoing (separate from Wave 2)

These are not in Wave 2 scope. Pick up after Wave 2 ships or in parallel if bandwidth allows.

| # | What | Owner | Notes |
|---|------|-------|-------|
| E1 | Workday DOM fixture capture | Claude Code | Real page required for testing; Kenny needs to run on a live Workday form |
| E2 | Next-button modal guard | Claude Code | Detect `[role="dialog"]` before auto-advancing |
| E3 | Prior-employer radio logic | Claude Code | Compare company name to `profile.work_experience` |
| E4 | Batch open-ended extension answers | Codex | One Sonnet call for all open-ended fields on a page |
| E5 | Cache generated extension answers | Codex | Migration 021 written; apply in Supabase, then wire lookup |

---

## Pending Supabase migrations (apply before relying on features)

| Migration | Status | Blocks |
|-----------|--------|--------|
| `020_add_structured_address_fields.sql` | Written, not applied | Profile address fields |
| `021_extension_answer_cache.sql` | Written, not applied | Extension answer caching |
| `026_add_notification_timezone.sql` | Written, apply when ready | Per-user quiet hour timezones |
| `027_add_dsa_track.sql` | **To write (Wave 2 P1)** | DSA track modes |
| `028_interview_kits.sql` | **To write (Wave 2 P4)** | Interview day kit |

---

## Deferred (Wave 3+)

- Salary negotiation playbook — needs per-company comp data
- Warm referral radar — needs LinkedIn data access
- Auto-apply queue — needs callback rate data to validate match quality
- ATS keyword gap analysis — good idea, next wave
- Daily apply queue / negative relevance feedback — see TODOS.md
