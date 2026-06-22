# Engineering Log

Reverse-chronological. One entry per meaningful session.

---

## 2026-06-22 — v3.0.1: debug description scraper, case-insensitive H3 matching, parent-sibling fallback (Claude Code)

**Commit:** (see below)

### What shipped

**`extension/src/content/handshake.ts`:**
- `DESC_SECTION_RE` — switched from exact-match string array to case-insensitive regex. Covers "Job description", "Job Description", "About the role", "Responsibilities", "What you'll do", etc. Previous code was case-sensitive and would silently return null if Handshake capitalised differently.
- `readDescription()` — added Strategy 2 (parent's siblings) and Strategy 3 (parent's full text minus heading label) as fallbacks when H3 has no direct siblings. Needed when Handshake wraps `<h3>` alone in a header `<div>` and puts the body in a separate sibling.
- Added `console.log('[Backlog] ...)` debug output throughout `readDescription()`, `expandDescriptionSections()`, and `scrapeHandshakeJob()` so the actual DOM structure is visible in Chrome DevTools > Console.
- Reverted accidental optional-description API change (jobDescription required again).

**`extension/public/manifest.json`:** bumped to v3.0.1.

**Versioning convention established:**
- Major (x.0.0): new platform integrations (3=Handshake, next would be LeetCode overhaul, auto-apply, etc.)
- Minor (x.y.0): significant feature additions within a platform
- Patch (x.y.z): bug fixes, UX tweaks

---

## 2026-06-22 — Handshake: full description scrape + Easter egg detection (Claude Code)

**Commit:** (see below)

### What shipped

**`extension/src/content/handshake.ts` — two-phase async scrape:**
- Phase 1: MutationObserver waits for job title/company (up to 12s), resolves as soon as both appear
- Phase 2: clicks all "More"/"Show more"/"See more" expand buttons in the job detail panel, waits 700ms for DOM re-render, then reads the full description across all H3 sections (`Job description`, `What they're looking for`, `What this job offers`)
- Description limit raised from 4000 → 6000 chars
- Extracted `readDescription()` helper reused in `installExternalApplyInterceptor()` so external-apply capture also gets the full text

**`src/app/api/extension/generate-cover-letter/route.ts` — Easter egg detection:**
- Single Claude call now returns TWO things in one response using a structured format (`INSTRUCTIONS_JSON:` + `COVER_LETTER:` separator)
- Claude scans for hidden applicant instructions (email addresses, external URLs, keyword/phrase requirements, sourcing signals) and returns them as a JSON string array
- If soft instructions (keywords to include) are present, Claude weaves them naturally into the cover letter body
- API response now: `{ coverLetterBody, specialInstructions: string[] }`

**`extension/src/shared/api.ts`:** `generateCoverLetter` return type updated to include `specialInstructions: string[]`

**`extension/src/sidebar/HandshakePanel.tsx` — Easter egg banner:**
- New `specialInstructions` state
- After cover letter generation, if any instructions were detected, renders `SpecialInstructionsBanner` (amber warning card with → rows per instruction) between the job info card and the error/action area
- Banner shows before the letter result so user sees actionable items immediately

### Notes
- "More" button expansion happens on every scrape, not just the first; refreshing the page will re-expand automatically since the content script re-runs
- Easter egg detection is zero-cost: piggybacks on the same Claude call that writes the cover letter, no extra latency

---

## 2026-06-22 — Handshake Settings UI (Phase 24-P2) (Claude Code)

**Commit:** (see below)

### What shipped

**`HandshakeSettings` component** (`src/components/settings/HandshakeSettings.tsx`):
- Drag-and-drop PDF upload zone for cover letters; sends up to 20 PDFs to `POST /api/user/extract-cover-letter-style`; shows spinner with progress text; displays truncated style context preview once set with re-upload option
- Resume Markdown textarea populated from `users.resume_markdown`; Save button posts to `POST /api/user/upload-resume`; inline char count, save feedback, and error state

**Session auth on API routes** (previously extension-only Bearer token):
- `src/app/api/user/extract-cover-letter-style/route.ts` — tries API key first; falls back to Supabase session cookies for web UI callers
- `src/app/api/user/upload-resume/route.ts` — same dual-auth pattern; renamed internal `createClient` alias to `createServiceClient` to avoid name collision with `@/lib/supabase/server`

**Settings page** (`src/app/(app)/settings/page.tsx`):
- Added `resume_markdown` and `cover_letter_style_context` to the single `users` SELECT
- Renders `<HandshakeSettings>` below the NotificationSettings divider

### Notes
- Pre-existing type error in `src/app/api/extension/download-cover-letter/route.ts` (`@react-pdf/renderer` createElement overload) was present before this session; left untouched

---

## 2026-06-22 — Handshake Assistant Phase 24-P0 + P1 (Claude Code)

**Commit:** cdfee47

### What happened

Built the Handshake job assistant extension — auto-scrape job details from Handshake, generate AI cover letter body, suggest resume projects to swap in. Full design doc was written in a prior session via `/office-hours`; this session was all implementation.

Also fixed two parser bugs in `scripts/seed-project-catalog.mjs` discovered during smoke testing last session.

### What shipped

**Bug fixes (seed script):**
- `parseTechStack`: was searching for `**:` (opening bold + colon) but Handshake markdown format puts the colon INSIDE the bold: `**Category:**`. Fixed to search for `:**` (colon + closing bold markers). All 10 projects now parse correctly (0 → 19 techs per project).
- `parseTechStack`: moved parenthetical strip (`\([^)]*\)`) to before the comma-split so commas inside parens (e.g. `(complex reasoning, long-form responses)`) don't create phantom tech entries.

**New migration:**
- `supabase/migrations/042_application_materials.sql` — adds `cover_letter_style_context` to users; adds `detailed_description`, `impact`, `is_active` to projects; adds unique index on `(user_id, name)` needed for upsert.

**Extension type changes (`extension/src/shared/types.ts`):**
- `AtsType` extended with `'handshake'`
- New `HandshakeJobData` interface
- `TabSessionState.handshakeContext` field
- Three new `ExtensionMessage` union members

**Extension detection (`extension/src/content/detect.ts`):**
- Added `joinhandshake.com|myhandshake.co` URL pattern, only triggers on `/jobs/\d+` paths

**Extension scraping (`extension/src/content/handshake.ts` — NEW):**
- `scrapeHandshakeJob()`: MutationObserver-based DOM scrape with 5s timeout for React SPA readiness
- `installExternalApplyInterceptor()`: captures job data on "Apply Externally" clicks before tab navigates to ATS

**Extension content wiring (`extension/src/content/index.ts`):**
- `maybeInitHandshake()` triggers on page load and SPA `backlog:navigation` events
- External-apply interceptor installed at top frame

**Extension background (`extension/src/background/index.ts`):**
- `pendingCrossPlatformContext: Map<number, HandshakeJobData>` module-level state
- `SET_HANDSHAKE_JOB_DATA`: stores in tab session + auto-injects sidebar
- `GET_HANDSHAKE_JOB_DATA`: reads from tab session for sidebar
- `STORE_CROSS_PLATFORM_JOB_CONTEXT`: stores pending context by tabId
- `onUpdated` at `status='loading'`: writes pending cross-platform context to new tab session before content scripts run

**API routes (Next.js):**
- `src/app/api/extension/generate-cover-letter/route.ts`: Claude Sonnet, style-aware, 5 CL/day limit
- `src/app/api/extension/suggest-projects/route.ts`: Haiku project ranking, 20 suggestions/day
- `src/app/api/user/extract-cover-letter-style/route.ts`: multipart PDF upload, processes up to 20 PDFs, stores style context

**Extension API wrappers (`extension/src/shared/api.ts`):**
- `generateCoverLetter()`, `suggestProjects()`, `downloadCoverLetterPdf()`, `downloadTailoredResumePdf()` added

**PDF infrastructure (Next.js server):**
- `src/lib/pdf/resume-utils.ts` — `preprocessResumeLol()`, `parseResume()`, `ParsedResume` types
- `src/lib/pdf/cover-letter-doc.tsx` — `CoverLetterDoc` React component (@react-pdf/renderer)
- `src/lib/pdf/resume-doc.tsx` — `ResumeDoc` React component
- `src/app/api/extension/download-cover-letter/route.ts` — fetches user profile, renders PDF via renderToBuffer
- `src/app/api/extension/download-tailored-resume/route.ts` — fetches resume_markdown, asks Claude to swap projects, renders PDF

