# Backlog

> A real-time job aggregation and application tracking web app built for software engineers who know that applying early is half the battle.

---

## What Is Backlog?

Backlog is a personal web application designed to streamline the software engineering job search. Most job tracking tools are either too generic, too slow, or too buggy. Backlog is built from the ground up to solve a specific problem: **the best time to apply to a new SWE role is within hours of it being posted**, and most people miss that window because they're manually checking five different websites.

Backlog fixes this by aggregating job postings in real time from community-maintained GitHub repositories like [SimplifyJobs/New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions) and normalizing everything into a single, clean feed. It also tracks every job you've applied to, where you are in the interview process, helps you prepare for interviews, and generates tailored application materials — all in one place.

**The core loop:**

1. New jobs are discovered and normalized automatically from GitHub sources
2. You see a clean, filtered feed of relevant roles ranked by recency and match score
3. You get alerted (email, browser push, or SMS) when a high-match job drops
4. You generate a tailored resume and optional cover letter per application
5. You track applications through the full pipeline (saved → applied → interviewing → offer / rejected)
6. You prep for interviews using company-specific behavioral and technical questions
7. You review your activity and trends on the analytics page

Backlog is primarily a personal tool, but it's architected for multiple users. Account creation is locked by default — accounts are provisioned manually via Supabase.

---

## Design

### Tech Stack

| Layer                  | Choice                                   | Why                                                                                      |
| ---------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| Frontend               | **Next.js (App Router)**                 | SSR, API routes, Vercel-native, file-based routing maps cleanly to app pages             |
| Styling                | **Tailwind CSS**                         | Utility-first, fast to iterate, consistent without a component library                   |
| Animations             | **Framer Motion**                        | Spring physics, staggered entrances, gesture support — page transitions, card entrances  |
| Drag & Drop            | **@dnd-kit/core**                        | Modern accessible DnD primitive; Framer Motion handles animation on top                  |
| Rich Text              | **Tiptap**                               | Headless rich text editor for application notes — stores as ProseMirror JSON             |
| Command Palette        | **cmdk**                                 | Headless command menu primitive powering Cmd+K fuzzy search                              |
| Backend                | **Next.js API Routes + Render (worker)** | API routes for app logic; Render Web Service runs aggregation on 8h cron + `/run` endpoint for manual triggers |
| Database               | **Supabase (PostgreSQL)**                | Managed Postgres with built-in auth, RLS, and real-time subscriptions                    |
| LLM — High Frequency   | **GPT-4o-mini (OpenAI)**                 | $0.15/1M tokens, fast — job normalization, match scoring, URL job extraction             |
| LLM — Quality Tasks    | **Claude Sonnet 4.6 (Anthropic)**        | Cover letters, resume tailoring, STAR responses, extension open-ended field answers      |
| Email Notifications    | **Resend**                               | Simple REST API for transactional email, generous free tier                              |
| Push Notifications     | **Web Push API**                         | Native browser push — no third-party service, works across Chrome and Firefox            |
| SMS Notifications      | **Twilio**                               | SMS as high-urgency channel — can be deferred if overkill for personal use               |
| File Storage           | **Supabase Storage**                     | Stores resume uploads and generated PDFs; `resume_url` and `pdf_url` fields point here   |
| PDF Parsing            | **pdf-parse**                            | Lightweight server-side text extraction from uploaded resume PDFs                        |
| PDF Generation         | **@react-pdf/renderer**                  | Generates tailored resume PDFs server-side — lighter than Puppeteer, no headless browser |
| Charts                 | **Recharts**                             | Composable, React-native chart library                                                   |
| Unit/Integration Tests | **Vitest**                               | Better ESM support than Jest for Next.js 14+, fast, same assertion API                   |
| API Mocking (tests)    | **MSW (Mock Service Worker)**            | Intercepts fetch in tests — no real API calls to OpenAI/Anthropic/GitHub in CI           |
| E2E Tests              | **Playwright**                           | Real browser E2E runner — tests full user flows; unrelated to extension DOM manipulation |
| Hosting                | **Vercel (frontend) + Render (workers)** | Both have generous free tiers; Render Web Service handles long-running jobs + manual trigger endpoint |
| Browser Extension      | **Chrome MV3 + Firefox MV2 compat**      | MV3 required for Chrome Web Store; thin MV2 shim for Firefox                             |

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Next.js (Vercel)                     │
│  - Job feed UI (real-time via Supabase subscription)     │
│  - Application tracker / kanban                          │
│  - Resume upload + tailoring                             │
│  - Cover letter generator                                │
│  - Interview prep (behavioral / technical questions)     │
│  - Analytics page + dashboard mini-stats                 │
│  - Auth (Supabase Auth — registration locked)            │
└───────────────────────┬──────────────────────────────────┘
                        │ API Routes + Supabase SDK
