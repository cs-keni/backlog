# Current Task

**Last updated:** 2026-06-22
**Status:** Phase 24 (Handshake Assistant) — P0 + P1 core wiring complete. Migration and seed script need to be run.

---

## Context: where we are

Phase 24 is the Handshake job assistant extension. Design doc at:
`~/.gstack/projects/cs-keni-backlog/keni-main-design-handshake-assistant-20260621-214851.md`

### What's done (Phase 24-P0 + P1)

**Types (extension/src/shared/types.ts)**
- `AtsType` now includes `'handshake'`
- New `HandshakeJobData` interface: `{ jobTitle, company, description }`
- `TabSessionState.handshakeContext?: HandshakeJobData | null`
- Three new `ExtensionMessage` types: `SET_HANDSHAKE_JOB_DATA`, `GET_HANDSHAKE_JOB_DATA`, `STORE_CROSS_PLATFORM_JOB_CONTEXT`

**Content scripts**
- `extension/src/content/detect.ts` — Handshake URL detection added
- `extension/src/content/handshake.ts` — NEW: `scrapeHandshakeJob()` (MutationObserver, 5s timeout) + `installExternalApplyInterceptor()`
- `extension/src/content/index.ts` — Handshake init on page load + SPA nav, external-apply interceptor installed

**Background**
- `extension/src/background/index.ts` — three new message handlers; `pendingCrossPlatformContext` Map; cross-platform write at `onUpdated status='loading'`

**API routes (Next.js)**
- `src/app/api/extension/generate-cover-letter/route.ts` — Claude Sonnet, 5/day rate limit, style-aware
- `src/app/api/extension/suggest-projects/route.ts` — Haiku project ranking, 20/day rate limit
- `src/app/api/user/extract-cover-letter-style/route.ts` — multipart PDF upload → style extraction

**Sidebar**
- `extension/src/sidebar/HandshakePanel.tsx` — NEW: full panel with job info, CL generation, project suggestions
- `extension/src/sidebar/Sidebar.tsx` — `HandshakePanel` routed for `page.ats === 'handshake'`

**Scripts + migrations**
- `scripts/seed-project-catalog.mjs` — parser bugs fixed (`: **` detection, paren-before-split)
- `supabase/migrations/042_application_materials.sql` — ready to apply

### What's blocked / next steps

1. **Apply migration 042** in Supabase console (SQL in `supabase/migrations/042_application_materials.sql`)
2. **Run seed script**: `node --env-file=.env.local scripts/seed-project-catalog.mjs`
3. **Upload cover letter PDFs** via settings page to populate `users.cover_letter_style_context`
   - `POST /api/user/extract-cover-letter-style` with files under `pdfs` form field
4. **Live-test Handshake selectors** on `app.joinhandshake.com` — may need DOM selector tuning
5. **Build + load extension**: `cd extension && npm run build` then load in Chrome
6. Project catalog settings UI (web) — Phase 24-P2

---

## Previous active task (Interview Prep Expansion — SD-P1 through SD-P5)

Codex completed P1–P5. All migrations 036–041 still need to be applied in Supabase for production use. See prior CURRENT_TASK.md content archived in `docs/ENGINEERING_LOG.md`.