**Additional API routes:**
- `src/app/api/user/upload-resume/route.ts` — `POST { markdown }` → `users.resume_markdown`
- `supabase/migrations/043_resume_markdown.sql` — adds `resume_markdown text` to users

**Scripts:**
- `scripts/upload-resume.mjs` — uploads local `resume-data/resume.md` to DB via service role key

**Sidebar (`extension/src/sidebar/HandshakePanel.tsx` — NEW):**
- Job info card (title, company, description preview), live-updates via storage onChanged listener
- "Generate cover letter" → copyable textarea → "Download cover letter PDF" (ArrayBuffer → Blob → anchor click)
- "Suggest resume projects" → ranked cards with relevance + swap talking point → "Download tailored resume PDF"
- `triggerPdfDownload()` helper, `handleDownloadCoverLetter()`, `handleDownloadResume()` all wired

**Sidebar wiring (`extension/src/sidebar/Sidebar.tsx`):**
- `HandshakePanel` routed for `page.ats === 'handshake'`
- Added `handshake: 'Handshake'` to `ATS_LABELS`

**Extension manifest (`extension/public/manifest.json`):**
- Version bumped to `3.0.0`
- Description updated to mention Handshake cover letters and resume tailoring

---

## 2026-06-06 — Discord source-mix ring chart (Claude Code)

**Commit:** a2e275d

### What happened

The user asked to enhance the Discord integration with "analytics of what percentage of
jobs were from github, discover, etc. as a chart... like those circles that are hollowed
out in the middle" (i.e. a donut/ring chart), leaving the design open. Reviewed the
existing Discord digest (`worker/src/notifications/discord.ts` — a pure ranked job listing,
Phase 15) and the dashboard's existing source-breakdown analytics (Phase 21:
`src/lib/jobs/discovery-source.ts` + `FeedBreakdown`/`SourceYield`) before designing the
addition — concluded the digest genuinely lacked any "where did these come from" context
and the chart was a worthwhile addition (see Phase 23 in PHASES.md for full design rationale).

### What shipped

- **`worker/src/notifications/discord.ts`**:
  - `SOURCE_META`/`UNKNOWN_SOURCE_META` — hex-color mirror of the dashboard's
    `DISCOVERY_SOURCES` labels/icons (worker can't import from `src/`, so it's a
    hand-maintained duplicate; keep the two in sync if sources are added/renamed).
  - `buildSourceBreakdown(rows: SourceRow[]): SourceCount[]` — counts jobs by resolved
    source key, sorts largest-first, computes percentages.
  - `sourceChartImageUrl(breakdown): string | null` — builds a QuickChart.io doughnut-chart
    image URL (`cutoutPercentage: 68` for a thin "hollowed out" ring, dark zinc background,
    percentages baked into legend labels). Returns `null` for <2 slices.
  - `sendJobsNotification` — new optional 4th param `sourceBreakdown: SourceCount[]`;
    appends a second "📊 Source mix this batch" embed (chart image + text breakdown,
    distinct zinc-800 color) only when ≥2 sources are represented.
- **`worker/src/notifications/dispatcher.ts`**:
  - `fetchSourceBreakdown(db, jobIds)` — queries `jobs.source, source_detail` for the
    written batch by ID (the DB, not `NormalizedJob.discoverySource`, is the source of
    truth here — that field is only populated for portal scrapers, not aggregator jobs).
  - Threaded `SourceCount[]` through `sendDiscordDigest` to both call sites.
- **Tests**: `discord.test.ts` — 7 new cases covering `buildSourceBreakdown`
  (counting/sorting/legacy-fallback) and the chart embed's presence/absence/content;
  `dispatcher.test.ts` — 1 new case verifying the dispatcher queries `jobs` and forwards a
  correctly-computed breakdown to `sendDiscord`.

### Verification

- Full worker suite: 124/124 pass (was 117 before this change — 7 new cases added, none
  modified beyond the signature threading).
- `tsc --noEmit`: clean (no errors).

### Next

- No rendering smoke test against a live Discord webhook — QuickChart image URLs were
  validated structurally (correct `type: 'doughnut'`, labels, percentages) but not rendered.
  Worth eyeballing the next live digest once `DISCORD_WEBHOOK_URL` fires for real.
- `SOURCE_META` in `discord.ts` is a hand-maintained duplicate of
  `src/lib/jobs/discovery-source.ts`'s `DISCOVERY_SOURCES` — if a new discovery channel is
  added to one, mirror it in the other or the chart will fall back to the generic "Other" slice.

---

## 2026-06-05 — Fix extension false-positive "applied" detection (Claude Code)

**Commit:** 9f1153b

### What happened

The new source-badge analytics (previous entry, same day) surfaced 27 "Added manually" jobs
the user never added — all `hide_from_feed: true` with linked `applied` application rows,
created silently by the extension's `extension/apply` auto-detection flow. Live DB inspection
(read-only Supabase queries) showed they were all false positives: GitHub settings pages
(`github.com/settings/emails`, repo access pages), iCIMS login/password screens, a Wells
Fargo talent-community signup — and one real application (job 72592, "Entry Level Software
Engineer") that spawned **four** separate junk stub records across its multi-step flow
("Enter Your Information" → "Enter Your Password" ×2 → final questions page), two of which
landed within 1ms of each other with different scraped URLs.

### Root causes (all in `extension/src/`)

1. `shared/postSubmit.ts` `isGenericPostSubmitPage` was just `!hasForm` — true after almost
   *any* navigation lands on a formless page, not evidence of a confirmation screen.
2. `content/detect.ts` `detectAts` matched the *entire* `icims.com`/`bamboohr.com` domains as
   `'generic'` job pages — including login/password/account paths that share the domain with
   real job postings.
3. `content/detect.ts` `hasJobForm()`'s label-text regex bare-matched
   `\bgithub\b|\blinkedin\b|\bportfolio\b` across all page labels. Those brand names appear
   constantly in the platforms' *own* UI copy (GitHub's settings pages say "GitHub"
   everywhere — "Search GitHub Apps", "Notify me about activity on GitHub"), so `isJobPage`
   flipped true on GitHub's own pages and armed the submission watcher.
4. `background/index.ts`'s `chrome.tabs.onUpdated` listener calls `maybeDetectSubmitted`
   *twice* per navigation (once with `changeInfo.url`, once with the resolved `tab.url` after
   `status === 'complete'`). Both calls could read `pendingSubmission` as non-null before
   either cleared it, each independently posting an "applied" record with a different scraped
   URL — the source of the 1ms-apart duplicate stubs on job 72592.

### What shipped

- `shared/postSubmit.ts` — rewrote `isGenericPostSubmitPage(url, hasForm, bodyText)` to
  require an explicit confirmation cue (URL keywords like `thank-you`/`confirmation`/
  `success`/`submitted`/`received`, or page text matching "thank you for applying" /
  "your application has been received" style phrases). A missing form alone no longer counts.
- `content/detect.ts` `detectAts` — scoped `icims.com`/`bamboohr.com` matching to
  `/jobs/<id>/...` paths only; everything else (login, password, account, forms) now falls
  through to the stricter DOM-based `hasJobForm()` check instead of being domain-wide
  whitelisted as a job page.
