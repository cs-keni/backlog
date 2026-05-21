# Current Task

**Last updated:** 2026-05-21
**Status:** Wave 3 implemented locally. Migrations 030–035 need Supabase application before production use. Wave 2 complete locally (migrations 028/029 also need Supabase application).

---

## Active plan: Backlog Wave 3 — Outcome Engine

Full spec is in **`docs/WAVE3_PLAN.md`**. Read it before starting any phase. It contains file paths, exact code shapes, migration SQL, and test specs for every item.

**Execution order: P6 → P8 → P1 → P7 → P4 → P2 → P5 → P0 → P3** (each phase independently deployable — start with low-risk read-only features)

| Phase | What | Owner | Status |
|-------|------|-------|--------|
| P6 | Application packet checklist (no migration) | Codex | Implemented locally |
| P8 | Company reuse banner (read-only query) | Codex | Implemented locally |
| P1 | Resume tailor UI (verify route contract first) | Codex | Implemented locally |
| P7 | Job freshness badge (display only) | Codex | Implemented locally |
| P4 | Source yield feedback loop + source prefs | Codex | Implemented locally — migration 030 written |
| P2 | Per-ATS completeness score | Codex | Implemented locally — migrations 031, 032 written |
| P5 | Negative relevance feedback | Codex | Implemented locally — migration 033 written |
| P0 | ATS keyword gap analysis | Codex | Implemented locally — migration 034 written |
| P3 | Salary negotiation playbook | Codex | Implemented locally — migration 035 written |

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