┌───────────────────────▼──────────────────────────────────┐
│                  Supabase (PostgreSQL)                    │
│  - jobs                  (normalized postings)           │
│  - applications          (user pipeline + notes)         │
│  - application_timeline  (full status change history)    │
│  - users                 (full structured profile)       │
│  - work_history          (structured work entries)       │
│  - education             (structured education entries)  │
│  - saved_answers         (pre-written common answers)    │
│  - resume_versions       (tailored resume PDFs per job)  │
│  - match_scores          (lazy-cached per user per job)  │
│  - cover_letters         (per application, not per job)  │
│  - company_profiles      (description, Q&A bank)         │
│  - sources               (GitHub repos + fetch schedule) │
│  - notification_log      (alert log per user/channel)    │
│  - api_keys              (user-scoped extension tokens)  │
│  - Real-time subscriptions → live feed updates           │
└───────────────────────▲──────────────────────────────────┘
                        │ writes normalized jobs
┌───────────────────────┴──────────────────────────────────┐
│              Aggregation Worker (Render)                  │
│  - Cron jobs poll SimplifyJobs + similar GitHub repos    │
│  - GitHub API fetches latest commits / markdown diffs    │
│  - GPT-4o-mini normalizes raw entries into DB schema     │
│  - Deduplication before writing                          │
│  - Upserts minimal company_profiles stub per new company │
│  - Triggers notification pipeline for matching users     │
└──────────────────────────────────────────────────────────┘
                        │ alerts