- `content/detect.ts` `hasJobForm()` — brand-name mentions now require profile/URL/handle
  wording in the *same* `<label>` (e.g. "GitHub Profile URL" passes, "Notify me about
  activity on GitHub" doesn't); kept the unambiguous `resume`/`cover letter`/
  `work authorization`/`sponsorship` phrase check unchanged.
- `background/index.ts` — replaced `pageHasForm` (boolean only) with `inspectPostSubmitPage`
  (gathers `hasForm` + up to 5KB of `document.body.innerText` in a single
  `executeScript` call, feeding the new confirmation-text check); added a per-tab
  `markingApplied` lock around `markTabApplied` and moved the `pendingSubmission` clear to
  *before* the `markApplied` network call, closing the race that produced duplicate stubs.
- `content/detect.test.ts` — rewrote the `isGenericPostSubmitPage` tests for the new
  3-argument signature, added a GitHub-settings-page regression test (`isJobPage` must stay
  `false` despite "GitHub" appearing in labels) and a brand+profile-context true-positive
  test ("GitHub Profile URL" must still be detected).

### Verification

- Extension suite: 89/89 pass (`detect.test.ts` 30/30 including 2 new regression cases).
- `tsc --noEmit`: identical error set on this branch and clean `main` (pre-existing
  `WeakRef`/lib-target gaps in `fill.ts`/`fill.test.ts`/`shared/types.ts`, a `Window` cast
  warning in `detect.ts`, two unused-variable warnings, and a missing `sidebar.css?inline`
  module declaration) — confirmed via stash comparison, none touch the files changed here.

### Next

- ~~The ~27 phantom records already in the live DB are untouched by this fix~~ — cleaned up
  in a follow-up pass, see the entry directly below.
- Spot-check in a live browser session would help confirm the fix end-to-end, but the
  underlying bug only reproduces against real third-party ATS pages — covered here via
  targeted unit/regression tests instead.

---

## 2026-06-05 — One-off cleanup of phantom "applied" records (Claude Code)

**Commit:** 29a11bf

### What happened

Follow-up to the false-positive fix above: the live DB still held ~29 phantom
`hide_from_feed: true` job stubs + linked `applied` applications created by the bug before
it was patched. Re-querying live data (joined `jobs` ↔ `applications`, full URL/title/status
inspection) showed the situation was **not** "27 obvious junk rows" as first assumed —
several were genuine, actively-tracked applications:

- TikTok ("Software Engineer, Insider Risk") had been manually progressed to `status: technical`.
- Six separate Mastercard "Software Engineer II" submissions shared one generic confirmation
  page title ("Apply Today | Mastercard jobs") but had six distinct `jobId` query params —
  six real applications, not duplicates.
- Two clusters (HR Block job 42434 ×7 records, GDMS job 72592 ×4 records) were genuinely
  ONE real multi-step application each, fired repeatedly by the (now-fixed) detector bug as
  the user clicked through login → candidate info → questions → forms.

Blind deletion on title pattern alone would have destroyed real application history. Findings
were categorized into five groups and presented to the user for a judgment call on the
duplicate clusters and one ambiguous standalone stub (GDMS job 72580, "Enter Your
Information" — no confirmation record exists for it, so it can't be told apart from an
in-progress real application).

### What shipped

- `scripts/cleanup-phantom-applications.mjs` — one-off ESM script (follows the
  `create-qa-user.mjs` convention: `node --env-file=.env.local scripts/<name>.mjs`,
  `@supabase/supabase-js` admin client from `.env.local` creds). Hardcodes the exact
  `(jobId, appId, expectedTitle)` triples to delete, **re-verifies each one live** (title,
  `hide_from_feed`, FK linkage) immediately before deleting and aborts the entire run with no
  changes if anything has shifted since the list was compiled. Deletes `applications` rows
  before `jobs` rows (FK: `applications.job_id → jobs.id`).
- Ran it after user confirmation ("delete junk + collapse duplicates to one each"). Removed
  **14** phantom `jobs`+`applications` pairs:
  - 5 unambiguous junk stubs: 4× the user's own `github.com` pages (repo, settings, profile)
    + 1× a Wells Fargo "join our talent community" signup page — none were applications.
  - 6 HR Block duplicate stubs collapsed to 1 (kept `b78e19ba-d0cd-4483-9a18-9c18a0dc515a`,
    "Associate Software Engineer, Seasonal" — the cleanest-titled candidate-info-page record).
  - 3 GDMS-72592 duplicate stubs collapsed to 1 (kept
    `e3a23411-2c25-4084-8e67-4f9a58293a5f`, "Entry Level Software Engineer" — the
    cleanest-titled questions-page record).
- Left untouched: TikTok, Absci, all 6 Mastercard records, Trimble, Busigence, micro1.ai,
  Jacobs (all genuine applications with merely-generic scraped titles), and the ambiguous
  GDMS-72580 stub.

### Verification

- Script's pre-delete verification pass printed `OK` for all 14 records (title + linkage
  matched expectations) before any row was touched; live run completed with
  `Deleted 14 application row(s)` / `Deleted 14 job row(s)`.
- Net effect: 29 phantom stubs → 15 remaining (14 genuine applications + 1 ambiguous stub
  intentionally left for the user to resolve manually later).

### Next

- The ambiguous GDMS-72580 "Enter Your Information" stub remains — the user can resolve it
  manually via the Applications tracker UI once they recall whether they actually applied to
  that posting.

---

## 2026-06-05 — Job discovery source badges + granular feed-breakdown analytics (Claude Code)

**Commit:** 1c91992

### What shipped

- New nullable `jobs.source_detail` column (`supabase/migrations/041_add_job_source_detail.sql`,
  **not yet applied to the live DB — apply manually via the Supabase dashboard**) tagging the
  exact discovery channel: `github_repo`, `brave_search`, `greenhouse`, `lever`, `workday`,
  `usajobs`, `manual_url`, `manual_entry`, `extension`.
- `src/lib/jobs/discovery-source.ts` — single source of truth mapping each channel to a
  label/icon/color/group, with graceful fallback for legacy rows (`source_detail IS NULL`).
- Worker: each portal fetcher (`greenhouse.ts`/`lever.ts`/`workday.ts`/`usajobs.ts`) now tags
  its `NormalizedJob`s with `discoverySource`; `writeJobs()` writes
  `source_detail: job.discoverySource ?? defaultSourceDetail`; `aggregator.ts` passes
  `'github_repo'` / `'brave_search'` defaults for the single-channel aggregators.
- Frontend: discovery badge shown on `JobCard` (feed) and `JobDetail` (detail panel chip);
  all manual job-creation routes (`jobs/manual`, `jobs/from-url`, `extension/add-job`,
  `extension/apply`) now write `source_detail`.
