# AI Context — Backlog

This document is loaded at the start of every Claude Code / Codex session. Read it before writing or suggesting any code.

---

## What Is Backlog?

A personal web app for software engineers to track and automate their job search. The core loop:

1. Job feed aggregated in real-time from GitHub (SimplifyJobs/New-Grad-Positions)
2. Chrome extension auto-fills job applications on Workday, Greenhouse, Lever, and generic ATS forms
3. Applications tracked through a kanban pipeline (saved → applied → interviewing → offer/rejected)
4. Interview prep, STAR responses, tailored resume generation

Single user, manually provisioned via Supabase. Not a SaaS product.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS + Framer Motion |
| Backend | Next.js API routes (Vercel) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| LLM (quality) | Claude Sonnet 4.6 — cover letters, STAR responses, open-ended autofill |
| LLM (volume) | GPT-5 nano — job normalization, match scoring |
| Extension | Chrome MV3, React sidebar injected into Shadow DOM |
| Tests | Vitest + jsdom (extension unit tests), Playwright (E2E) |

---

## Extension Architecture

The Chrome extension is the core of the auto-apply flow. Key files:

```
extension/src/
  background/index.ts    — service worker: toolbar click, auto-advance, tab lifecycle
  content/
    index.ts             — message handler (FILL_FORM_TIER1, FILL_FORM_TIER2, etc.)
    detect.ts            — ATS detection, page info extraction, next-button detection
    fill.ts              — THE FILL ENGINE: computeFills, applyFills, Workday ID map
    navigation.ts        — SPA navigation detection (MAIN world)
  sidebar/
    Sidebar.tsx          — React sidebar UI (scan → preview → apply → review flow)
    inject.ts            — Shadow DOM injection logic
    main.ts              — Sidebar entry point
  shared/
    types.ts             — All types: FullProfile, ScannedField, SidebarState, messages
    api.ts               — API calls (profile, analyzePage, answerQuestion, etc.)
    config.ts            — BACKLOG_URL constant
```

### Fill Pipeline (3 tiers)

```
Tier 1: computeFills() — deterministic, $0, instant
  - Workday: WORKDAY_AUTOMATION_ID_MAP by data-automation-id
  - Others: FIELD_MAP by label text regex
  → returns ScannedField[] (read-only preview)
  applyFills() writes to DOM

Tier 2: Haiku — unfilled fields, ~$0.0001/page
  POST /api/extension/analyze-page
  → returns {selector, value} pairs

Tier 3: Sonnet — open-ended questions, ~$0.005/question
  POST /api/extension/answer-question
  → returns generated text answer
```

### ATS Support Status

| ATS | Status | Notes |
|---|---|---|
| Greenhouse | Full | Label-based, works reliably |
| Lever | Full | Placeholder-based + generic fallback |
| Workday | Partial (Phase 1) | Text inputs via data-automation-id. Custom dropdowns (country/state/work-auth) NOT yet automated — Phase 2 |
| Generic | Partial | Label heuristics, best-effort |

---

## API Routes (extension-facing)

All extension API routes are under `/api/extension/`:

| Route | Purpose |
|---|---|
| GET `/api/extension/profile` | Full user profile (FullProfile type) |
| POST `/api/extension/apply` | Mark job as applied |
| POST `/api/extension/add-job` | Save job to backlog |
| POST `/api/extension/analyze-page` | Haiku analysis of unfilled fields |
| POST `/api/extension/answer-question` | Sonnet answer for open-ended fields |
| POST `/api/extension/improve-skills` | Sonnet skill section improvement |

Auth: `Authorization: Bearer blg_<key>` header. Keys stored in chrome.storage.local.

---

## Active Work

See `docs/CURRENT_TASK.md` for what's being worked on right now.

See `PHASES.md` for the full roadmap with checkboxes.

See `TODOS.md` for deferred items with context.

---

## Key Constraints

- Never break Greenhouse/Lever fill — they are the most-used paths
- Chrome MV3 only: no `eval()`, no remote code execution, `manifest_version: 3`
- The sidebar is a React app injected into a Shadow DOM (mode: open) — CSS is scoped
- No jQuery or external DOM libs in the extension — pure DOM APIs
- The user always reviews before submitting — never auto-submit
- Workday Shadow DOM is mode: open, so traversal works; labels are in parent shadow scopes

---

## Design System

Dark theme only: `#09090b` background, `#27272a` borders, `#6366f1` primary (indigo), `#34d399` success (green), `#f87171` error (red). Tailwind CSS in the web app, inline styles in the extension (no Tailwind in shadow DOM).