┌───────────────────────▼──────────────────────────────────┐
│              Notification Service                         │
│  - Resend → email alerts                                 │
│  - Web Push API → browser push notifications             │
│  - Twilio → SMS to registered phone number               │
│  - Deduplication: checks notification_log before sending │
└──────────────────────────────────────────────────────────┘
```

### Database Schema (Full)

**`jobs`**

- `id`, `title`, `company`, `company_id`, `location`, `salary_min`, `salary_max`, `url`, `source` (github | manual), `posted_at`, `fetched_at`, `description`, `tags[]`, `is_remote`, `experience_level`
- `source` distinguishes automated aggregation (`github`) from user-pasted manual entries (`manual`)

**`applications`**

- `id`, `user_id`, `job_id`, `status` (saved | applied | phone_screen | technical | final | offer | rejected), `applied_at`, `notes` (`jsonb` — Tiptap ProseMirror format), `recruiter_name`, `recruiter_email`, `last_updated`

**`application_timeline`** ← full status history; enables timeline UI in detail panel

- `id`, `application_id`, `from_status`, `to_status`, `changed_at`, `note`

**`users`** ← full structured profile; source of truth for extension auto-fill

- `id`, `email`, `full_name`, `phone`, `address`
- `linkedin_url`, `github_url`, `portfolio_url`
- `citizenship_status`, `visa_sponsorship_required` (bool), `willing_to_relocate` (bool)
- `resume_text`, `resume_url`
- `preferred_locations[]`, `preferred_salary_min`, `preferred_role_types[]`, `remote_preference` (remote | hybrid | onsite | any)
- `skills[]`, `experience_level`, `years_of_experience`
- `notification_email` (bool), `notification_push` (bool), `notification_sms` (bool)
- `notification_quiet_hours_start` (time), `notification_quiet_hours_end` (time)
- `alert_match_threshold`

**`work_history`** ← structured work entries; used by extension to fill work experience sections

- `id`, `user_id`, `company`, `title`, `start_date`, `end_date`, `is_current` (bool), `description`

**`education`** ← structured education entries; used by extension to fill education sections

- `id`, `user_id`, `school`, `degree`, `field_of_study`, `gpa`, `graduation_year`

**`saved_answers`** ← pre-written answers to common application questions

- `id`, `user_id`, `question`, `answer`
- Extension checks these before falling back to LLM generation for open-ended fields

**`star_responses`** ← STAR method prep responses per company, reusable across applications

- `id`, `user_id`, `company_id` (nullable — some responses are general-purpose), `question`, `situation`, `task`, `action`, `result`, `full_response`, `created_at`, `updated_at`
- Surfaced in per-application Prep tab; used as few-shot context when extension calls LLM for open-ended answers

**`push_subscriptions`** ← browser push subscription objects, one per device/browser

- `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`
- Required by Web Push API to push to a specific browser; stored when user enables push notifications

**`resume_versions`** ← tailored resumes per job, never overwrites base resume

- `id`, `user_id`, `job_id`, `content_text`, `pdf_url`, `created_at`

**`match_scores`** ← lazy-computed and cached; invalidated when resume changes

- `id`, `user_id`, `job_id`, `score`, `rationale`, `computed_at`, `is_stale` (bool)
- UNIQUE constraint on `(user_id, job_id)` — upsert on conflict, never accumulate duplicates

**`cover_letters`** ← linked to application_id; handles reapplication edge case

- `id`, `user_id`, `application_id`, `template_type` (formal | casual | startup), `content`, `pdf_url` (nullable — generated on finalize, used by extension for file attachment), `created_at`

**`company_profiles`**

- `id`, `name`, `description`, `glassdoor_rating` (nullable — populated via third-party API, not LLM), `headcount_range`, `funding_stage`, `behavioral_questions[]`, `technical_questions[]`, `last_updated`

**`sources`**

- `id`, `name`, `type` (github), `url`, `last_fetched_at`, `fetch_interval_minutes`

**`notification_log`**

- `id`, `user_id`, `job_id`, `channel` (email | push | sms), `sent_at`

**`api_keys`** ← user-scoped tokens for browser extension authentication

- `id`, `user_id`, `key_hash`, `label`, `last_used_at`, `created_at`, `revoked_at`

### RLS Policy Summary

| Table                  | Authenticated Read                | Write                                                      |
| ---------------------- | --------------------------------- | ---------------------------------------------------------- |
| `jobs`                 | All users                         | Service role only (aggregation worker + URL extractor API) |
| `company_profiles`     | All users                         | Service role only                                          |
| `match_scores`         | Own rows                          | Own rows (server-side on demand)                           |
| `applications`         | Own rows (`user_id = auth.uid()`) | Own rows                                                   |
| `application_timeline` | Via application ownership         | Via application ownership                                  |
| `users`                | Own row                           | Own row                                                    |
| `work_history`         | Own rows                          | Own rows                                                   |
| `education`            | Own rows                          | Own rows                                                   |
| `saved_answers`        | Own rows                          | Own rows                                                   |
| `resume_versions`      | Own rows                          | Own rows                                                   |
| `cover_letters`        | Own rows                          | Own rows                                                   |
| `notification_log`     | Own rows                          | Service role (dispatcher writes)                           |
| `push_subscriptions`   | Own rows                          | Own rows                                                   |
| `star_responses`       | Own rows                          | Own rows                                                   |
| `api_keys`             | Own rows                          | Own rows                                                   |
| `sources`              | All users                         | Service role only                                          |

### Auto-Fill Flow (End-to-End)

```
1. User sees a job in Backlog feed → clicks "Auto-Apply"
2. ATS page opens in a new tab (Greenhouse, Lever, Workday, etc.)
3. Extension content script activates, traverses DOM, detects all form fields
4. Extension loads user's structured profile from local cache (fetched on init, one API call)
5. Standard fields filled via DOM manipulation — no LLM:
     Name, email, phone, address
     LinkedIn, GitHub, portfolio URLs
     Work authorization / citizenship / visa sponsorship
     Work history entries (company, title, dates, description)
     Education (school, degree, GPA, graduation year)
     Skills, years of experience
6. Open-ended text fields:
     a. Check saved_answers for a matching pre-written response → use it
     b. Fall back to Claude Sonnet: profile + STAR responses as context → generate answer
7. Resume and cover letter attached to file upload fields
8. Extension popup shows a review panel — all filled values visible and editable
9. User reviews, adjusts if needed, clicks the site's native Submit button
10. Extension detects submission (navigation event or XHR success response)
    → Calls Backlog API → status set to "Applied", applied_at stamped
    → application_timeline row written
    → Toast in Backlog: "Marked as Applied"
