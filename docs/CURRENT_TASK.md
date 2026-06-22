# Current Task

**Last updated:** 2026-06-22
**Status:** Phase 24 (Handshake Assistant) — P2 Settings UI built. Pending: upload 57 cover-letter PDFs via new UI, live-test Handshake selectors.

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
- `extension/src/sidebar/HandshakePanel.tsx` — full panel: job info, CL generation + copy + PDF download, project suggestions + tailored resume PDF download
- `extension/src/sidebar/Sidebar.tsx` — `HandshakePanel` routed for `page.ats === 'handshake'`

**PDF infrastructure**
- `src/lib/pdf/resume-utils.ts`, `src/lib/pdf/cover-letter-doc.tsx`, `src/lib/pdf/resume-doc.tsx`
- `src/app/api/extension/download-cover-letter/route.ts`
- `src/app/api/extension/download-tailored-resume/route.ts`
- `src/app/api/user/upload-resume/route.ts`
- `supabase/migrations/043_resume_markdown.sql` (NOT YET applied)

**Scripts + migrations**
- `scripts/seed-project-catalog.mjs` — parser bugs fixed
- `scripts/upload-resume.mjs` — NEW: uploads `resume-data/resume.md` to DB
- `supabase/migrations/042_application_materials.sql` — applied ✅
- `supabase/migrations/043_resume_markdown.sql` — NOT applied yet

### What's done (Phase 24-P2)

- `HandshakeSettings` component (`src/components/settings/HandshakeSettings.tsx`): PDF drag-and-drop upload for cover letter style, resume Markdown textarea + save
- Session auth added to `extract-cover-letter-style` and `upload-resume` routes (was extension-only Bearer token)
- Settings page fetches `resume_markdown` + `cover_letter_style_context` and renders `HandshakeSettings`

### What's done (Phase 24-P3)

- Two-phase async scrape: waits for title/company, then clicks "More" expand buttons and reads full description (up to 6000 chars)
- Easter egg detection: single Claude call returns `{ coverLetterBody, specialInstructions }` — hidden instructions surfaced in an amber banner in the sidebar

### What's next

1. **Reload extension** in Chrome (`chrome://extensions`) and refresh a Handshake job page
2. **Verify full description** is now scraped (previously cut off by collapsed "More" section)
3. **Test Easter egg detection** on a job that has hidden instructions — check that the amber banner appears in the sidebar after generating a cover letter

---

## Previous active task (Interview Prep Expansion — SD-P1 through SD-P5)

Codex completed P1–P5. All migrations 036–041 still need to be applied in Supabase for production use. See prior CURRENT_TASK.md content archived in `docs/ENGINEERING_LOG.md`.