- Analytics: replaced the old 3-bucket `sourceBreakdown` (`github`/`portal`/`manual`) with a
  granular per-channel breakdown (`FeedBreakdown` in `SourceYield.tsx`) showing real
  percentages per discovery channel. `sourceYield`/`SourcePreferences`/`ConversionStats`
  intentionally left on the coarse 3-bucket system (out of scope per user's "upgrade existing
  panel" choice — that referred only to "Feed breakdown").
- Backfill: queried live DB, found legacy split `{ github: 3747, manual: 125, portal: 7 }`;
  the 7 "portal" rows had inconsistent URL domains, so backfilling would be guesswork —
  left `source_detail` NULL for legacy rows and rely on `getDiscoverySource()`'s fallback.

### Verification

- `tsc --noEmit` clean on both the frontend and `worker/` projects.
- Worker suite: 116/117 pass — the 1 failure (`normalizer.test.ts` "omits unsupported
  temperature override for gpt-5-nano") is a pre-existing vitest mock-constructor
  incompatibility, reproduced identically on `main` with these changes stashed out.
- Frontend integration suite: 166/167 pass — the 1 failure (`question-bank.test.ts`
  expecting 70 questions, getting 124) is also pre-existing and reproduces on `main`.
- Both failures are unrelated to this change; no regressions introduced.

### Next

- User needs to apply `supabase/migrations/041_add_job_source_detail.sql` in Supabase.
- Optional: spot-check the badges in a live browser session (`/qa`).

---

## 2026-05-22 — SD-P0: Question banks + concept primers + validator (Claude Code)

**Commit:** 284a3fa

### What shipped

- `src/lib/prep/prep-types.ts` — PrepQuestion + ConceptPrimer interfaces
- `src/lib/prep/system-design-bank.ts` — 70 SD questions (sd-001–sd-070), 8 topics
- `src/lib/prep/ai-engineer-bank.ts` — 60 AI Eng questions (ai-001–ai-060), 7 topics
- `src/lib/prep/concept-primers.ts` — 32 concept primers covering all SD concept slugs
- `scripts/validate-prep-bank.ts` — CI validation script (IDs, format, concept coverage)
- `scripts/mock-server-only.cjs` — Node stub for running banks outside Next.js runtime

All bank files guard with `import 'server-only'`. Validator passes clean. 105 AI-specific
concept slugs are missing primers (expected — P1 ships without them; they're reference
content, not blockers).

### Next: Codex picks up SD-P1

All P0 content is committed. Codex can now implement P1–P5 per CURRENT_TASK.md.

### Test count: 241 (unchanged — content only, no new routes)

---

## 2026-05-22 — Interview Prep Expansion: CEO + Eng review (Claude Code)

**Commit:** fbfaeba (planning session — no code committed)

### What shipped

- Full CEO plan + engineering review for SD + AI Eng bank feature.
- 13 architectural decisions locked: SR timezone fix, bank CHECK constraints, server-only boundary, AI coach guardrails, content validation timing, prompt injection mitigation, caching, indexes, company spotlight copy.
- CURRENT_TASK.md rewritten with full implementation spec for all 6 phases.
- TODOS.md: added URL state deep-linking + user-reported interview data items.

### Phase assignment

- **Claude:** SD-P0 (content: 130q + 40 primers + validate script)
- **Codex:** SD-P1–P5 (all implementation after P0 lands)

### Test count: 241 (unchanged — planning only)

---

## 2026-05-21 — Post-QW4 fixes: skeleton flash + cover-letter 403 (Claude Code)

**Commit:** 7a10237

### What shipped

- **ApplicationDetail no-flash fix** — split `useEffect` into `useLayoutEffect` (sync resets: detailLoading, timeline, detailMeta, recruiter fields, deleteState) + `useEffect` (async fetch). `useLayoutEffect` runs before paint so skeleton appears on the same frame as app selection.
- **cover-letter PATCH 403** — `PATCH /api/cover-letter/[id]` now fetches ownership before update; returns 403 for non-owner rows. Previously fell through to 500.
- **cover-letter test** — added `PATCH returns 403 for non-owner row`; updated success test to supply ownership mock.

### Test count: 241 (all passing)

---

## 2026-05-21 — Quality Wave 4 test coverage + ApplicationDetail skeleton (Codex)

### What shipped

- Added integration coverage for cover-letter, resume-tailor, and star-responses routes.
- Added explicit `403` non-owner behavior for `PATCH /api/star-responses/[id]`.
- Added ApplicationDetail skeleton placeholders while `detailMeta` loads.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/integration/cover-letter.test.ts src/tests/integration/resume-tailor.test.ts src/tests/integration/star-responses.test.ts --reporter=dot` — 29 passed
- `node node_modules/vitest/vitest.mjs run src/tests/ --reporter=dot` — 240 passed

---

## 2026-05-21 — Quality pass: 84→90 grade (Claude Code)

**Commits:** 65e9600, 081f029, 73baac0

### What shipped

- **5 new integration test suites** covering all Wave 3 routes that had no tests:
  - `keyword-gap.test.ts` — 9 tests (GET cache hit/miss, POST 401/400/404/422/success)
  - `salary-playbook.test.ts` — 9 tests (GET/POST auth, validation, structured scripts)
  - `jobs-feedback.test.ts` — 8 tests (all 5 valid reasons, bad reason, missing fields)
  - `source-preferences.test.ts` — 8 tests (all 3 valid actions, preference merge)
  - `ats-platform.test.ts` — 13 tests (all valid platforms, invalid platform, non-owner 404)
- **Architecture fix:** `POST /api/prep/salary-playbook` was calling `GET(new Request('http://localhost/...'))` internally. Extracted `loadSalaryContext()` helper called by both handlers.
- **Structured salary scripts:** POST now prompts for JSON `{ recruiter_call, email_counter, deadline_extension }` instead of free text.
- **SalaryPlaybook component:** 3-tab script panel (Recruiter call / Email counter / Deadline extension) + skeleton during initial fetch.
- **KeywordGap component:** skeleton during initial GET (was rendering invisible `null`).
- **ResumeTailor component:** button stays disabled and shows "Loading…" during initial fetch.

### Test counts after this session

- 88 unit tests
- 123 integration tests
- **Total: 211 (all passing)**

---

## 2026-05-21 — Wave 3 remaining phases P2/P5/P0/P3 (Codex)

### Implemented

- P2: ATS platform detection, completeness scoring, manual override route/UI, migrations 031/032.
- P5: job dismiss feedback reasons, feedback persistence, soft filters after 5 matching signals, migration 033.
- P0: keyword gap prompt/route/cache UI, resume-update invalidation, migration 034.
- P3: salary comp bands, salary playbook route/UI for offer-stage applications, migration 035.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/ats-completeness.test.ts src/tests/unit/feedback-filters.test.ts src/tests/unit/keyword-gap-prompt.test.ts src/tests/unit/comp-bands.test.ts src/tests/unit/application-checklist.test.ts src/tests/unit/freshness.test.ts src/tests/unit/source-preferences.test.ts src/tests/unit/application-card.test.tsx` — 19 passed

### Gotchas

- Apply migrations 030–035 in Supabase before depending on Wave 3 in production.
- Salary playbook scripts are generated on demand; comp bands are static in code.

---

## 2026-05-21 — Wave 3 P6/P8/P1/P7/P4 partial implementation (Codex)

### Implemented

- P6: Tracker detail application packet checklist.
- P8: Tracker detail prior-company application banner.
- P1: Resume tailor PDF UI wired to the actual `job_id` route contract.
- P7: Job freshness helper + Feed/Tracker badges from `jobs.fetched_at`.
- P4: `source_preferences` migration, preference API, Analytics source yield pin/hide controls, and Feed hidden-source exclusion.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/application-checklist.test.ts src/tests/unit/freshness.test.ts src/tests/unit/source-preferences.test.ts src/tests/unit/application-card.test.tsx` — 9 passed

### Gotchas

- P1 route uses `job_id`, not `application_id`, and returns `{ id, pdf_url }`.
- Migration `030_source_preferences.sql` must be applied before production use of P4 preferences.
- Next Wave 3 phase is P2 (`031_applications_ats_platform.sql`, `032_users_ats_profile_fields.sql`).

---

## 2026-05-21 — Wave 3 planning + interview kit streaming fix (Claude Code)

### Implemented

- Fixed fake streaming in `POST /api/prep/interview-kit/route.ts`: replaced blocking `generateInterviewKit()` + simulated chunk loop with `anthropic.messages.stream()` piped to a `ReadableStream`. Users now see tokens within ~1-2s instead of waiting for the full response.
- Fixed the integration test in `src/tests/integration/interview-kit.test.ts`: changed mock target to `@anthropic-ai/sdk`, used a plain constructor function (not arrow) for `MockAnthropic`, and used a plain function for `stream: () => mockStream` so `vi.resetAllMocks()` doesn't clear the module-level singleton's method.
- Planned Wave 3 via `/plan-ceo-review` SCOPE EXPANSION. CEO plan at `~/.gstack/projects/cs-keni-backlog/ceo-plans/2026-05-21-backlog-wave3.md`.
- Wrote `docs/WAVE3_PLAN.md` — full Codex implementation spec for 9 phases (P0–P8).
- Updated `docs/PRIORITY.md`, `docs/AI_CONTEXT.md`, `docs/CURRENT_TASK.md`.

### Wave 3 scope (9 phases)

P6 checklist → P8 company reuse → P1 resume tailor UI → P7 freshness badge → P4 source yield → P2 ATS completeness → P5 negative feedback → P0 keyword gap → P3 salary playbook

### Key architectural decisions

- P0 keyword gap: single LLM call (Haiku) returns gap + categories together; cached in `keyword_gaps` table; invalidated on `resume_text` update
- P2 ATS completeness: URL pattern-match for platform detection; null = no feature shown; manual override dropdown; no backfill for existing rows
- P3 salary range: static comp bands in `src/lib/salary/comp-bands.ts` (not external API); updated quarterly via code PR
- P5 negative feedback: soft filters activate only after N≥5 dismissals with same reason
- P7 liveness checker: deferred to TODOS.md (rate-limit + infra complexity); only freshness badge ships in Wave 3

### Checks

- TypeScript: clean (no new TS files changed)
- Tests: interview-kit integration test passes with plain-function stream mock

---

## 2026-05-21 — Wave 2 P4 interview day kit (Codex)

### Implemented

- Added interview kit persistence schema.
- Added prompt builder and Claude-backed interview-kit generator.
- Added authenticated streaming generation and save endpoints.
- Added Tracker detail `InterviewKit` UI gated to technical/final applications.
- Added prompt, API, and component tests.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/interview-kit-prompt.test.ts src/tests/integration/interview-kit.test.ts src/tests/unit/interview-kit-component.test.tsx` — 4 passed

### Gotchas

- Apply migrations 028 and 029 before production use of P1/P4 persistence.

---

## 2026-05-21 — Wave 2 P3 conversion analytics (Codex)

### Implemented

- Added conversion breakdown logic for company tier, title keyword, and application source.
- Added `conversionStats` to `GET /api/analytics`.
- Added `ConversionStats` UI under Analytics charts with placeholder gating until 5 callbacks.
- Added unit/component coverage and kept analytics integration coverage passing.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/conversion-stats.test.tsx src/tests/integration/analytics.test.ts` — 8 passed

---

## 2026-05-21 — Wave 2 P2 tracker health scores (Codex)

### Implemented

- Added company-tier detection and tier-specific application response windows.
- Added green/yellow/red health scoring for applied applications.
- Rendered a small health dot on Tracker applied cards with response-window tooltip context.
- Added tests for scoring and rendered card indicator behavior.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/tracker-health.test.ts src/tests/unit/application-card.test.tsx` — 6 passed

---

## 2026-05-21 — Wave 2 P1 DSA intelligence (Codex)

### Implemented

- Added migration 028 for `users.dsa_track`.
- Added `PATCH /api/dsa/track`.
- Added Blind 75 and NeetCode 250 problem sets plus `TRACK_PROBLEMS` lookup sets.
- Added DSA track switching UI and filtered DSA Today/Calendar/Problem Logger views by active track.
- Added company-pattern matching and an interview-focus Today banner for technical/final applications.
- Added unit/component/integration coverage for the new DSA track and interview-focus behavior.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/unit/dsa-tracks.test.ts src/tests/unit/dsa-recommend.test.ts src/tests/unit/company-patterns.test.ts src/tests/unit/dsa-today-panel.test.tsx src/tests/integration/dsa-track.test.ts` — 22 passed
- `git diff --check` — passed

### Gotchas

- Apply `supabase/migrations/028_add_dsa_track.sql` before production use of track persistence.
- NeetCode 250 counts were checked against `https://neetcode.io/practice/practice/neetcode250` on 2026-05-21.

---

## 2026-05-21 — Wave 2 P5 UX polish (Codex)

### Implemented

- Updated Feed card quick apply wording from `✓ Applied` to `Mark Applied`, with disabled `✓ Applied` after success.
- Updated DSA problem rows from action-style solved wording to `Mark Solved` for unsolved rows and `✓ Solved` for solved rows.
- Replaced Tracker empty-state copy/actions with the Wave 2 browse/log CTAs.
- Added `whitespace-nowrap` to the Prep Story Bank heading.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed

---

## 2026-05-21 — Wave 2 P0 bug fixes (Codex)

### Implemented

- Hardened `POST /api/jobs/manual` against company upsert misses, duplicate job URLs, duplicate user/job applications, and no-URL manual jobs.
- Added `supabase/migrations/027_allow_manual_job_url_null.sql`.
- Added `onChange` to the notification timezone select to stop React controlled-input warnings.
- Made company enrichment provider failures return existing company data instead of a UI-visible 500.
- Added `src/tests/integration/manual-jobs.test.ts` for no-URL and duplicate-URL manual job paths.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `node node_modules/vitest/vitest.mjs run src/tests/integration/manual-jobs.test.ts` — 2 passed

### Gotchas

- Wave 2 migration numbering shifted: P1 DSA track should use `028_add_dsa_track.sql`; P4 interview kits should use `029_interview_kits.sql`.
- Migration 027 was applied in Supabase after the P0 commit.

---

## 2026-05-21 — Wave 2 planning + docs cleanup (Claude Code)

### What changed

- Ran `/qa-only` on main branch. QA score: **77/100 (B+)**. Full report: `.gstack/qa-reports/qa-report-localhost-2026-05-21.md`.
- Ran `/plan-ceo-review` in SCOPE EXPANSION mode. Produced Wave 2 plan.
- **Wave 2 spec written to `docs/WAVE2_PLAN.md`** — full implementation spec for all 6 phases.
- Docs cleanup: deleted `GRADE_BOOST_PLAN.md` (complete), rewrote `PRIORITY.md`, pruned `CODEX_IDEAS.md`, updated `AI_CONTEXT.md`, added Wave 2 deferred items to `TODOS.md`.
- Commit: `9effe14`

### Wave 2 scope accepted

| Phase | What |
|-------|------|
| P0 | Fix Log Application, Settings toast, company enrich 500s |
| P5 | Button labels, Tracker empty state, STORY BANK CSS |
| P1 | DSA track modes 75/150/250 + interview-aware Today queue |
| P2 | Application health scores on Tracker cards |
| P3 | Callback rate analytics breakdown |
| P4 | Interview day kit (streaming LLM brief) |

### No code changes

Planning session only. All phases ready for Codex to implement from `docs/WAVE2_PLAN.md`.

### Known issues for next session

- BUG-001 root cause not yet confirmed — add server logging first, then fix per decision tree in WAVE2_PLAN.md.
- Migrations 020 and 021 are written but not applied in Supabase. Apply before relying on address fields or extension answer cache.

---

## 2026-05-20 — Phase 9 E2E and CI hardening (Codex)

### Implemented

- Added E2E fixture mode guarded by both `NEXT_PUBLIC_E2E_TEST_MODE=1` and the `backlog_e2e_user=1` cookie.
- Added fixture APIs/data for Playwright coverage of feed, tracker drag, prep STAR generation/save, and tracker bulk archive.
- Added `e2e/global-setup.ts`, `src/tests/e2e/fixtures/llm-mock.ts`, and four Phase 9 Playwright specs.
- Updated Playwright to invoke `node node_modules/next/dist/bin/next dev` directly and to optionally load `extension/dist`.
- Updated GitHub E2E workflow to install/build the extension and run with deterministic local fixture env vars.
- Scoped root Vitest to app tests so worker/extension suites are not duplicated in the root app job.
- Added missing `@vitest/coverage-v8`, removed stale 80% coverage thresholds, and refreshed `extension/package-lock.json` so CI `npm ci` works.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit` — passed
- `npm run test` — 115 passed
- `node node_modules/vitest/vitest.mjs run --coverage --reporter=json` — passed
- `cd worker && node ../node_modules/typescript/bin/tsc --noEmit` — passed
- `cd worker && node node_modules/vitest/vitest.mjs run` — 115 passed
- `cd extension && npm ci` — passed
- `cd extension && node node_modules/vitest/vitest.mjs run` — 84 passed
- `cd extension && npm run build` — passed
- `NEXT_PUBLIC_E2E_TEST_MODE=1 ... npx playwright test --reporter=line` — 6 passed
- `node node_modules/next/dist/bin/next build` — passed

### Gotchas

- The root `vitest` wrapper was fixed after root `npm install`, but direct entrypoints remain more reliable in this WSL checkout.
- The extension has pre-existing standalone typecheck failures; CI only runs extension tests and build.
- Playwright requires elevated execution locally because the sandbox blocks binding the Next dev server port.

---

## 2026-05-20 — Phase 3b: Bulk action bar (Claude Code)

### What happened

Codex completed Phase 3a (tracker integration tests). Picked up Phase 3b as reserved.

### Commit

`cc6c7a2` — Implement Phase 3b: bulk action bar (select mode + batch archive)

### What changed

- **`src/app/api/applications/batch/route.ts`** (new)
  - `POST /api/applications/batch` — accepts `{ ids, action: 'archive' | 'status', status? }`
  - Ownership check: queries all IDs filtered by `user_id` before any write; returns 403 if count < ids.length
  - 422 on empty ids or invalid action/status; 200 with `{ updated: N }` on success
- **`src/components/tracker/BulkActionBar.tsx`** (new)
  - Portal render via `createPortal(…, document.body)` to escape overflow:hidden ancestors
  - Pill bar: count badge, divider, Archive button (spinner on in-flight), inline error, dismiss ×
  - Spring animation: `stiffness 350, damping 35` (matches existing detail panel)
  - `position: fixed; bottom: max(24px, calc(env(safe-area-inset-bottom) + 8px))` for safe area
  - Escape key → dismiss (useEffect listener attached/cleaned on mount)
- **`src/components/tracker/ApplicationCard.tsx`**
  - Added `selectMode` and `isBulkSelected` props
  - `useDraggable` disabled when `selectMode` is true (prevents accidental drag during multi-select)
  - Checkbox overlay (absolute top-right) shown only in select mode; filled blue when selected
  - Bulk-selected card style: `bg-zinc-900/80 ring-1 ring-blue-500/40`
- **`src/components/tracker/TrackerBoard.tsx`**
  - Select mode state + selectedIds Set + bulkLoading + bulkError
  - "Select" button in toolbar (right of archive toggle); shows "Cancel · N selected" when active
  - Archive toggle hidden while in select mode (avoids conflicting affordances)
  - Kanban card clicks route to `toggleBulkSelect` in select mode, detail panel selection otherwise
  - `handleBulkArchive`: optimistic archive → POST batch → rollback on failure → 2s error then clear
  - `AnimatePresence` wraps BulkActionBar for enter/exit spring animation
- **`src/tests/integration/applications.test.ts`**
  - 3 new tests: own IDs → 200, foreign ID → 403, empty → 422

### Checks run

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts` — 17 passed (14 pre-existing + 3 new)

---

## 2026-05-20 — Phase 2a: Workday async comboboxes (Claude Code)

### What happened

Reviewed Codex's Phase 1 notification dispatcher (clean, approved). Implemented Phase 2a.

### Commit

`cf60859` — Implement Phase 2a: Workday async combobox fills (country/state cascade)

### What changed

- **`extension/src/content/fill-workday.ts`** (new)
  - `fillWorkdayCombobox(container, value)` — MutationObserver-based, 1000ms timeout; observer attaches before `trigger.click()` (critical: click handler may append options synchronously, so observer must pre-exist the click).
  - `waitForChildListChange(container, timeoutMs)` — resolves on first childList mutation or timeout fallback; drives the country → state cascade.
- **`extension/src/content/fill.ts`**
  - `WORKDAY_COMBOBOX_MAP` now has 4 entries: Country, State/Province, Work Authorization, Phone Country Code. Was state-only. Removed `buttonSelector` (no longer needed; trigger discovery is inside `fillWorkdayCombobox`).
  - `fillWorkdayComboboxes` runs country → state cascade (fill country → `waitForChildListChange(stateContainer, 300)` → fill state) then processes remaining entries.
  - Removed `clickWorkdayCombobox` (polling approach replaced). Kept `waitForListboxOptions` for the education degree picker in `fillWorkdayEducationInternal` — will be removed in Phase 2f.
- **`extension/src/content/fill-workday.test.ts`** (new)
  - 9 tests: exact match, case-insensitive, starts-with fallback, no trigger, no match, 1000ms timeout, childList mutation detection, fallback timeout, full cascade sequence.

### Key gotcha discovered

In jsdom (and real browsers), click event handlers fire synchronously. If the handler appends option elements to `document.body`, the mutation happens before the MutationObserver is set up — if you call `trigger.click()` before `observer.observe()`. Fix: always attach the observer BEFORE clicking the trigger.

### Phase 1 review notes

Codex's dispatcher is solid. One edge case worth knowing: when `pushResult.expired > 0` AND `pushResult.delivered` is true, `logStatusRows` writes both `expired` and `sent` rows for the same (user_id, job_id, channel='push') — the expired rows are noise but don't break dedup (unique index only covers `status='sent'`). Not blocking.

### What's next

Phase 2b (file upload FETCH_FILE protocol) is Codex-owned. Phase 3b (bulk action bar) and Phase 8b (Easy/Hard SR buttons) are reserved for Claude Code.

---

## 2026-05-19 — Grade boost planning (Claude Code)

### What happened

Planning-only session. Three full review passes completed (CEO + Eng + Design). No code written.

Full plan committed to `docs/GRADE_BOOST_PLAN.md`. Start there.

### Key decisions

- Notification dedup query must use `WHERE status='sent'` — failed rows must not block retry
- `daily_activity` table (migration 024) fixes DSA counter drift — `solved_at` overwrite bug makes any lc_solves derivation wrong
- Bulk select: toolbar "Select" button activates mode, NOT hover-to-reveal (hover is broken on touch)
- Filter preset apply = replace (not merge)
- Easy/Hard SR buttons: icon + text, Hard shows 300ms "Back tomorrow" flash before card exits
- Ownership checks on mutation routes must use explicit SELECT + 403, not rely on RLS (RLS returns 404 silently)
- Extension cover letter source: job-specific, fetched from `/api/applications?jobId=X` — not profile-level
- Initiate-from-Backlog URL construction: use `URL.searchParams.set()`, not string concat

### Migrations needed (not yet written)

- `022_add_filter_presets.sql`
- `023_add_review_difficulty.sql`
- `024_add_daily_activity.sql`
- `025_notification_log_schema.sql`

---

## 2026-05-18 — Worker run summaries (Codex)

### Implemented

- Added structured Brave Search discovery metrics:
  - query count
  - raw result count
  - candidate URL count
  - extracted job count
  - experience-skip count
- Added aggregator summaries for:
  - GitHub parsed/relevant/new-before-normalization counts
  - portal fetched/relevant/new-before-enrichment counts
  - portal enrichment budget
  - Brave query/extraction/relevance/new counts
  - end-of-run written count by source
- Updated `docs/PRIORITY.md` to mark worker budget reporting baseline done.

### Checks

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 48 passed
- `cd worker && npm run build` — passed

### Gotcha

This is log-only budget reporting. Persisted worker-run history is still a future enhancement.

---

## 2026-05-18 — Render log follow-up and discovery tuning (Codex)

### Implemented

- Added `docs/PRIORITY.md` with the current prioritized work list and Codex/Claude ownership.
- Tuned Brave Search discovery after Render logs showed 0 web results:
  - replaced strict quoted/exclusion queries with ATS/careers-oriented queries
  - defaulted `BRAVE_SEARCH_QUERY_LIMIT` to `8`
  - defaulted `BRAVE_SEARCH_FRESHNESS` to `pm`
- Tightened normalized portal/search filtering:
  - require explicit entry-level signal for normalized jobs
  - block `Sr` titles without requiring a dot
  - block non-US city signals embedded in titles
- Added tests for the above cases.

### Checks

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 48 passed
- `cd worker && npm run build` — passed

### Gotchas

- `jobs_source_check` log failures should be resolved by migration 19, which Kenny reported was applied successfully. Confirm on next Render run.
- Brave Search was working at the API-call level, but the old queries were too restrictive. The new approach relies on broader search plus stricter downstream filtering.

---

## 2026-05-18 — Source tracking cleanup (Codex)

### Implemented

- Removed ignored local build artifacts: `.next/` and `extension/dist/`.
- Added `supabase/migrations/019_allow_portal_job_source.sql` so `jobs.source` accepts `github`, `portal`, and `manual`.
- Updated app source typing and analytics:
  - `src/lib/jobs/types.ts`
  - `src/app/api/analytics/route.ts`
  - `src/app/(app)/analytics/page.tsx`
  - `src/components/feed/JobDetail.tsx`
- Cleaned stale source/relevance docs in `PHASES.md` and `TESTING-SUITE.md`.

### Checks

- `npm run test -- src/tests/integration/jobs-feed.test.ts` — 12 passed
- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 44 passed
- `npx tsc --noEmit` — passed

### Gotcha

Apply migration `019_allow_portal_job_source.sql` in Supabase before relying on portal/search-discovered inserts in an environment that still has the original `jobs_source_check`.

---

## 2026-05-18 — Extension/product idea memo (Codex)

### Added

- `docs/CODEX_IDEAS.md` with:
  - Workday extension review thoughts for Claude.
  - Token/cost optimization ideas.
  - Backlog product ideas.
  - Notes that `TODOS.md` / `TESTING-SUITE.md` are partially stale relative to current code.

### Key recommendation

For Workday, prioritize real DOM fixture/debug export work before more broad heuristics. The implementation already has timeout fallback and several Workday async fill helpers; the next bottleneck is observability from real failed applications.

---

## 2026-05-18 — Brave Search discovery source (Codex)

### Implemented

- Added `worker/src/search/brave.ts` to discover entry-level SWE job URLs through Brave Web Search.
- Added targeted queries for new grad, junior, associate, entry-level, early-career, AI software engineer, applied AI engineer, and LLM software engineer roles.
- Added cost controls:
  - `BRAVE_SEARCH_API_KEY` enables the source.
  - `BRAVE_SEARCH_QUERY_LIMIT` defaults to `6` per aggregation run.
  - `BRAVE_SEARCH_FRESHNESS` defaults to `pw`.
- Added cheap search-result filtering before fetching pages:
  - skip broad job boards such as Indeed/LinkedIn/Glassdoor/ZipRecruiter
  - keep likely direct ATS/company job URLs
- Added extraction for Greenhouse, Lever, and generic JSON-LD `JobPosting` pages.
- Added less-than-3-years gate that blocks explicit 3+ years professional/relevant experience requirements.
- Wired the source into `worker/src/aggregator.ts` after portal scanning.
- Added `worker/tests/unit/brave-search.test.ts`.

### Checks

- `cd worker && npm run test -- tests/unit/brave-search.test.ts tests/unit/relevance-filter.test.ts` — 44 passed
- `cd worker && npm run build` — passed

### Gotchas

- No live Brave API test was run locally; the API key is configured in Render.
- Search-discovered jobs write with source `portal`; see migration `019_allow_portal_job_source.sql`.
- The source is intentionally conservative and may skip pages that require JavaScript or lack JSON-LD.

---

## 2026-05-18 — Entry-level SWE relevance filter (Codex)

### Implemented

- Tightened `worker/src/jobs/relevance-filter.ts` so raw GitHub jobs are filtered before GPT normalization and portal jobs are filtered before enrichment using a positive software-engineering title gate.
- Removed previous PM/TPM allow behavior; the feed now targets software engineering only.
- Added blocks for ML/data/research tracks, including Machine Learning Engineer, Data Scientist, Research Scientist, NLP, computer vision, and deep learning.
- Kept AI engineering in scope for product/software titles such as AI Software Engineer, Applied AI Engineer, GenAI/LLM software roles.
- Added mid-level filtering for title signals like Software Engineer II and normalized `experience_level` values of `mid` / `senior`.
- Expanded `worker/tests/unit/relevance-filter.test.ts` to cover allowed and blocked edge cases.

### Checks

- `cd worker && npm run test -- tests/unit/relevance-filter.test.ts` — 35 passed
- `cd worker && npm run build` — passed

### Gotcha

`cd worker && npm run build` emits `worker/dist/`; it is untracked build output and was removed after the check.

---

## 2026-05-18 — Extension answer cache (Codex)

- Added `extension_answer_cache` for generated open-ended application answers.
- `/api/extension/answer-question` resolution order is now saved answer → cached generated answer → Sonnet generation.
- Cache keys use normalized question text, so punctuation/casing differences reuse answers.
- Migration 021 must be applied in Supabase to enable cache persistence.

## 2026-05-18 — Structured address fields (Codex)

- Added nullable structured address fields on `users`: `street_address`, `city`, `state`, `postal_code`.
- Extension autofill now prefers structured address values over parsing the legacy `address` string, with legacy parsing kept as fallback.
- Migration 020 must be applied in Supabase before the new profile fields can be saved in production.

## 2026-05-18 — Source yield analytics (Codex)

- Added analytics source-yield grouping so GitHub, portal/search, and manual sources can be compared by submitted applications, responses, interviews, and offers.
- Unknown/legacy job sources intentionally fall into the GitHub bucket to preserve the existing source-breakdown behavior.
- Source yield is all-time across applications, while the feed source breakdown remains range-limited to jobs fetched in the selected window.

## 2026-05-18 — Brave Portland discovery tuning (Codex)

- Reordered Brave default query budget around the production-observed winners: broad career queries produced candidates, while quoted new-grad ATS queries returned zero raw results.
- Added Portland-specific and remote-specific entry-level SWE search queries to the default 8-query budget.
- Added per-query Brave metrics so future Render logs can show which queries produced raw results, candidate URLs, extracted jobs, and accepted jobs.

## 2026-05-18 — Worker GPT-5 nano temperature compatibility (Codex)

- Render worker logs at 2026-05-18 09:00 PDT showed `gpt-5-nano` rejecting `temperature: 0` in the normalizer with `unsupported_value`.
- Removed `temperature` from worker `gpt-5-nano` calls in normalizer and enrichment fallback. The API accepts the model default instead.
- Production logs also confirmed migration 19 resolved the `jobs.source='portal'` check-constraint issue: portal/search inserts are no longer being rejected.
- Brave Search is yielding candidates but mostly duplicates. The zero-result quoted ATS queries are likely low-value compared with broader career queries.

## 2026-05-18 — Feed/source test coverage (Codex)

- Added direct worker coverage for `filterNewJobs()` so portal/search dedupe behavior is now tested alongside raw GitHub entry dedupe.
- Added `/api/analytics` integration coverage for separate `github`, `portal`, and `manual` source breakdown counts.
- Route handler tests can take ~30s locally because the root Vitest jsdom environment startup dominates runtime, even when the test body is fast.

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

## 2026-05-20 — Phase 1 notification dispatcher (Codex)

### Implemented

- Added `supabase/migrations/025_notification_log_schema.sql` with `notification_log.status`, `error`, retry indexes, and a sent-only partial unique index for `(user_id, job_id, channel)`.
- Reworked `worker/src/notifications/dispatcher.ts` into a digest dispatcher:
  - one email/push digest per user/channel/run
  - Jaccard threshold plus profile filter matching
  - quiet-hour matches recorded as `pending`
  - `failed` rows retry on later worker runs
  - `sent` rows are the only dedupe blocker
  - push 404/410 deletes expired subscriptions and logs `expired`
- Updated email/push senders to throw on misconfiguration/provider failure so the dispatcher records retryable failures.
- Worker now invokes the dispatcher every run, including zero-write runs, so pending/failed notifications are not stranded.
- Settings recent-notification history filters to `status = 'sent'`.

### Checks

- `cd worker && node node_modules/vitest/dist/cli.js run tests/unit/dispatcher.test.ts tests/unit/discord.test.ts --pool=threads` — 19 passed
- `cd worker && node ../node_modules/typescript/lib/tsc.js -p tsconfig.json` — passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `git diff --check` — passed

### Gotchas

- The plan mentioned `src/lib/notifications/*`, but Resend/Web Push are worker dependencies, so the implementation stays in `worker/src/notifications/*`.
- A full unique constraint on `(user_id, job_id, channel)` conflicts with failed-row retry. Migration 025 uses a partial unique index where `status = 'sent'` instead.
- Local npm binary wrappers for `vitest` and worker `tsc` are broken in this checkout; direct package entrypoints worked.

## 2026-05-20 — Phase 2b-2e extension core gaps (Codex)

### Implemented

- Added extension `FETCH_FILE` background proxy and content-side file upload helpers for resume and job-specific cover letter inputs.
- Added extension API-key support to `/api/jobs/:id`, `/api/applications?jobId=...`, and `/api/cover-letter/:id/pdf` so the extension can hydrate job context and fetch generated cover-letter PDFs.
- Changed Backlog feed apply action to open ATS URLs with `backlog_job_id` using `URL.searchParams`; background stores job context and strips the param.
- Replaced immediate submit-click applied marking with a submit-attempt → confirmation-detection flow:
  - Greenhouse `/applications/confirmation`
  - Lever `/apply/confirmation`
  - Workday `/applied`
  - Generic navigation followed by no remaining `<form>`
- Added sidebar job context badge and debug JSON export in review/error states.

### Checks

- `cd extension && node ../node_modules/vitest/dist/cli.js run src/content/fill.test.ts src/content/detect.test.ts src/background/fill-proxy.test.ts --pool=threads` — 75 passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts src/tests/integration/jobs-feed.test.ts` — 22 passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `cd extension && node node_modules/vite/dist/node/cli.js build && node node_modules/vite/dist/node/cli.js build --config vite.sidebar.config.ts` — passed
- `git diff --check` — passed

### Gotchas

- Extension `tsc --noEmit` still reports the same pre-existing WeakRef/sidebar-css/popup diagnostics from Phase 2a; production Vite builds pass.
- Cover letter upload depends on an existing generated cover letter for the Backlog job; otherwise it is skipped and included in debug export/manual-input review.
- Phase 2f/g decomposition is still not done and should remain P3.

## 2026-05-20 — Phase 7 job feed presets + abortable fetches (Codex)

### Implemented

- Added feed `search` to `FeedFilters`, query param construction, and the filter sidebar UI.
- Added `AbortController` handling for primary feed fetches so debounced search/filter/sort changes cancel stale in-flight requests.
- Added `supabase/migrations/022_add_filter_presets.sql` with:
  - `filter_presets` table
  - versioned JSON check (`filters.version = 1`)
  - RLS policies scoped to `auth.uid()`
  - DB-level 20-preset BEFORE INSERT trigger
- Added `/api/filter-presets` GET/POST and `/api/filter-presets/[id]` DELETE with auth, schema validation, max-20 API check, and 50-char name validation.
- Added saved preset UI in `FilterSidebar`: save modal, replacement apply behavior, active chip state, click-active-to-clear, inline delete, empty state, and 10+ count badge.

### Checks

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/filter-presets.test.ts src/tests/integration/jobs-feed.test.ts` — 17 passed
- `node node_modules/next/dist/bin/next build` — passed after rerun with network access for Google font fetches
- `git diff --check` — passed

### Gotchas

- `npm run build` still fails because `node_modules/.bin/next` cannot resolve `../server/require-hook`; direct `node node_modules/next/dist/bin/next build` works.
- User confirmed migration 022 is applied in Supabase.

## 2026-05-21 — Phase 8a DSA counter drift fix (Codex)

### Implemented

- Added `supabase/migrations/024_add_daily_activity.sql` with `daily_activity`, own-row RLS, `(user_id, problem_slug, date)` uniqueness, and an index for new-solve counts.
- Updated `POST /api/dsa/solves` to write a daily activity row based on whether the `lc_solves` row existed before the upsert.
- Used duplicate-ignore activity upserts so a same-day re-solve cannot downgrade an earlier `is_new_solve = true` first-solve row.
- Updated `/dsa` server page to derive `newSolvesToday` from `daily_activity` count for today instead of `lc_solves` timestamps.
- Updated DSA client solve logging so the UI count increments only when the API returns `isNewSolve: true` for today.

### Checks

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/dsa-solves.test.ts src/tests/unit/dsa-schedule.test.ts src/tests/unit/dsa-recommend.test.ts` — 23 passed
- `node node_modules/next/dist/bin/next build` — passed

### Gotchas

- Migration 024 is written but still needs to be applied in Supabase.
- Phase 8b remains Claude-reserved.

## 2026-05-20 — Phase 3a tracker integration tests (Codex)

### Implemented

- Expanded `src/tests/integration/applications.test.ts` so status mutation tests assert `last_updated` and exact timeline payloads, not just insert call counts.
- Added `/api/extension/apply` integration coverage for extension-created applications:
  - unknown URL creates a hidden job stub, application row, and extension timeline row
  - explicit saved application ID transitions to applied with one timeline row
  - invalid extension API key short-circuits before Supabase access

### Checks

- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/applications.test.ts` — 14 passed
- `node node_modules/typescript/lib/tsc.js --noEmit` — passed

### Gotchas

- Extension-created job stubs still use `source: 'manual'` because migration 019 and the app type union only allow `github | portal | manual`; analytics already presents manual as pasted URLs or extension.
- Playwright rollback coverage remains for the later E2E phase.

## 2026-05-20 — Phases 4, 5, 6, 2f/g (Codex)

### Implemented

- Analytics UI split into focused `src/components/analytics/*` modules; analytics page now owns both analytics and company graph fetches.
- `CompanyGraph` now renders a graph-specific ghost-node skeleton during data load/simulation settle and fades the canvas in after `onEngineStop`.
- Prep question bank split into `QuestionList`, `CulturalSignals`, `QuestionsToAsk`, and `StoryMatch` modules.
- Company enrich endpoint accepts `{ force: true }`, bypasses the stale-data short circuit, and returns 429 when refreshed within the last 24 hours.
- Prep company panel has a refresh button with loading and inline cooldown/error states.
- Extension profile endpoint no longer uses `select('*')`; it selects only the fields needed by the extension.
- Work history, education, projects, and saved answers PATCH/DELETE routes explicitly read `user_id` before mutation and return 403 for foreign rows.
- Extension fill helpers split into `fill-address.ts` and `fill-fields.ts`; sidebar scan/fill/review/error states split into separate modules.

### Checks

- `node node_modules/typescript/lib/tsc.js --noEmit` — passed
- `node node_modules/vitest/dist/cli.js run --pool=threads src/tests/integration/analytics.test.ts src/tests/integration/profile.test.ts src/tests/integration/applications.test.ts` — 28 passed
- `cd extension && node ../node_modules/vitest/dist/cli.js run src/content/fill.test.ts src/content/fill-workday.test.ts src/background/fill-proxy.test.ts --pool=threads` — 59 passed
- `cd extension && node node_modules/vite/dist/node/cli.js build && node node_modules/vite/dist/node/cli.js build --config vite.sidebar.config.ts` — passed
- `node node_modules/next/dist/bin/next build` — passed

### Gotchas

- The profile ownership checks intentionally query by raw row id before mutation instead of relying on `.eq('user_id', user.id)` filtering, so foreign-row attempts return 403 rather than RLS-style 404.
- The resume route test uses a mocked Request-like object for `formData()` because jsdom/FormData can produce a different Blob realm than the route’s `instanceof Blob` check.

## 2026-05-21 — Polish Pass PP-1 through PP-4 (Codex)

### Implemented

- Added user `notification_timezone` migration and wired notification settings/profile APIs plus the settings timezone picker.
- Worker dispatcher now evaluates quiet hours in each user's IANA timezone and has timezone-specific unit coverage.
- Company graph integration coverage now includes unauthenticated 401 behavior.
- Added LLM prompt-shape tests for STAR generation, cover letters, interview guides, and extension answer-question cache misses.
- Expanded all five Playwright E2E specs to 40–60 LOC with negative/boundary coverage.
- Added an E2E fixture path for forced company refresh cooldown responses.
- Deferred Anthropic-backed imports in resume tailor and cover-letter routes so fixture-mode GET/POST requests do not compile LLM paths.

### Checks

- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed
- `npm run test` — 120 passed
- `npm run test -- src/tests/integration/analytics.test.ts src/tests/unit/llm-prompts.test.ts` — 8 passed
- `cd worker && node node_modules/vitest/vitest.mjs run tests/unit/dispatcher.test.ts` — 13 passed
- `cd worker && node ../node_modules/typescript/bin/tsc --noEmit` — passed
- `cd worker && node node_modules/vitest/vitest.mjs run` — 117 passed
- `cd extension && npm test` — 84 passed
- `NEXT_PUBLIC_E2E_TEST_MODE=1 ... npx playwright test --reporter=line --workers=1` — 12 passed
- `git diff --check` — passed

### Gotchas

- Migration 026 is written but still needs to be applied in Supabase.
- Local Playwright should use `--workers=1` for this repo; parallel Next dev workers produced intermittent chunk-load failures in the local WSL workspace.
- `npm run lint` still fails on existing repo lint debt/generated files; direct eslint also reports existing React Compiler issues outside this pass.
- `cd worker && npm test` still fails locally because the worker Vitest binary wrapper points at `node_modules/.bin/dist/cli.js`; use `node node_modules/vitest/vitest.mjs run`.
- Existing browser hydration warnings remain in feed/tracker, but they are not new to this polish pass and do not fail the suite.

## 2026-05-22 — Interview Prep Expansion SD-P1 through SD-P5 (Codex)

### Implemented

- Added question progress, prep review, and prep practice response migrations (`036`–`038`) with RLS and bank/question prefix checks.
- Added question bank, progress upsert, prep review queue, and AI coach API routes for system design and AI engineer banks.
- `/prep` now has a General Prep section above job-specific prep with a unified progress dashboard, company spotlight, spaced repetition queue, SD/AI bank accordions, concept primers, and AI coach evaluation.
- Added company spotlight and AI role-detection helpers plus route/unit tests.
- Added a Vitest alias for `server-only` so static server-only prep content can be imported in route tests.

### Checks

- `npx tsx --require ./scripts/mock-server-only.cjs scripts/validate-prep-bank.ts` — passed with expected P0 warnings.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false` — passed.
- `node node_modules/vitest/vitest.mjs run src/tests/ --reporter=dot` — 259 passed.
- `git diff --check` — passed.

### Gotchas

- The prep bank validator needs `tsx`; first sandboxed `npx` attempt failed on network (`EAI_AGAIN`), then passed after approved `npx tsx` network access.
- Supabase migrations 028–038 still need to be applied before relying on persistence in production.