```

**Workday note:** Workday uses Angular-rendered inputs that ignore direct `value` assignment. The extension must dispatch synthetic `InputEvent` and `change` events after setting values. Supported on a best-effort basis — some Workday forms may require manual correction in the review step.

### "Add Job from URL" Flow

```
User pastes URL into "Add Job from URL" input in Backlog feed
→ Backend detects URL pattern:
    boards.greenhouse.io/*  → Greenhouse Jobs API → clean structured JSON
    jobs.lever.co/*         → Lever Postings API  → clean structured JSON
    Other static pages      → server-side HTML fetch + GPT-4o-mini extraction
    JS-rendered / fails     → prompt user: "Open this page in Chrome and click
                               'Add to Backlog' in the extension"
→ Job normalized and written to jobs table with source = 'manual'
→ Job appears in feed; can be auto-applied like any aggregated job

Alternative: on any job posting page, click "Add to Backlog" in the extension popup.
Content script extracts JD from the already-rendered page (no server-side fetch needed)
and sends it to the Backlog API. Works on all sites including Workday.
```

### Job Sources (Phase 1 Scope)

| Source                              | Method                                                 | Update Frequency |
| ----------------------------------- | ------------------------------------------------------ | ---------------- |
| SimplifyJobs/New-Grad-Positions     | GitHub API — poll for new commits, parse markdown diff | Every 8 hours    |
| SimplifyJobs/Summer2025-Internships | GitHub API                                             | Every 8 hours    |
| Other community GitHub job repos    | GitHub API                                             | Every 8 hours    |
| User-pasted URLs                    | Greenhouse/Lever public API or HTML fetch + LLM parse  | On demand        |

Additional sources (LinkedIn, Indeed, Glassdoor) are deferred to a future phase due to scraping complexity and ToS considerations.

### LLM Strategy

| Task                                                           | Model             | Rationale                                                                    |
| -------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| Job normalization (title, salary, location, skills extraction) | GPT-4o-mini       | High frequency, low cost, fast                                               |
| URL-pasted job extraction (non-Greenhouse/Lever)               | GPT-4o-mini       | Same normalization pipeline, on demand                                       |
| Resume match scoring                                           | GPT-4o-mini       | Lazy + cached in `match_scores`; invalidated on resume change                |
| Resume tailoring for a specific job                            | Claude Sonnet 4.6 | Quality matters, fewer calls                                                 |
| Cover letter generation                                        | Claude Sonnet 4.6 | Nuanced writing, template adherence                                          |
| STAR method response drafting                                  | Claude Sonnet 4.6 | Structured, thoughtful output                                                |
| Cover letter template selection                                | Claude Sonnet 4.6 | Reads job/company tone, picks formal/casual/startup                          |
| Extension: open-ended question answers                         | Claude Sonnet 4.6 | Only invoked after checking saved_answers; standard fields use local profile |

### Key Features

**Real-Time Job Feed**

- Supabase real-time subscriptions push new jobs to the UI without a page refresh
- Jobs sorted by `posted_at` — newest first, always
- "Just posted" badge on jobs under 3 hours old
- Cursor-based infinite scroll — 25 jobs per page, fetches next batch on scroll
- "Add Job from URL" — paste any job link; Backlog normalizes and adds it to your feed

**Match Scores**

- Shown as "Upload your resume to see match scores" until Phase 5 resume upload is done — Phase 3 is never blocked on this
- After Phase 5: computed lazily on first view per user, stored in `match_scores`, invalidated when resume changes
- Rationale shown alongside score so you understand why it matched

**Filters & Search**

- Location (city, state, remote, hybrid, on-site), salary range, experience level, role type
- Saved filter presets

**Profile & Settings**

- Full structured profile covering everything a job application asks for
- This profile is the sole data source for the extension's standard field filling — no LLM needed for name/email/address/work history/education
- Pre-written answers to common questions act as the first lookup before LLM generation
- Profile completeness indicator shows what's missing and what it affects

**Resume Management**

- Upload a PDF resume — text is extracted and stored in your profile
- "Tailor for this job" — Claude rewrites your resume bullets aligned to JD, without fabricating experience
- Tailored versions stored in `resume_versions`; base resume is never overwritten
- PDFs generated via `@react-pdf/renderer`

**Cover Letter Generator**

- Optional; triggered per job
- Claude reads JD + company profile + resume → selects template → generates letter
- Inline editor; saved to `cover_letters` by `application_id`

**Application Pipeline / Kanban**

- Drag-and-drop via `@dnd-kit/core`; Framer Motion handles animation
- Stages: `Saved → Applied → Phone Screen → Technical → Final Round → Offer / Rejected`
- Every status transition writes a row to `application_timeline`
- Detail panel: Tiptap rich-text notes, recruiter info, full timeline

**Company Intelligence Panel**

- Minimal company stub upserted during aggregation — panel is never empty
- Phase 7 enriches stubs with full description, headcount, funding stage
- Glassdoor ratings: populated via third-party data API, not LLM (LLM cannot look up live ratings)
- Behavioral and technical question bank per company

**Interview Prep**

- Per-application "Prep" tab with company-specific questions
- STAR response builder: Claude drafts using your profile → you edit and save
- Saved responses reusable across similar applications

**Alert System**

- Threshold-based alerts across email, push, SMS
- Dispatcher checks `notification_log` before sending — no duplicate alerts
- Quiet hours respected via `users.notification_quiet_hours_start/end`

**Analytics**

- Jobs posted today vs. 7-day rolling average
- Application activity chart — weekly / monthly / yearly
- Application funnel from `application_timeline`
- Response rate, time-to-first-response distribution
- Manually-added jobs vs aggregated jobs breakdown

---

## Quality of Life / UX

- **Dark mode by default** — designed dark-first, light mode optional
- **Framer Motion throughout** — staggered job card entrances on feed load, spring-physics drag on kanban, smooth page transitions, micro-animations on buttons and badges
- **Loading skeletons** — every async surface has a skeleton state, no blank screens
- **Keyboard shortcuts** — `F` to focus filters, `K`/`J` to navigate job cards, `A` to mark as applied, `?` to show shortcut cheatsheet
- **Onboarding flow** — first login prompts resume upload + notification preferences + alert configuration before showing the feed
- **Profile completeness indicator** — shows what's missing and what features it unlocks (e.g. "Add work history to improve auto-fill accuracy")
- **"Quick apply" action** — one-click to mark a job as applied directly from the feed card
- **Recruiter contact auto-detection** — when pasting a job URL into notes, LLM attempts to extract recruiter name and email
- **Application age indicator** — visual cue when a saved job is getting old ("applied 12 days ago — follow up?")
- **Responsive layout** — fully usable on mobile
- **Toast notifications** — non-blocking feedback for all actions
- **Command palette** (`Cmd+K`) — fuzzy search via `cmdk`
- **Empty state illustrations** — friendly empty states instead of blank boxes
- **Optimistic UI updates** — kanban card moves feel instant; rollback on failure

---

## Phases

### Phase 1 — Foundation & Auth

- [x] Initialize Next.js project with App Router, Tailwind CSS, Framer Motion, @dnd-kit/core, Tiptap, cmdk
- [x] Configure Supabase — create all tables per schema above, enable RLS with all policies, set up auth (migration at `supabase/migrations/001_initial_schema.sql`)
- [x] Create Supabase Storage buckets: `resumes` (private, user-scoped) and `generated-pdfs` (private, user-scoped)
- [x] Create Postgres trigger on `auth.users` insert → auto-creates corresponding row in `public.users` with `id = auth.uid()` — without this, the profile page has nothing to read/write
- [x] Build auth pages: login, "registration closed" message on signup
- [x] Provision admin account directly in Supabase
- [x] Build base layout: sidebar nav, header, route structure (`/feed`, `/tracker`, `/analytics`, `/prep`, `/profile`, `/settings`)
- [x] Implement protected routes — redirect unauthenticated users to login
- [x] Deploy skeleton app to Vercel; confirm environment variables and Supabase connection
- [x] Set up Vitest + MSW for unit/integration tests; set up Playwright for E2E tests
- [x] Write E2E test: unauthenticated user is redirected to login

### Phase 2 — Job Aggregation Engine

- [x] Set up Render worker service (Node.js) — scaffolded at `worker/` with its own package.json; deploy to Render as a Background Worker pointed at `worker/`
- [x] Integrate GitHub API to poll SimplifyJobs/New-Grad-Positions for new commits (`worker/src/github/fetcher.ts`)
- [x] Add SimplifyJobs/Summer2026-Internships as a second aggregation source — aggregator refactored to support multiple sources, each with its own `role_type` tag
- [x] Parse README markdown table to extract new job entries (`worker/src/github/parser.ts`) — handles ↳ sub-rows, 🔒 locked rows, markdown + HTML links, multi-location `<br>` cells
- [x] Integrate GPT-4o-mini to normalize raw entries into `jobs` schema (`worker/src/llm/normalizer.ts`) — batched 20 at a time, falls back gracefully on API failure
- [x] Implement deduplication logic before DB writes — URL-first (UNIQUE constraint); runs before normalization to avoid burning OpenAI tokens on already-stored jobs (`worker/src/jobs/deduplicator.ts`)
- [x] Upsert minimal `company_profiles` stub (name + id) for each new company during aggregation (`worker/src/db/writer.ts`)
- [x] Schedule cron jobs — every 15 min via `node-cron` (`worker/src/index.ts`); immediate run on startup
- [x] Write aggregated jobs to Supabase using service role key — never anon key (`worker/src/db/client.ts`)
- [x] Add `sources` table management and last-fetched + last-sha tracking (`worker/src/db/sources.ts`); migration 002 adds `last_sha` column
- [x] Unit tests: markdown parser (including edge cases), date parsing, deduplication logic (`worker/tests/`)
- [ ] Integration test: mock GitHub API response → worker writes correct rows to test DB

### Phase 3 — Job Feed & Discovery

- [x] Build real-time job feed UI with Supabase subscriptions
- [x] Cursor-based infinite scroll — 25 jobs per fetch, load more on scroll
- [x] Job card component: title, company, location, salary, posted time, "Just posted" badge
- [x] Match score placeholder — show "Upload your resume to see your match score" until Phase 5. Do not block Phase 3 on scoring.
- [x] Job detail page/drawer: full description, company panel (stub data from Phase 2 for now), apply button, save button
- [x] Filter sidebar: location, salary range, experience level, role type, remote toggle
- [x] `role_type` column added to `jobs` table (migration 003); worker writes `full_time` vs `internship` based on source; role type filter now functional
- [ ] Saved filter presets
- [x] Sort controls (newest, salary)
- [x] Date range filter (All time / 24h / 7 days / 30 days / 1 year) — sidebar preset buttons + API `posted_at` filter
- [x] Fix infinite scroll — cursor switched from `posted_at` (nullable) to `fetched_at` (always non-null); eliminates duplicate page loads
- [x] Company logos via Clearbit API — ATS-aware domain extraction (Greenhouse/Lever slug → domain); falls back to letter avatar
- [x] Idle auto-logout — 8h of inactivity triggers sign-out; `IdleLogout` client component in app layout
- [x] Refresh button moved from fixed bottom-left overlay into FeedHeader inline (next to sort tabs)
- [x] Fix aggregation parser — README switched from markdown pipe tables to HTML `<table>` format; parser rewritten to handle `<tr>`/`<td>` rows and new `Xd` age format
- [x] **"Add Job from URL"** feature:
  - Input in feed header (or modal) for pasting a job URL
  - Backend: detect Greenhouse/Lever URL → use their public API; other URLs → HTML fetch + GPT-4o-mini
  - On failure (JS-rendered) → show prompt: "Open this page in Chrome and use the extension"
  - Job written to `jobs` with `source = 'manual'`; appears in feed immediately
  - `lib/jobs/url-extractor.ts` handles all URL → normalized job logic
- [x] Skeleton loading states for feed and detail
- [x] Integration tests: URL extractor identifies Greenhouse/Lever URLs correctly; feed query param builder verified
- [ ] E2E test: login → feed loads → filter by remote → jobs update; paste Greenhouse URL → job appears in feed

### Phase 4 — Application Tracker

- [x] Kanban board with drag-and-drop (`@dnd-kit/core` for DnD logic, Framer Motion for animation)
- [x] Application stages: Saved → Applied → Phone Screen → Technical → Final → Offer / Rejected
- [x] Every status transition writes a row to `application_timeline` — never update status without logging the change
- [x] Application detail panel: Tiptap rich-text notes (stored as `jsonb`), recruiter info, application URL, timeline rendered from `application_timeline`
- [x] "Quick apply" action from feed card
- [x] Application age and follow-up nudges
- [x] Animations: card entrance, drag physics, stage transition
- [ ] Unit tests: status transition logic, timeline write, optimistic update rollback
- [ ] Integration tests: PATCH /applications/:id updates status + writes timeline row
- [ ] E2E test: drag card from Applied → Phone Screen → verify timeline shows the change

### Phase 5 — Resume & Profile

- [ ] Profile page with all structured fields from `users` schema: personal info, contact, work authorization, preferences, experience level, years of experience
- [ ] Work history section (`work_history` table): add/edit/delete structured entries (company, title, dates, description, is_current)
- [ ] Education section (`education` table): add/edit/delete structured entries (school, degree, field, GPA, graduation year)
- [ ] Skills list (user-managed tags)
- [ ] Pre-written answers (`saved_answers` table): user can add question/answer pairs for common prompts — these will be used by the extension before falling back to LLM
- [ ] PDF resume upload → text extraction via `pdf-parse` (`lib/pdf/parser.ts`) → store in `users.resume_text`; auto-extract skills and populate suggestions
- [ ] **Resume match scoring** (`lib/llm/matcher.ts`):
  - Lazy: compute on first time a user views a job, not at ingest time
  - Cache: store in `match_scores (user_id, job_id, score, rationale, computed_at, is_stale)`
  - Invalidate: when `users.resume_text` changes, set all user's `match_scores.is_stale = true`
  - Recompute stale scores on next view
- [ ] Replace Phase 3 match score placeholder with real scores on job cards
- [ ] **"Tailor resume for this job"** — Claude Sonnet rewrites resume bullets aligned to JD:
  - Save tailored version to `resume_versions` table with `job_id` reference
  - Generate PDF via `@react-pdf/renderer` (`lib/pdf/generator.ts`)
  - Base `users.resume_url` is never overwritten
- [ ] Profile completeness indicator with per-section breakdown and callouts ("Add work history to improve auto-fill accuracy")
- [ ] Unit tests: PDF text extraction, resume version creation, score cache invalidation logic
- [ ] Integration tests: match score API returns cached score on second call; upload new resume → existing scores marked stale

> Note: The richer this profile is, the better the extension's auto-fill accuracy. Work history and education entries directly map to the most-asked sections on ATS forms.

### Phase 6 — Cover Letters

- [ ] Cover letter template definitions: `formal`, `casual`, `startup-focused`
- [ ] "Generate Cover Letter" button on job detail page
- [ ] Claude Sonnet reads JD + company profile + user resume → selects template → generates letter
- [ ] Inline editor for reviewing and editing generated letter
- [ ] Save finalized letter to `cover_letters` table with `application_id`
- [ ] Template override option (user can force a specific template)
- [ ] Unit tests: template selection logic, cover letter prompt builder
- [ ] Integration test: generate → save → retrieve by application_id

### Phase 7 — Company Intelligence & Interview Prep

- [ ] **Enrich `company_profiles` stubs** from Phase 2 — LLM reads accumulated job postings for a company and fills in description, headcount estimate, funding stage, inferred tech stack
- [ ] Glassdoor rating: integrate a third-party data source (Clearbit, RapidAPI wrapper, or similar) — do not use LLM for this, it cannot look up live ratings
- [ ] Company panel on job detail now renders full enriched data
- [ ] Behavioral and technical question bank per company (LLM-generated from job descriptions, community-sourced)
- [ ] Per-application "Prep" tab surfacing company-specific questions
- [ ] STAR response builder: input question → Claude drafts structured response (S/T/A/R sections) using user profile + resume → user edits and saves to `star_responses` table
- [ ] Saved responses linked to `company_id` (nullable for general-purpose responses); surfaced on any application to that company; used as few-shot context by extension LLM calls
- [ ] Unit tests: STAR prompt builder, response storage/retrieval
- [ ] E2E test: open prep tab → generate STAR response → save → verify persisted

### Phase 8 — Notifications & Alerts

- [ ] Notification preferences UI: match threshold, role types, channels, quiet hours (maps to `users.notification_quiet_hours_start/end`)
- [ ] Push subscription UI: "Enable browser notifications" button → calls `Notification.requestPermission()` → subscribes with VAPID public key → saves subscription to `push_subscriptions` table
- [ ] Dispatcher (`lib/notifications/dispatcher.ts`):
  - Before sending any alert, check `notification_log` for (user_id, job_id, channel) — skip if already sent
  - Respect quiet hours before sending
  - Send across all configured channels for a matching job
- [ ] Email alerts via Resend (`lib/notifications/email.ts`)
- [ ] Browser push notifications via Web Push API (`lib/notifications/push.ts`) — reads `push_subscriptions` table to find user's registered browser endpoints; requires VAPID keys in env
- [ ] SMS alerts via Twilio (`lib/notifications/sms.ts`)
- [ ] Notification log page in settings
- [ ] Unit tests: threshold matching logic, quiet hours check, deduplication
- [ ] Integration test: new job inserted → dispatcher fires for matching user → notification_log row created → second run for same job does not resend

### Phase 9 — Analytics

- [ ] `/analytics` page
- [ ] Jobs posted today + 7-day rolling average chart
- [ ] Application activity chart with weekly / monthly / yearly toggle (Recharts)
- [ ] Application funnel visualization (stacked bar)
- [ ] Response rate metric
- [ ] Most active companies hiring right now
- [ ] Time-to-first-response distribution (derived from `application_timeline`)
- [ ] Dashboard mini-stats strip + 30-day sparkline
- [ ] Breakdown of manually-added jobs (`source = 'manual'`) vs aggregated feed jobs
- [ ] Integration tests: analytics API routes return correct aggregations

### Phase 10 — Browser Extension (Auto-Fill)

> The extension fills job application forms on external ATS sites using your Backlog profile. You always review before submitting — the extension never submits for you.

**Standard field auto-fill (no LLM):**
The extension loads your full structured profile on init (one API call, cached for the session). For standard form fields — name, email, phone, address, LinkedIn, GitHub, work history entries, education, work authorization, citizenship, visa sponsorship — it fills directly using DOM manipulation and synthetic input events. No LLM call.

**Open-ended questions (LLM):**
For free-text prompts ("Why do you want to work here?"), the extension first checks your `saved_answers` for a match. If found, it uses that. If not, it calls Claude Sonnet with your profile + STAR responses as context to generate an answer.

**Workday note:** Workday uses Angular-rendered inputs that require synthetic `InputEvent` + `change` event dispatch rather than direct `value` assignment. Supported best-effort — some forms may require manual correction in the review step.

- [ ] Chrome extension scaffold (Manifest V3, content script, background service worker, popup)
- [ ] API key system: generate user-scoped key in Backlog Settings → stored as hash in `api_keys` table → extension authenticates with raw key, server verifies against hash
- [ ] Extension loads full structured profile on init (one API call) and caches locally for the session
- [ ] Content script: DOM traversal to detect all form fields (label text, input type, name/id attributes, dropdowns, textareas, file inputs)
- [ ] Targeted parsers for major ATS platforms: Greenhouse, Lever, Workday (best-effort), iCIMS, BambooHR
- [ ] Standard field filling from cached profile — no LLM
- [ ] Open-ended field handling: check `saved_answers` first → fall back to Claude Sonnet
- [ ] LLM answer generation uses STAR responses from Phase 7 as examples where relevant
- [ ] Cover letter attachment: attaches generated cover letter for this job if one exists
- [ ] Resume attachment: attaches `resume_versions` PDF for this job if exists, else base resume
- [ ] Review UI: extension popup shows all filled fields with values, editable inline before confirming
- [ ] User clicks site's native Submit button — extension never submits automatically
- [ ] Post-submit: extension detects navigation/XHR success → calls Backlog API → job set to "Applied", `applied_at` stamped, `application_timeline` row written
- [ ] **"Add to Backlog" button** in extension popup on any job posting page:
  - Content script extracts page title, company, description from already-rendered DOM
  - Sends to Backlog API → normalized via GPT-4o-mini → added as `source = 'manual'`
  - Solves the JS-rendered page problem (browser already rendered it; no server-side fetch needed)
  - Covers any site including Workday where URL-paste fallback fails
- [ ] "Initiate from Backlog" flow: clicking "Auto-Apply" on a job card opens ATS URL in new tab with extension pre-loaded
- [ ] Settings page in extension: view linked account, API key, toggle auto-detect per site
- [ ] Firefox support (Manifest V2 compatibility layer)
- [ ] Unit tests: standard field detection and mapping, ATS-specific DOM parsers, saved_answers lookup
- [ ] Integration test: mock ATS form → standard fields filled without LLM call → open-ended field triggers Claude → review panel renders

### Phase 10.5 — Dashboard Home Page

> Insert a `/` dashboard as the default landing page. The current nav goes straight to `/feed`, but the app would benefit from a home screen that gives you a quick read on everything at once.

- [ ] Add `/` route and redirect sidebar default to `/` instead of `/feed`
- [ ] Dashboard layout: 2-column grid on desktop, stacked on mobile
- [ ] **Top stats strip**: open applications count, interviews in progress, offers pending, total jobs in feed today
- [ ] **Newest jobs mini-feed**: top 5 most recently fetched jobs with "View all" link to `/feed`
- [ ] **Application pipeline summary**: small kanban-style count per stage (Saved / Applied / Phone / Technical / Final / Offer / Rejected) — no drag/drop, just counts + "Open tracker" link
- [ ] **Analytics sparkline**: 30-day application activity bar chart (Recharts, compact)
- [ ] **Upcoming prep nudges**: applications with interviews soon (by `updated_at`) — links to `/prep`
- [ ] Animate widgets in on load (staggered Framer Motion entrance)

### Phase 11 — Export & Integrations

- [ ] CSV export of full application history
- [ ] Google Sheets OAuth integration — push / sync tracker data on demand

> Note: Google Sheets OAuth requires setting up a Google Cloud project, OAuth credentials, and a redirect URI. More infrastructure than it looks — scope this carefully.

### Phase 12 — Polish, Performance & QoL

- [ ] Keyboard shortcuts (`F`, `K`/`J`, `A`, `?`, `Cmd+K`)
- [ ] Command palette with fuzzy search via `cmdk` (jobs, applications, companies)
- [ ] Onboarding flow for first login (resume upload + profile completion + notification prefs + alert config)
- [ ] Full mobile-responsive layout audit
- [ ] Empty state illustrations
- [ ] Optimistic UI updates across all mutations with rollback on failure
- [ ] Toast notification system
- [ ] Performance audit: lazy loading, image optimization, query caching
- [ ] PWA manifest + service worker for offline basic functionality
- [ ] Full E2E test suite review — cover all critical paths across phases

---

## Future / Long-Term

- [ ] Additional job sources: LinkedIn, Indeed, Glassdoor (when scraping strategy is solid)
- [ ] Collect anonymized cover letter + resume + outcome data (with user consent) to build a training dataset
- [ ] Fine-tune a custom LLM on successful application materials — eventually replace Claude/OpenAI calls for cover letters and resume tailoring with a self-hosted model trained on real outcomes
- [ ] Referral network: surface mutual connections at companies you're applying to (LinkedIn graph integration)
- [ ] Salary negotiation assistant: LLM-powered coaching based on offer details and market data
- [ ] Auto-submit mode: after user reviews and approves a filled form once, allow fully automated submission for similar ATS platforms with no review step
