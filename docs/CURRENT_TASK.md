# Current Task

**Last updated:** 2026-05-21
**Status:** Wave 3 planned and ready for Codex. Wave 2 complete locally (migrations 028/029 need Supabase application).

---

## Active plan: Backlog Wave 3 — Outcome Engine

Full spec is in **`docs/WAVE3_PLAN.md`**. Read it before starting any phase. It contains file paths, exact code shapes, migration SQL, and test specs for every item.

**Execution order: P6 → P8 → P1 → P7 → P4 → P2 → P5 → P0 → P3** (each phase independently deployable — start with low-risk read-only features)

| Phase | What | Owner | Status |
|-------|------|-------|--------|
| P6 | Application packet checklist (no migration) | Codex | Ready |
| P8 | Company reuse banner (read-only query) | Codex | Ready |
| P1 | Resume tailor UI (verify route contract first) | Codex | Ready |
| P7 | Job freshness badge (display only) | Codex | Ready |
| P4 | Source yield feedback loop + source prefs | Codex | Ready — migration 030 |
| P2 | Per-ATS completeness score | Codex | Ready — migrations 031, 032 |
| P5 | Negative relevance feedback | Codex | Ready — migration 033 |
| P0 | ATS keyword gap analysis | Codex | Ready — migration 034 |
| P3 | Salary negotiation playbook | Codex | Ready — migration 035 |

**Previous plan:** Wave 2 — Co-Pilot features (complete). See `docs/WAVE2_PLAN.md`.

---

## Agent ownership

All phases in Wave 3 are **Codex**. CEO plan: `~/.gstack/projects/cs-keni-backlog/ceo-plans/2026-05-21-backlog-wave3.md`.

---

## Checks to run after any change

```bash
# TypeScript (binary wrappers are broken in this workspace — use direct entrypoints)
node node_modules/typescript/bin/tsc --noEmit
cd worker && node ../node_modules/typescript/bin/tsc --noEmit

# Tests
node node_modules/vitest/vitest.mjs run <file>
cd worker && node node_modules/vitest/vitest.mjs run
cd extension && node node_modules/vitest/vitest.mjs run

# Dev server
node node_modules/next/dist/bin/next dev
```
