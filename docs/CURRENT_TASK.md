# Current Task

**Last updated:** 2026-05-15
**Status:** Phase 10B DONE — pending real Workday smoke test (D6)

---

## Next: Real Workday Smoke Test

Phase 10B code is implemented, tested (48/48), and built. The only remaining gate before declaring Workday support complete is testing on a live `*.myworkdayjobs.com` application.

**What to test:**
1. Open a Workday job application
2. Click "Scan form" in the sidebar
3. Verify the preview shows correct fields (first name, last name, email, phone, LinkedIn)
4. Click "Apply N fields"
5. Check which fields were filled vs. skipped
6. Note any combobox fields that need Phase 10B.2

---

## Phase 10B.2 (deferred)

- Async Workday combobox fill (country/state/city) — needs live DOM to design
- Workday DOM fixture capture — needed for deterministic regression tests
- See TODOS.md and PHASES.md Phase 10B for full list
