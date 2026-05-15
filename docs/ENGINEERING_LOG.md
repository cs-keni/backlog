# Engineering Log

Reverse-chronological. One entry per meaningful session.

---

## 2026-05-15 — Workday autofill Phase 10B implementation (Claude Code)

**Commit:** (see git log for hash)

### Implemented

- `extension/src/shared/types.ts` — `ScannedField` interface + `SCAN_FORM`/`APPLY_SCANNED` message types
- `extension/src/content/fill.ts` — full rewrite:
  - `computeFills(profile, ats)` — read-only scan returning `ScannedField[]` with `WeakRef`
  - `applyFills(fields)` — DOM write pass consuming `computeFills` output
  - `isElementFillable(el)` — visibility + disabled/readonly guard
  - `WORKDAY_ID_MAP` — `data-automation-id` regex → profile resolver for 15+ field types
  - Shadow boundary climbing in `getLabelForInput` (3 hops max, 80 char guard)
  - `queryShadowScoped` — form-container scoped traversal with full-doc fallback
- `extension/src/sidebar/Sidebar.tsx` — scan-preview UI:
  - "Scan form" primary → preview list (label + source badge) → "Apply N fields"
  - "Auto-fill (skip preview)" secondary for single-click flow
  - Workday async combobox note in preview panel
- `extension/src/content/fill.test.ts` — 48 tests, all passing
- `extension/src/test/setup.ts` — `CSS.escape` polyfill (jsdom 29 does not expose global `CSS`)
- `PHASES.md` — Phase 10B added with task list
- `docs/` — AI_CONTEXT.md, HANDOFF.md, CURRENT_TASK.md created for Codex collaboration

### Root cause discovered: CSS.escape not in jsdom 29

`computeFills` builds selectors via `\`#${CSS.escape(input.id)}\``. jsdom 29 does not expose a global `CSS` object, so this threw `TypeError: Cannot read properties of undefined (reading 'escape')`. The `try/catch` silently dropped the field. Fixed by polyfilling `CSS.escape` in `setup.ts`.

### Remaining (Phase 10B.2+)

- Async Workday combobox fill (country, state, city)
- Real Workday smoke test + DOM fixture capture
- E2E Playwright test for scan → apply flow

---

## 2026-05-15 — Workday autofill plan + docs (Claude Code)

**Commit:** `d1517c7` (session start, no new commit from this session — docs only)

### Plan review

Ran `/plan-eng-review` on the Workday autofill feature. 6 architectural decisions, Codex outside voice incorporated.

Key decisions:
- **D1**: Defer async Workday combobox fill to Phase 2 (pending live testing)
- **D2**: Pre-computed scan preview (`computeFills` → show preview → user clicks Apply → `applyFills`)
- **D3**: `WORKDAY_AUTOMATION_ID_MAP` (data-automation-id primary) + shadow-boundary label fallback
- **D4**: `queryShadowAll` scoped to form containers + document fallback
- **D5**: Full fill.test.ts coverage (regression + new Workday paths)
- **D6**: Test on live Workday form before claiming full support

Codex raised: visibility filtering (no guards against hidden/off-step fields), WeakRef stability for element handles, form container scoping safety. All incorporated.

### What's planned (not yet implemented)

See `docs/CURRENT_TASK.md`. Implementation of fill.ts, types.ts, Sidebar.tsx, fill.test.ts is next.

---

## 2026-04-28 — Phase 10A auto-apply engine (Claude Code)

**Commits:** Multiple (phase 8 → CORS fix → extension improvements)

- Multi-page auto-advance via `chrome.storage.session` keyed by tabId
- Background service worker orchestrates Tier 1 + Tier 2 fills on navigation
- Sidebar React component with filling/review states
- Haiku Tier 2 for unfilled field analysis
- Sonnet Tier 3 for open-ended question answering
- `queryShadowAll` added for Workday Shadow DOM traversal (basic version)
- Skills field detection + "Improve skills" button
- CORS proxy middleware for extension API routes

---

## 2026-04-04 — Phase 10A design (Claude Code)

- Auto-apply engine design doc written (see `~/.gstack/projects/cs-keni-backlog/`)
- 3-tier LLM strategy decided: deterministic → Haiku → Sonnet
- Multi-page navigation architecture designed
- Workday scoped as "best-effort" (later upgraded to Phase 1 targeted effort 2026-05-15)
