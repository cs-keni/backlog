# Current Task

**Last updated:** 2026-05-21
**Status:** Wave 2 P0, P5, P1, P2, and P3 implemented locally. P4 is next.

---

## Active plan: Backlog Co-Pilot — Wave 2

Full spec is in **`docs/WAVE2_PLAN.md`**. Read it before starting any phase. It contains file paths, exact code shapes, migration SQL, and test specs for every item.

**Execution order: P0 → P5 → P1 → P2 → P3 → P4** (each phase independently deployable)

| Phase | What | Owner | Status |
|-------|------|-------|--------|
| P0 | 3 bug fixes (Log Application, Settings toast, enrich 500s) | Codex | Implemented locally |
| P5 | UX polish trio (button labels, Tracker empty state, STORY BANK) | Codex | Implemented locally |
| P1 | DSA track modes 75/150/250 + interview-aware Today queue | Codex | Implemented locally |
| P2 | Application health scores on Tracker cards | Codex | Implemented locally |
| P3 | Callback rate analytics (conversion breakdown) | Codex | Implemented locally |
| P4 | Interview day kit (streaming LLM brief) | Codex | Ready |

**Previous plan:** Grade Boost — All Sections to A (complete). See `docs/GRADE_BOOST_PLAN.md`.

---

## Agent ownership

All phases in Wave 2 are **Codex**. No Claude Code reservation needed — specs are precise enough that no animation/DOM timing judgment is required.

---

> **Previous plan (complete):** Grade Boost — all phases P1–P9 + Polish Pass PP1–PP4 shipped as of 2026-05-21.

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
