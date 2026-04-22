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
| LLM — High Frequency   | **GPT-5 nano (OpenAI)**                  | $0.05/1M tokens, faster — job normalization, match scoring, URL job extraction           |
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
- [x] Idle auto-logout — 10min of inactivity triggers sign-out; `IdleLogout` client component in app layout
- [x] Bug fix: `IdleLogout` was signing users out immediately on login due to stale `backlog_last_seen` in localStorage — login page now resets the key on successful auth
- [x] Bug fix: clicking "Apply →" in job detail didn't appear in Tracker until hard refresh — fixed by calling `router.refresh()` post-apply + `force-dynamic` on tracker page
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

### Phase 4A — Manual Log UX

Improvements to the "Log Application" modal — reduced friction for logging jobs you've already applied to outside Backlog.

**`hide_from_feed` flag**
- [x] Migration `supabase/migrations/017_add_hide_from_feed.sql` — add `hide_from_feed boolean NOT NULL DEFAULT false` to `jobs` table
- [x] `/api/jobs/manual` sets `hide_from_feed = true` on insert — manually logged applications should never appear in the discovery feed
- [x] `/api/jobs` GET feed query adds `.eq('hide_from_feed', false)` filter — "Add from URL" jobs (`/api/jobs/from-url`) are unaffected and remain visible in the feed

**Autocomplete endpoints**
- [x] `GET /api/autocomplete/companies?q=<query>` — ILIKE search on `company_profiles.name`; cross-references user's past `applications → jobs.company` to float previously-applied companies to the top; returns top 8 names; empty query returns user's most-recent companies
- [x] `GET /api/autocomplete/locations?q=<query>` — queries distinct non-null `jobs.location` (excluding `hide_from_feed = true` rows to avoid a feedback loop from previously-logged manual entries); "Remote" and "Hybrid" always pinned at the top regardless of query; returns top 8

**Reusable `<Combobox>` component** (`src/components/ui/Combobox.tsx`)
- [x] Keyboard navigable — ↑/↓ moves highlight, Enter selects, Escape closes, Tab dismisses
- [x] Framer Motion dropdown with staggered item entrance (12ms delay per item)
- [x] Closes on blur (150ms delay allows click-on-suggestion to fire first); `onMouseDown` prevents default on list to keep input focused
- [x] 150ms debounce on the fetch — avoids a request per keystroke
- [x] Highlight matched substring in suggestion text
- [x] Portal-rendered dropdown (`createPortal` to `document.body`) — escapes modal's `overflow-y: auto` clipping; position tracked with `getBoundingClientRect` on focus/change

**Wire into `LogApplicationModal`**
- [x] Company field → `<Combobox>` backed by `/api/autocomplete/companies`; previously-applied companies show "applied before" meta label
- [x] Location field → `<Combobox>` backed by `/api/autocomplete/locations`; "Remote" and "Hybrid" always visible as first two items even before typing
- [x] `FeedHeader` `onSuccess` handler updated to `router.push('/tracker')` — after logging from the feed, user lands on the tracker where the new card lives

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

- [x] Profile page with all structured fields from `users` schema: personal info, contact, work authorization, preferences, experience level, years of experience
- [x] Work history section (`work_history` table): add/edit/delete structured entries (company, title, dates, description, is_current)
- [x] Education section (`education` table): add/edit/delete structured entries (school, degree, field, GPA, graduation year)
- [x] Skills list (user-managed tags)
- [x] Pre-written answers (`saved_answers` table): user can add question/answer pairs for common prompts — these will be used by the extension before falling back to LLM
- [x] PDF resume upload → text extraction (`lib/pdf/parser.ts`, unpdf + pdf-parse fallback) → store in `users.resume_text`; AI auto-extracts skills, work history, education, personal info, and Q&A pairs
- [x] **Job fit score** (`lib/llm/matcher.ts`) — percentage 0–100 shown on every job card and detail panel
- [x] Replace Phase 3 match score placeholder with real scores on job cards and detail panel
- [x] **"Tailor resume for this job"** — Claude Sonnet rewrites resume bullets aligned to JD:
  - Saved to `resume_versions` table with `job_id` reference
  - PDF generated via `@react-pdf/renderer` (`lib/pdf/resume-generator.tsx`)
  - Base `users.resume_url` is never overwritten
  - "Re-tailor" option regenerates if job description changes
- [x] Profile completeness indicator
- [ ] Unit tests: PDF text extraction, resume version creation, score cache invalidation logic
- [ ] Integration tests: match score API returns cached score on second call; upload new resume → existing scores marked stale

> Note: The richer this profile is, the better the extension's auto-fill accuracy. Work history and education entries directly map to the most-asked sections on ATS forms.

### Phase 6 — Cover Letters

- [x] Cover letter template definitions: `formal`, `casual`, `startup`
- [x] "Generate Cover Letter" button on job detail page
- [x] Claude Sonnet reads JD + company profile + user resume → auto-selects template → generates letter
- [x] Inline editor for reviewing and editing generated letter
- [x] Save finalized letter to `cover_letters` table with `application_id`
- [x] Auto-create saved application if none exists when generating cover letter
- [x] Template override option (user can force a specific template before generating)
- [x] Re-generate with new template from the done state
- [x] Copy to clipboard button
- [x] Download as PDF button
- [ ] Unit tests: template selection logic, cover letter prompt builder
- [ ] Integration test: generate → save → retrieve by application_id

### Phase 7 — Company Intelligence & Interview Prep

**Company enrichment**
- [x] `POST /api/company/[id]/enrich` — lazy enrichment triggered on first job detail view for a company; LLM reads all accumulated job postings for that company and fills in description, headcount estimate, funding stage, inferred tech stack; marks `enriched_at` on `company_profiles`; subsequent views use cached data, no re-call
- [x] No Glassdoor API integration — Clearbit is sunset and third-party wrappers are unreliable; instead surface a "View on Glassdoor" link that constructs a glassdoor.com search URL from the company name
- [x] Company panel on job detail renders enriched data: description, headcount estimate, funding stage, tech stack chips, and Glassdoor search link

**Interview prep**
- [x] Question bank per company: `GET /api/company/[id]/questions` — lazily generated on first Prep tab open for a given company; GPT-4o-mini reads that company's job descriptions and generates a mix of behavioral and technical questions; stored in `company_profiles.behavioral_questions` + `technical_questions`; subsequent opens use cached questions
- [x] Per-application "Prep" tab with three sections:
  - **Materials** — tailored resume download link (if a `resume_versions` row exists for this job) and cover letter download link (if a `cover_letters` row exists for this application); both shown as cards so everything is in one place before an interview
  - **Questions** — company-specific behavioral and technical questions loaded from the question bank
  - **STAR Responses** — list of saved responses for this company; prompt to add new ones
- [x] STAR response builder: input question → Claude drafts structured response (S/T/A/R sections) using user profile + work history as context → user edits and saves to `star_responses` table
- [x] Saved STAR responses linked to `company_id` (nullable for general-purpose); surfaced on any application to that company; used as few-shot context in Phase 10 extension LLM calls
- [x] "Prep for interview →" link in job detail panel navigates to `/prep?job_id=xxx`
- [ ] Unit tests: enrichment prompt builder, question bank prompt builder, STAR prompt builder
- [ ] E2E test: open Prep tab → generate STAR response → save → verify persisted

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
- [ ] Application funnel visualization (stacked bar or Sankey)
- [ ] Response rate metric
- [ ] Most active companies hiring right now
- [ ] Time-to-first-response distribution (derived from `application_timeline`)
- [ ] Dashboard mini-stats strip + 30-day sparkline
- [ ] Breakdown of manually-added jobs (`source = 'manual'`) vs aggregated feed jobs (`github` / `portal`)
- [ ] Integration tests: analytics API routes return correct aggregations

#### 9b — Company Graph View

A force-directed interactive graph that gives you a spatial "map" of your job search — more expressive than bar charts and genuinely fun to explore.

**Visualization:**
- **Nodes are companies** — sized proportionally to the number of open roles Backlog has for that company
- **Node color = your relationship with that company:**
  - Grey — no interaction
  - Blue — saved a job there
  - Yellow — applied
  - Orange — in active interviews (phone screen / technical / final)
  - Green — offer
  - Red — rejected
- **Edges connect companies that share tech stack tags** — Jaccard similarity on `jobs.tags[]`; only edges above a threshold (e.g. 0.3) are drawn, so the graph doesn't become a hairball
- **Clusters emerge naturally** from the force simulation — ML/AI companies pull together, fintech groups together, consumer SaaS groups together; no manual categorization needed
- **Clicking a node** opens that company's panel (same drawer as in the feed)
- **Hovering** shows a tooltip: application status, number of open roles, top shared tags with your profile

**Implementation:**
- `react-force-graph-2d` — wraps D3 force simulation, performant in React, supports custom node rendering via Canvas
- Graph data computed server-side at request time: `GET /api/analytics/company-graph` returns `{ nodes: [{id, name, roleCount, applicationStatus}], edges: [{source, target, weight}] }`; edges built from tag Jaccard across all companies with at least 1 open role
- Framer Motion handles the entrance — graph fades in as nodes settle into position
- Toggle between graph view and standard chart view on the analytics page

- [ ] `src/app/api/analytics/company-graph/route.ts` — compute nodes (all companies with open roles + user application status) and edges (tag Jaccard ≥ 0.3); return serialized graph
- [ ] `src/components/analytics/CompanyGraph.tsx` — `react-force-graph-2d` canvas component; custom node renderer (circle + company letter avatar); color by application status; tooltip on hover; click → open company panel
- [ ] Add `react-force-graph-2d` to dependencies
- [ ] Toggle between "Charts" and "Map" view on the analytics page

### Phase 10 — Browser Extension (Auto-Fill)

> The extension fills job application forms on external ATS sites using your Backlog profile. You always review before submitting — the extension never submits for you.

**Standard field auto-fill (no LLM):**
The extension loads your full structured profile on init (one API call, cached for the session). For standard form fields — name, email, phone, address, LinkedIn, GitHub, work history entries, education, work authorization, citizenship, visa sponsorship — it fills directly using DOM manipulation and synthetic input events. No LLM call.

**Open-ended questions (LLM):**
For free-text prompts ("Why do you want to work here?"), the extension first checks your `saved_answers` for a match. If found, it uses that. If not, it calls Claude Sonnet with your profile + STAR responses as context to generate an answer.

**Workday note:** Workday uses Angular-rendered inputs that require synthetic `InputEvent` + `change` event dispatch rather than direct `value` assignment. Supported best-effort — some forms may require manual correction in the review step.

- [x] Chrome extension scaffold (Manifest V3, content script, background service worker, popup)
- [x] API key system: generate user-scoped key in Backlog Settings → stored as hash in `api_keys` table → extension authenticates with raw key, server verifies against hash
- [x] Extension loads full structured profile on init (one API call) and caches locally for the session
- [x] Content script: DOM traversal to detect all form fields — label text, aria-labelledby, wrapping `<label>`, aria-label, placeholder, name attribute; handles Greenhouse compliance dropdowns where label is sibling to wrapper
- [x] Targeted parsers for Greenhouse (ID-based), Lever (placeholder-based), plus generic label-based fill for all other sites (iCIMS, BambooHR, AshbyHQ, custom forms)
- [x] Standard field filling from cached profile — no LLM; regex FIELD_MAP covers name, email, phone, address, city/state/zip, URLs, work auth, salary, education, EEO self-identification
- [x] Cross-origin iframe detection — if main frame fills nothing, enumerates frames via `webNavigation.getAllFrames` and retries (handles Greenhouse/Lever embedded via iframe on company career pages)
- [x] "Add to Backlog" button in extension popup: content script extracts page title, company, description → sends to Backlog API → normalized and added as `source = 'manual'`; solves JS-rendered page problem
- [x] EEO fields + salary added to DB (`users` table — migration 10) and wired into extension fill logic: `gender`, `race_ethnicity`, `hispanic_latino`, `veteran_status`, `disability_status`, `desired_salary`
- [x] **EEO & Salary fields UI in web app Profile page** — the DB columns and extension fill logic exist, but users have no way to set these values yet; add an "EEO & Compensation" section to `ProfileClient.tsx`
- [x] Open-ended field handling: check `saved_answers` first → fall back to Claude Sonnet (`POST /api/extension/answer-question`)
- [x] LLM answer generation uses STAR responses from Phase 7 as examples where relevant
- [ ] Cover letter attachment: attaches generated cover letter for this job if one exists
- [ ] Resume attachment: trigger `input[type="file"]` with `resume_versions` PDF for this job if exists, else base resume
- [ ] Post-fill review UI: extension popup shows all filled fields with values; user reviews, edits if needed
- [ ] User clicks site's native Submit button — extension never submits automatically
- [ ] Post-submit: extension detects navigation or XHR success → calls Backlog API → job set to "Applied", `applied_at` stamped, `application_timeline` row written
- [ ] "Initiate from Backlog" flow: clicking "Auto-Apply" on a job card opens ATS URL in new tab with extension pre-loaded
- [ ] Settings page in extension: view linked account, API key, toggle auto-detect per site
- [ ] Firefox support (Manifest V2 compatibility layer)
- [ ] Unit tests: standard field detection and mapping, ATS-specific DOM parsers, saved_answers lookup
- [ ] Integration test: mock ATS form → standard fields filled without LLM call → open-ended field triggers Claude → review panel renders

---

### Phase 10A — True Auto-Apply (Multi-Page Navigation)

> Evolves the extension from a "field filler" into a genuine auto-apply engine. The distinguishing capability is navigating multi-step application forms end-to-end — detecting pages, filling each one, advancing, and pausing at the final step for user confirmation before submit.

**Why Greenhouse isn't the real target:**
Greenhouse is good for development and testing, but it has its own Easy Apply feature. The real value of this extension is on ATS platforms that don't have Easy Apply — Workday, AshbyHQ, iCIMS, BambooHR, Rippling, and custom career pages. The goal is ATS-agnostic auto-apply.

**LLM strategy for field filling — hybrid approach:**

The current regex FIELD_MAP handles ~80% of standard fields well. The remaining ~20% are:
- Unusual label phrasing that doesn't match any regex ("How many years have you spent in your discipline?")
- Dropdown options that don't match expected text (gender dropdown with "Man / Woman / Non-binary" vs "Male / Female")
- Multi-select checkboxes
- Dynamic/custom fields unique to a company's application

Two approaches were considered:

| Approach | Pros | Cons |
|---|---|---|
| **Deterministic only (current)** | Zero cost, zero latency, reliable on known fields | Silently skips anything outside regex patterns |
| **LLM for every field** | Maximum coverage | Expensive, slow (~2s latency per page), overkill for name/email |
| **Hybrid (chosen)** | Best coverage at minimal cost | Slightly more complex flow |

**The hybrid strategy:**
1. **Deterministic pass first** — regex FIELD_MAP fills all recognized standard fields instantly, no LLM
2. **Page analysis call (Claude Haiku)** — after the deterministic pass, send all *unfilled* field labels + their types/options to Haiku in a single call → get back a JSON map of `{ selector → profile_field_or_generated_value }`; Haiku is used here because it's fast and cheap, not because quality matters
3. **Open-ended question answers (Claude Sonnet)** — for any field identified as a free-text question that isn't in `saved_answers`, escalate to Sonnet with full profile + STAR context

**Cost reality check (personal scale):**
- Haiku page analysis: ~600 input + ~200 output tokens per page → ~$0.0001/page; 100 apps/month = **$0.01/month**
- Sonnet open-ended answers: ~1,500 tokens per question → ~$0.005/question; 5 questions × 100 apps = **$2.50/month**
- Total at heavy personal use: **under $3/month** — negligible

**Why not full LLM (send everything to Claude)?** Latency. Sonnet on a full page analysis takes 2–4 seconds. Haiku is under 500ms. The user is watching the form fill in real time — speed matters. The deterministic pass is instant and handles the common cases; Haiku is fast for the long tail; Sonnet is reserved for actual writing tasks.

**Multi-page navigation flow:**
```
1. Content script activates on page load
2. Detect form fields → deterministic fill → Haiku analysis for unfilled → fill remaining
3. Popup shows mini-review: "X fields filled on this page"
4. Extension detects "Next" / "Continue" button (by text, aria-label, type=submit heuristics)
5. User clicks Next in site OR extension auto-advances (optional mode — user opt-in)
6. After navigation, content script re-activates on new page → repeat steps 2–4
7. Extension detects final "Submit" page (no more Next button, submit button present)
8. Popup shows full multi-page review: all filled values across all pages, grouped by page
9. User clicks Submit in site — extension never auto-submits
10. Extension detects submission → marks Applied in Backlog
```

**Eng review findings (2026-04-04):**
- `fillGreenhouse()` removed — generic label filler already covers those fields; hardcoded IDs break silently when Greenhouse updates them
- `setNativeValue` must dispatch `blur` event in addition to `input`+`change` — some ATS platforms (Lever, AshbyHQ) validate on blur
- Multi-page state must use `chrome.storage.session` (not in-memory) — MV3 service workers terminate after ~30s of inactivity and lose all in-memory state
- Haiku fill call is staged: run Tier 1 immediately (visible fills), then Tier 2 in background (second wave) — avoids "nothing happening for 500ms" UX
- Vitest added to extension for unit tests

**Tasks:**

- [x] **Remove `fillGreenhouse()`** from `fill.ts` — use generic label-based filler for all ATS platforms; simpler, more maintainable, less brittle
- [x] **Add `blur` event dispatch** to `setNativeValue` in `fill.ts` — some ATS platforms run validation on blur; without it, fields appear filled but the form rejects them on submit
- [x] **Next-page detection** — heuristic to find "Next", "Continue", "Save and Continue" buttons; check for visible modals first (see TODOS.md); ignore "Save for Later" or "Cancel"
- [x] **Page state tracking via `chrome.storage.session`** — persist state keyed by `tabId` (`{ [tabId]: { pageIndex, filledFields[] } }`) in `chrome.storage.session`; survives MV3 worker restarts; must clean up on `chrome.tabs.onRemoved` to prevent state bleed between sessions (note: `chrome.storage.session` persists for the entire browser session, not just until tab close)
- [x] **Re-trigger on navigation** — listen for `chrome.tabs.onUpdated` AND patch `window.history.pushState` + `popstate` in content script using `world: MAIN` (required for MV3 CSP-strict sites — most major ATS platforms use strict CSPs that block content script injection into page context)
- [x] **Staged fill UX** — run Tier 1 deterministic fill immediately (user sees fills appear); run Tier 2 Haiku in background; Tier 2 must ONLY fill fields left empty by Tier 1 (never overwrite); apply second wave of fills when Haiku returns; no blocking spinner
- [x] **Multi-page review panel** — during each page fill, write filled fields to `chrome.storage.session` (DOM is gone after navigation, so must be stored at fill time); popup reads accumulated state and groups by page for final review
- [x] **Haiku integration** — `POST /api/extension/analyze-page`: receives `{selector, label, type, options[]}[]` for unfilled fields, returns `{selector → value}` map; follows same API key auth pattern as `/api/extension/profile`; 5s timeout + fallback (see TODOS.md)
- [x] **Sonnet integration for open-ended answers** — `POST /api/extension/answer-question`: checks `saved_answers` first (server-side), falls back to Sonnet with profile + STAR context; returns generated answer
- [ ] **Submit detection** — listen for `fetch`/`XHR` completion or `chrome.webNavigation` to a confirmation/thank-you URL; configurable success URL patterns per ATS
- [x] **Auto-advance mode (opt-in, per-tab)** — toggled in popup before starting a fill session; after filling a page, extension clicks Next automatically; disabled by default; pauses on final Submit page always
- [ ] **Resume/cover letter file upload** — inject file into `input[type="file"]` using a Blob constructed from `resume_url` or `cover_letters.pdf_url` fetched via extension background worker
- [x] **Workday Shadow DOM handling** — Workday uses Shadow DOM for inputs; need `shadowRoot.querySelector` traversal; best-effort with known patterns
- [x] **Add Vitest to extension** — `extension/vitest.config.ts`; reuse project-level config; jsdom environment for DOM tests
- [ ] Unit tests: `setNativeValue` dispatches blur, `setSelectValue` fuzzy match cases, `getLabelForInput` aria-labelledby path, next-button detection heuristic, page state accumulation, Haiku error fallback
- [ ] E2E test (Playwright): 2-page mock form → extension navigates both pages → review shows all filled fields grouped by page
- [ ] E2E test (Playwright): Haiku API returns 500 → extension falls back to deterministic only → no user-visible error, review still shows deterministic fields

### Phase 10.5 — Dashboard Home Page

> Insert a `/` dashboard as the default landing page. The current nav goes straight to `/feed`, but the app would benefit from a home screen that gives you a quick read on everything at once.

- [x] Add `/` route and redirect sidebar default to `/dashboard` instead of `/feed`
- [x] Dashboard layout: 2-column grid on desktop, stacked on mobile
- [x] **Top stats strip**: open applications count, interviews in progress, offers pending, total jobs in feed today
- [x] **Newest jobs mini-feed**: top 5 most recently fetched jobs with "View all" link to `/feed`
- [x] **Application pipeline summary**: small kanban-style count per stage (Saved / Applied / Phone / Technical / Final / Offer / Rejected) — no drag/drop, just counts + "Open tracker" link
- [x] **Analytics sparkline**: 30-day application activity bar chart (Recharts, compact)
- [x] **Active interviews nudge**: applications in phone screen / technical / final with links to `/prep`
- [x] Animate widgets in on load (staggered Framer Motion entrance)

### Phase 11 — Intelligence Lift (inspired by career-ops)

> Uplift job discovery and interview prep quality by adding direct portal scanning and a deeper interview intelligence layer.

**Migrations required** (run in Supabase SQL editor before deploying):
- `supabase/migrations/add_interview_guide.sql`
- `supabase/migrations/add_story_bank.sql`
- `supabase/migrations/add_match_dimensions.sql`

#### 11a — Portal Scanning (Greenhouse + Lever APIs)

Worker now scans 30+ company career portals directly in addition to SimplifyJobs, catching roles that never appear on GitHub aggregation repos.

- [x] `worker/src/portals/companies.ts` — curated list of companies with Greenhouse/Lever slugs
- [x] `worker/src/portals/greenhouse.ts` — fetch jobs from Greenhouse public API (no auth required)
- [x] `worker/src/portals/lever.ts` — fetch jobs from Lever public postings API (no auth required)
- [x] `worker/src/portals/index.ts` — orchestrate both sources, deduplicate, return new `NormalizedJob[]`
- [x] `worker/src/jobs/deduplicator.ts` — add `filterNewJobs(NormalizedJob[])` alongside existing `filterNewEntries`
- [x] `worker/src/aggregator.ts` — run portal scan after GitHub sources; use `source: 'portal'` in writer

#### 11b — Interview Prep Upgrade (7-step intelligence model)

Replace the basic GPT-4o-mini question list with a Claude-powered full interview guide: round breakdown, cultural signals, strong-answer hints, and interviewer questions.

- [x] `supabase/migrations/add_interview_guide.sql` — add `interview_guide jsonb` column to `company_profiles`
- [x] `src/lib/llm/question-generator.ts` — rewrite with Claude Sonnet; output `InterviewGuide` structure (overview, rounds, behavioral with hints, technical with hints, cultural signals, questions to ask)
- [x] `src/app/api/company/[id]/questions/route.ts` — return `interview_guide` when present; fall back to old arrays for cached entries
- [x] `src/components/prep/QuestionBank.tsx` — render new guide sections: process overview, cultural signals, questions to ask interviewer; show hint for each question inline

#### 11c — Story Bank

A persistent, company-agnostic bank of STAR+Reflection narratives. Build stories once, reuse them across every interview prep. During prep, the question bank cross-references stories to each question by theme.

- [x] `supabase/migrations/add_story_bank.sql` — new `story_bank` table with RLS
- [x] `src/app/api/story-bank/route.ts` — GET (list), POST (create)
- [x] `src/app/api/story-bank/[id]/route.ts` — GET, PATCH, DELETE
- [x] `src/components/prep/StoryBank.tsx` — full CRUD UI for managing stories (title, theme, STAR+R fields, tags)
- [x] `src/components/prep/PrepClient.tsx` — add Story Bank tab alongside prep view; pass stories to QuestionBank for cross-referencing
- [x] `src/components/prep/QuestionBank.tsx` — show matching story bank entries per question (matched by theme)

#### 11d — Multi-Dimensional Match Scoring

Upgrade the single-number match score to a 4-dimension breakdown: role fit, tech stack, experience level, compensation alignment.

- [x] `supabase/migrations/add_match_dimensions.sql` — add `dimensions jsonb` column to `match_scores`
- [x] `src/lib/llm/matcher.ts` — upgrade prompt to return `{score, rationale, dimensions}` with 4 sub-scores
- [x] `src/app/api/jobs/[id]/match-score/route.ts` — store and return `dimensions` alongside score
- [x] `src/components/feed/MatchScoreBadge.tsx` — show dimension breakdown in a tooltip/popover on hover

### Phase 14 — Cost Optimization & Relevance Filtering

> Cut OpenAI spend and reduce noise by (1) switching to a cheaper/better model, (2) dropping irrelevant job sources, and (3) filtering non-qualifying roles before they ever hit the LLM or DB.

#### 14a — Switch to GPT-5 Nano

GPT-5 nano is 3x cheaper on input ($0.05 vs $0.15/1M), 1.5x cheaper on output ($0.40 vs $0.60/1M), has 3x the context window (400K vs 128K), and is GPT-5 tier intelligence. No tradeoff — strictly better for our use cases.

- [x] `worker/src/llm/normalizer.ts` — change `gpt-4o-mini` → `gpt-5-nano`
- [x] `worker/src/jobs/enricher.ts` — change `gpt-4o-mini` → `gpt-5-nano`
- [x] `src/lib/llm/matcher.ts` — change `gpt-4o-mini` → `gpt-5-nano`
- [x] `src/lib/llm/resume-analyzer.ts` — missed in initial pass; fixed in Phase 18 audit
- [x] `src/lib/llm/company-enricher.ts` — missed in initial pass; fixed in Phase 18 audit
- [x] `src/lib/jobs/url-extractor.ts` — missed in initial pass; fixed in Phase 18 audit
- [x] Update `PHASES.md` LLM strategy table to reflect new model

#### 14b — Drop Internship Source

The Summer2026-Internships GitHub source is no longer relevant; removing it eliminates one entire aggregation pipeline (fetch → parse → normalize → enrich → write) per cron cycle.

- [x] `worker/src/aggregator.ts` — remove `SimplifyJobs/Summer2026-Internships` entry from `SOURCES` array

#### 14c — Pre-Storage Relevance Filter

Add a deterministic (no LLM, zero cost) filter that runs immediately after parsing/portal fetch and before deduplication + normalization. Filters out roles that a CS bachelor's new grad in the US does not qualify for or would not want.

**Filter rules (all checked against title + location):**
- **Country filter:** drop any job whose location string clearly indicates non-US (UK, Canada, Germany, France, Australia, Singapore, India, etc.) — or where `country !== 'United States'` after normalization; keep "Remote" and ambiguous (default US)
- **Degree gating:** drop titles or descriptions containing `PhD`, `Doctorate`, `Ph.D`, `Postdoctoral`
- **Non-CS role types to block:** Product Marketing, Marketing Manager/Specialist, Sales, Account Executive, Account Manager, Account Leader, Business Operations, Operations Manager (non-eng), Assistant Controller, Controller, Recruiter, HR, Talent Acquisition, Legal, Finance Analyst (non-quant), Administrative
- **Seniority ceiling:** drop Director, VP, Vice President, C-level, Head of (unless technical), Principal (keep for Principal Engineer/SWE), Staff (keep for Staff Engineer/SWE)
- **Manager filter:** drop Engineering Manager, Product Manager ← actually keep PM (CS grads do apply); drop Engineering Manager only
- **Internship titles:** now that we're dropping the internship source, also block stray internship titles from portal scan that slip through (e.g. "Intern", "Co-op", "Cooperative Education")

**Implementation:**
- [x] `worker/src/jobs/relevance-filter.ts` — `filterRelevantJobs(jobs: NormalizedJob[]): NormalizedJob[]` and `filterRelevantEntries(entries: RawJobEntry[]): RawJobEntry[]` (pre-normalization variant for GitHub sources)
- [x] `worker/src/aggregator.ts` — call `filterRelevantEntries(rawEntries)` after `parseJobsTable` and before `normalizeEntries` (saves tokens on filtered entries)
- [x] `worker/src/aggregator.ts` — call `filterRelevantJobs(newJobs)` after portal dedup and before `enrichJobs` (saves enrichment calls on filtered jobs)
- [ ] Unit tests: title blocklist matches, country filter, PhD detection, seniority ceiling (block "Senior SWE", "Staff Engineer", "Principal SWE", "Tech Lead"; keep "Software Engineer", "Product Manager", "TPM")

#### 14d — Backfiller Rate Cap (QoL)

The backfiller runs every 15-minute cron cycle and calls GPT on up to 50 jobs per run. With a large DB of jobs with missing descriptions this is a hidden cost driver.

- [x] `worker/src/jobs/backfiller.ts` — reduced default `limit` from 50 → 10; skips rows where `enrichment_attempts >= 3`; always increments attempt count whether enrichment succeeds or fails; orders by `enrichment_attempts asc` (cheapest first)
- [x] `supabase/migrations/014_add_enrichment_attempts.sql` — adds `enrichment_attempts int NOT NULL DEFAULT 0` to `jobs`; partial index on backfill candidates for query performance

---

### Phase 15 — Discord Notification Redesign

> Make the Discord feed the primary at-a-glance job scanner. Jobs ranked by relevance, each one a clickable embed that deep-links directly to the job in Backlog. Log into Backlog and the drawer opens automatically.

#### 15a — Deep Links

Each Discord job embed needs a URL that routes the user to the right place in Backlog. The feed page needs to handle the `?job=<id>` param by auto-opening that job's detail drawer.

- [x] `worker/src/notifications/discord.ts` — update `sendJobsNotification` signature to accept `{ job: NormalizedJob, id: string }[]` instead of just `NormalizedJob[]`; add `BACKLOG_APP_URL` env var (e.g. `https://backlog.vercel.app`); set `url: \`${BACKLOG_APP_URL}/feed?job=${id}\`` on each embed
- [x] `worker/src/notifications/dispatcher.ts` — zip `newJobs` + `writtenJobPairs` into `{ job, id }[]` pairs before calling `sendDiscord`; matched by URL via `WriteResult.writtenJobPairs`
- [x] `src/app/(app)/feed/page.tsx` — read `searchParams.job`; if present, pass as `initialJobId` prop to `JobFeed`
- [x] `src/components/feed/JobFeed.tsx` — accept `initialJobId?: string`; on mount, fetch that job and auto-open the detail drawer; clear the param from the URL via `router.replace` after opening so it doesn't re-trigger on navigation
- [x] `src/middleware.ts` — preserve `?job=<id>` through the auth redirect: when bouncing an unauthenticated user to `/login`, include `redirectedFrom=/feed?job=<id>` so they land on the right job after login
- [x] `src/app/(auth)/login/page.tsx` — default redirect changed from `/feed` to `/dashboard`; reads `redirectedFrom` to land on the correct URL after login

#### 15b — Relevance Sorting

Match scores are user-specific and computed lazily — they aren't available at notification time without a costly LLM call. Instead, use a fast proxy sort: Jaccard similarity against the user's stored skills (free, sub-millisecond), then salary descending as a tiebreaker.

- [x] `worker/src/notifications/discord.ts` — added `sortByRelevance(jobsWithIds, userSkills)` helper: Jaccard score between job `tags` and `userSkills`; sort descending; salary desc as secondary sort
- [x] `worker/src/notifications/dispatcher.ts` — fetches all user skills from DB; aggregates into a union set; passes to `sendJobsNotification` for Discord sorting

#### 15c — Embed Redesign

Current format is a single wall-of-text embed. Replace with one compact embed per job (up to 10 jobs; overflow becomes a "+N more on Backlog" footer link). Each embed should be scannable in 2 seconds.

- [x] `worker/src/notifications/discord.ts` — single embed, description is a linked list of up to 10 jobs (one job per entry: match dot + linked title + company · location · salary · tags); overflow shown as italic "+N more" line at the bottom; single embed avoids Discord's 6000-char total limit that was silently truncating multi-embed messages
  - **Color**: single embed color based on best Jaccard score across listed jobs (green >0.4, yellow >0.1, blurple otherwise)
  - **Format per job**: `🟢 [**Title**](deeplink)\n↳ Company · Location · Salary · \`tag\``
- [x] If `jobs.length > 10`: italic overflow line appended to description with link to Backlog feed
- [ ] Add `BACKLOG_APP_URL` to Render env vars (documented in worker README)

---

### Phase 16 — Projects Section

> Add a structured projects section to the user profile. Projects are the primary signal for new grads with limited work history — they belong in match scoring, resume tailoring, and cover letter context. Token cost at GPT-5 nano rates is negligible (~200 tokens per scoring call = ~$0.00001).

#### 16a — Data Layer

- [x] `supabase/migrations/015_add_projects.sql` — new `projects` table:
  - `id uuid`, `user_id uuid`, `name text`, `description text`, `role text` (what you built / your contribution), `tech_stack text[]`, `url text` (nullable — GitHub, live demo), `highlights text[]` (bullet points, up to 5), `start_date date` (nullable), `end_date date` (nullable), `is_current bool`, `display_order int`, `created_at`
  - RLS: own rows only

#### 16b — Profile UI

- [x] `src/app/api/profile/projects/route.ts` — GET (list by user), POST (create)
- [x] `src/app/api/profile/projects/[id]/route.ts` — PATCH, DELETE
- [x] `src/components/profile/ProjectsSection.tsx` — add/edit/delete cards; fields: name, role, description, tech stack tags, URL, highlights (dynamic list up to 5), dates; same card pattern as WorkHistorySection
- [x] `src/components/profile/ProfileClient.tsx` — Projects section added between Work History and Education
- [x] `src/app/(app)/profile/page.tsx` — fetches projects and passes as `initialProjects`

#### 16c — LLM Integration

- [x] `src/lib/llm/matcher.ts` — projects serialized and appended to resume context in prompt; `serializeProjects` helper; model instruction updated to consider projects for tech_stack + role_fit
- [x] `src/lib/llm/resume-tailor.ts` — projects passed as optional param; formatted block appended after work history in tailoring prompt
- [x] `src/lib/llm/cover-letter.ts` — projects passed as optional param (top 3); appended after work history context
- [x] `src/app/api/extension/profile/route.ts` — `projects` included in profile payload
- [x] `src/app/api/jobs/[id]/match-score/route.ts` — fetches projects and passes to `computeMatchScore`
- [x] `src/app/api/resume/tailor/route.ts` — fetches projects and passes to `tailorResume`
- [x] `src/app/api/cover-letter/route.ts` — fetches projects and passes to `generateCoverLetter`

---

### Phase 17 — Testing Suite

> Comprehensive reliability layer across every tier of the stack: worker pipeline, API routes, UI flows, and browser extension. Infrastructure is already in place (Vitest + MSW + Playwright from Phase 1, Vitest in extension from Phase 10A) — this phase fills in the actual test coverage.

**Coverage target:** 80%+ on all worker business logic and API route handlers; 100% on critical auth paths and data-mutation routes.

---

#### 17a — Test Fixtures & Factories

Shared test data factories used by all test layers. Define once, import everywhere — prevents fixture drift across suites.

- [x] `worker/tests/fixtures/jobs.ts` — `makeRawEntry(overrides?)`, `makeNormalizedJob(overrides?)`, factory functions for generating consistent test data
- [x] `src/tests/fixtures/jobs.ts` — `makeJob(overrides?)`, `makeApplication(overrides?)`, `makeUser(overrides?)`
- [x] `src/tests/fixtures/profile.ts` — `makeUserProfile(overrides?)`, `makeWorkHistory(overrides?)`, `makeEducation(overrides?)`, `makeProject(overrides?)`
- [x] `src/tests/helpers/supabase-mock.ts` — typed Supabase mock builder; wraps MSW handlers so route tests don't need raw fetch mocks

---

#### 17b — Worker Unit Tests

Pure logic tests — no network, no DB. Fast, run on every commit.

**Parser (`worker/tests/parser.test.ts`):**
- [x] HTML table with ↳ sub-rows inherits company name correctly
- [x] Row with 🔒 in link cell is skipped
- [x] Row with no parseable URL is skipped
- [x] Multi-location `<br>` cells are normalized to `, `-separated string
- [x] Leading emoji stripped from company names
- [x] Orphaned ↳ row (no prior company) is skipped

**Date parser (`worker/tests/normalizer.test.ts`):**
- [x] `"0d"` → today's date ISO string
- [x] `"7d"` → 7 days ago
- [x] `"30d"` → 30 days ago
- [x] Legacy `"Sep 5"` → correct year inference (past month = last year)
- [x] Empty string → `null`
- [x] Garbage input → `null`

**Relevance filter (`worker/tests/unit/relevance-filter.test.ts`):**
- [x] "Senior Software Engineer" → blocked
- [x] "Staff Engineer" → blocked
- [x] "Principal SWE" → blocked
- [x] "Tech Lead" → blocked
- [x] "Engineering Manager" → blocked
- [x] "PhD Machine Learning Researcher" → blocked
- [x] "Account Executive" → blocked
- [x] "Product Marketing Manager" → blocked
- [x] "Software Engineer" → allowed
- [x] "Product Manager" → allowed
- [x] "Technical Program Manager" → allowed
- [x] "New Grad Software Engineer" → allowed
- [x] Location "London, UK" → blocked
- [x] Location "Toronto, Canada" → blocked
- [x] Location "Remote" → allowed
- [x] Location "San Francisco, CA" → allowed
- [x] Location "" (blank) → allowed (defaults to US)
- [x] `filterRelevantEntries` log message shows correct drop count

**Salary extractor (`worker/tests/unit/enricher.test.ts`):**
- [x] `"$120,000 – $150,000"` → `{ min: 120000, max: 150000 }`
- [x] `"$120k–$150k"` → `{ min: 120000, max: 150000 }`
- [x] `"salary: $80k to $100k"` → `{ min: 80000, max: 100000 }`
- [x] `"$50/hr"` (hourly × 2080) → annual equivalent
- [x] No salary text → `{ min: null, max: null }`

**Deduplicator (`worker/tests/deduplicator.test.ts`):**
- [x] Entries already in DB (by URL) are filtered out
- [x] New entries pass through
- [x] Mixed batch: only new entries returned

---

#### 17c — App Unit Tests

**Match scorer (`src/tests/unit/matcher.test.ts`):**
- [x] Jaccard score: perfect overlap → 100, no overlap → 0, partial → correct ratio
- [x] `clamp` handles NaN, negative, over-100
- [x] Skills-only mode when no resume text
- [x] `mode: 'none'` returned when both skills and resume are absent

**Resume analyzer (`src/tests/unit/resume-analyzer.test.ts`):**
- [x] Extracts personal info fields correctly
- [x] Handles missing optional fields (LinkedIn, GitHub, portfolio, GPA)

**Retry utility (`src/tests/unit/retry.test.ts`):**
- [x] Retries on 529/overloaded errors up to maxAttempts
- [x] Does not retry on 400/auth errors
- [x] Returns result on first success without retry

**Discord dispatcher (`worker/tests/unit/dispatcher.test.ts`):**
- [x] `isInQuietHours` returns `true` when now is within window
- [x] Returns `false` outside window
- [x] Overnight range (22:00–08:00) handled correctly
- [x] `null` start or end → always returns `false`

**Discord notification format (`worker/tests/unit/discord.test.ts`):**
- [x] Relevance sort orders jobs by Jaccard score descending
- [x] Overflow line appears when jobs > 10
- [x] Embed color reflects best Jaccard score

**URL extractor (`src/tests/helpers/url-extractor-test-helpers.ts`):**
- [x] Greenhouse URL detected and routed to Greenhouse API handler
- [x] Lever URL detected and routed to Lever API handler

**API key auth (`src/tests/unit/api-key.test.ts`):**
- [ ] `hashApiKey` produces consistent output for same input
- [ ] Two different keys produce different hashes
- [ ] Raw key is never returned after hashing (no reverse path)

---

#### 17d — API Route Integration Tests

Uses Vitest + MSW. Supabase calls are intercepted — no real DB. Tests verify handler logic, not Supabase internals.

**Feed (`src/tests/integration/jobs-feed.test.ts`):**
- [x] `GET /api/jobs` returns paginated results with correct cursor structure
- [x] `role_type` filter applied correctly
- [x] `is_remote` filter applied correctly
- [x] `date_range` filter: `24h` restricts `posted_at` correctly
- [x] `GET /api/jobs/[id]` returns 404 for unknown id
- [ ] `GET /api/jobs/[id]/match-score` computes score on first call, returns cached on second

**Applications (`src/tests/integration/applications.test.ts`):**
- [x] `POST /api/applications` creates row and first timeline entry
- [x] `PATCH /api/applications/[id]` with new status writes timeline row + updates `last_updated`
- [x] `PATCH /api/applications/[id]` with same status does not write duplicate timeline row
- [x] `DELETE /api/applications/[id]` removes row and cascades timeline

**Story bank (`src/tests/integration/story-bank.test.ts`):**
- [x] `GET /api/story-bank` returns user's stories
- [x] `POST /api/story-bank` creates story
- [x] `PATCH /api/story-bank/[id]` updates story
- [x] `DELETE /api/story-bank/[id]` removes story

**Profile (`src/tests/integration/profile.test.ts`):**
- [ ] `POST /api/profile/resume` extracts text, updates `users.resume_text`, invalidates `match_scores`
- [ ] `POST /api/profile/work-history` creates row, returns id
- [ ] `DELETE /api/profile/work-history/[id]` rejects if row belongs to different user (RLS simulation)

**URL extractor (`src/tests/integration/from-url.test.ts`):**
- [ ] Greenhouse URL → calls Greenhouse API mock → returns normalized job
- [ ] Lever URL → calls Lever API mock → returns normalized job
- [ ] Unknown static URL → calls HTML fetch mock → GPT extraction path

**Extension (`src/tests/integration/extension.test.ts`):**
- [ ] `GET /api/extension/profile` returns full profile + saved_answers + STAR responses
- [ ] `POST /api/extension/answer-question` returns saved answer when match found (no LLM call)
- [ ] `POST /api/extension/answer-question` calls Claude when no saved answer matches
- [ ] Invalid API key → 401
- [ ] Revoked API key → 401

**Worker integration (`worker/tests/integration/aggregator.test.ts`):**
- [ ] Mock GitHub API response → aggregator writes correct normalized rows to test Supabase
- [ ] Duplicate URL → second run writes 0 new rows
- [ ] Relevance filter blocks non-qualifying titles before normalization call is made (verify GPT mock not called)

---

#### 17e — E2E Tests (Playwright)

Full browser tests against a running dev server. Auth state managed via Playwright `storageState` fixture (logged-in session saved once, reused across tests).

**Auth (`src/tests/e2e/auth.spec.ts`) — already partially written:**
- [x] Unauthenticated user redirected to `/login`
- [ ] Login with valid credentials → lands on `/feed`
- [ ] Login with invalid credentials → error message shown, no redirect
- [ ] `callbackUrl=/feed?job=abc` preserved through login → drawer opens after auth
- [ ] Idle 10 min → auto-logout (fast-forward with fake timers)

**Feed (`src/tests/e2e/feed.spec.ts`):**
- [ ] Feed loads → job cards visible
- [ ] "Remote only" toggle → all visible cards show remote location
- [ ] Date range filter "24h" → cards update
- [ ] Scroll to bottom → next page loads (cursor pagination)
- [ ] `?job=<id>` in URL → job detail drawer opens automatically
- [ ] Paste Greenhouse URL → job appears in feed
- [ ] "Just posted" badge on jobs under 3 hours old

**Tracker (`src/tests/e2e/tracker.spec.ts`):**
- [ ] Drag card from "Applied" → "Phone Screen" → card appears in new column
- [ ] Timeline in detail panel shows the status change
- [ ] Add rich-text note → persists on page refresh

**Profile (`src/tests/e2e/profile.spec.ts`):**
- [ ] Upload PDF resume → success toast → `resume_text` shown in field
- [ ] Add work history entry → appears in list
- [ ] Delete work history entry → removed from list

**Cover letter (`src/tests/e2e/cover-letter.spec.ts`):**
- [ ] Generate cover letter → content appears in editor
- [ ] Edit content → copy to clipboard button works
- [ ] Download PDF → file download triggered

**Prep (`src/tests/e2e/prep.spec.ts`):**
- [ ] Open Prep tab → question bank renders
- [ ] Generate STAR response → S/T/A/R sections populated
- [ ] Save STAR response → persists on refresh

---

#### 17f — Smoke Tests

Fast sanity checks run after every deploy. No mocking — hit the real deployed environment.

- [ ] `src/tests/smoke/health.spec.ts` — `GET /health` on worker returns `{ ok: true }` (200)
- [ ] `src/tests/smoke/app.spec.ts` — login page renders without JS errors; feed page renders for authenticated session; no 500 responses on any main route (`/feed`, `/tracker`, `/analytics`, `/prep`, `/profile`, `/settings`)
- [ ] Add smoke test script to `package.json`: `"test:smoke": "playwright test src/tests/smoke --reporter=line"`
- [ ] Wire smoke tests into Vercel post-deploy hook (run after successful deployment)

---

#### 17g — CI Configuration

- [ ] `.github/workflows/test.yml` — run on every PR: `vitest run` (unit + integration) + `playwright test` (E2E against dev server spun up in CI); fail PR if any test fails
- [ ] Separate `test:unit` and `test:integration` scripts in `package.json` so unit tests can run without network (faster local feedback loop)
- [ ] Worker test script in `worker/package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`
- [ ] Playwright config: `webServer` block spins up `next dev` before E2E run in CI; reuses existing server in local dev
- [ ] Coverage report: `vitest run --coverage` uploads to CI artifacts; enforce 80% threshold on `worker/src/` and `src/lib/`

---

### Phase 19 — Manual Application Entry

> Sometimes you apply for a job outside of Backlog — via a referral, LinkedIn Easy Apply, a company's direct careers page, or somewhere that Backlog doesn't aggregate. This phase adds a way to log those applications so they count toward your stats, appear in the tracker, and show up in analytics.

The existing "Add Job from URL" flow already handles jobs with a URL (Greenhouse/Lever via public APIs; other URLs via HTML fetch + GPT extraction). This phase extends that into a **two-mode entry modal** — URL-first (auto-extract + confirm) and pure-manual (no URL, just the basics) — and adds a dedicated "Log application" entry point on the tracker.

#### 19a — Two-Mode Entry Modal

**Mode 1: URL provided**

User pastes a job posting URL. The modal calls the existing URL extractor (`lib/jobs/url-extractor.ts`) to auto-fill as many fields as possible:
- Greenhouse/Lever URLs → full structured data via their public APIs (title, company, description, location, salary, tags, experience level)
- Other static URLs → HTML fetch + GPT-5 nano extraction (best-effort; fills what it can)
- JS-rendered pages that fail extraction → fields stay blank; user fills manually

The pre-filled form is shown in a review step. User can edit any field before confirming. This is the same extraction pipeline already used for "Add Job from URL" in the feed — we're just adding an application creation step on top.

**Mode 2: No URL (referral, LinkedIn Easy Apply, posting is gone, etc.)**

User fills in the bare minimum manually:
- **Company name** *(required)*
- **Job title** *(required)*
- **Location** — free text, optional ("Remote", "New York, NY")
- **Job URL** — optional; if added later, can be used to enrich the job
- **Applied date** — date picker, defaults to today
- **Status** — selector defaulting to "Applied"; options: Saved, Applied (don't offer later stages here — those are advanced via the tracker)
- **Notes** — single plain-text field for a quick note; not Tiptap (this is quick entry, not the full notes panel)

Fields intentionally omitted from manual entry: description, tags, salary, experience level. These can't be reliably entered by hand and require a job posting to be meaningful. Jobs entered without a description will show a prompt in their detail panel: "Add a URL to unlock match scoring and interview prep."

**What gets created:**
- `jobs` row: `source = 'manual'`; populated fields from extraction or manual input; `description` / `tags` / `salary` only if extracted from a URL
- `company_profiles` stub upserted (name + id) — same pattern as aggregation worker
- `applications` row: chosen status, `applied_at` stamped
- `application_timeline` row: `from_status: null → to_status: <chosen>`
- Job appears immediately in tracker; visible in feed with a "Manually added" badge

**Entry points:**
- Tracker: "+ Log application" button in the page header — the most natural home; you're already tracking
- Feed: "Enter manually" option in the existing "Add job" dropdown alongside "Paste URL"
- Keyboard shortcut `L` (for "Log") — opens the modal from anywhere in the app

- [x] `src/app/api/jobs/manual/extract/route.ts` — POST with `{ url }`, returns extracted job data without writing to DB, auth-gated
- [x] `src/app/api/jobs/manual/route.ts` — POST: creates job + company stub + application + timeline in one shot; returns `{ job_id, application_id, application: ApplicationWithJob }`
- [x] `src/components/shared/LogApplicationModal.tsx` — two-step modal: (1) URL input with "Extract" button or "Enter details manually" link; (2) form pre-filled from extraction or blank; status selector; date picker; "Save Application" submits to `POST /api/jobs/manual`
- [x] `src/components/tracker/TrackerBoard.tsx` — "+ Log Application" button in toolbar; dynamic application count; empty state with "Log your first application" CTA; on success, optimistically inserts card and opens detail panel
- [x] `src/components/feed/FeedHeader.tsx` — "Applied somewhere not in the feed? Log it manually →" link below URL input; opens modal; on success calls `onJobAdded` so job appears in feed
- [ ] Keyboard shortcut `L` — opens modal from anywhere; deferred to Phase 13 (global shortcuts pass)
- [ ] Jobs with no `description` show "Add URL to unlock prep & match scoring" nudge in detail panel — deferred (minor UX polish)

#### 19b — Analytics Integration

No additional schema work needed. `jobs.source` already distinguishes `github` / `portal` / `manual`. Phase 9 analytics will naturally pick up all manually-entered jobs in every chart, and the source breakdown widget will include them in the "manually logged" slice alongside URL-extracted jobs.

---

### Phase 18 — Gap Fixes & Reliability

> Gaps identified during codebase audit. Mix of UX problems, silent data issues, and reliability holes. Nothing here is a blocker, but several will cause confusion or wasted spend if left unaddressed.

---

#### 18a — Resume Extraction Review Step *(UX — high priority)*

**The problem:** After uploading a resume, the AI silently writes work history, education, skills, and Q&A answers straight to the DB with no review step. If it misreads a job title, invents a bullet, or parses dates wrong, you won't know until you notice something off in the extension auto-fill or a tailored resume. GPT-5 nano is accurate but not perfect — LLM extraction should never be fully trusted without a review gate.

**The fix:** After upload, instead of committing immediately, return the extracted data to the client and show a review modal. The user confirms, unchecks, or edits individual entries before they're written.

- [x] `src/app/api/profile/resume/route.ts` — add a `?dry_run=true` mode: run extraction, return the full `ResumeAnalysis` payload but do NOT write to DB
- [x] `src/components/profile/ResumeReviewModal.tsx` — modal shown after upload; displays extracted skills (checkboxes), work history entries (toggle each), education entries (toggle each), and Q&A pairs (toggle each); "Confirm & Save" button posts to a new `POST /api/profile/resume/commit` endpoint with the approved subset
- [x] `src/app/api/profile/resume/commit/route.ts` — accepts the reviewed/trimmed payload; writes only approved entries to DB; marks match scores stale
- [x] `src/components/profile/ResumeUpload.tsx` — wire in the review modal flow: upload → dry_run extract → show modal → on confirm → commit; keep current instant-commit as a fallback if modal is dismissed
- [x] If extraction produces zero entries (image PDF), skip the modal and show the existing warning

#### 18b — Skills Change Should Invalidate Match Scores

**The problem:** `match_scores` are invalidated when the resume is re-uploaded, but not when skills are manually added or removed on the profile page. If you add "Rust" to your skills, existing cached scores still don't reflect it until the resume is re-uploaded.

- [x] `src/app/api/profile/route.ts` — when a `PATCH` includes a `skills` field that differs from the current value, run `UPDATE match_scores SET is_stale = true WHERE user_id = ?`
- [x] Same invalidation on `POST /api/profile/work-history` and `DELETE /api/profile/work-history/[id]` — work history changes affect resume quality signals

#### 18c — Resume Analyzer Missing Fields

**The problem:** The analyzer extracts name, phone, address, skills, work history, education, and Q&A — but misses LinkedIn URL, GitHub URL, and portfolio URL, which are almost always on a CS resume. It also doesn't extract GPA, which is on the education table but never populated by upload.

- [x] `src/lib/llm/resume-analyzer.ts` — add to the extraction prompt and `ResumePersonalInfo` type: `linkedin_url`, `github_url`, `portfolio_url` (all string | null)
- [x] Add `gpa: number | null` to `ResumeEducationEntry` and extract it from the resume
- [x] `src/app/api/profile/resume/route.ts` — populate these fields during the commit step (same null-check logic as name/phone/address)

#### 18d — Discord Ignores Match Threshold

**The problem:** `dispatchNotifications` sends every new job to Discord regardless of the user's `alert_match_threshold` setting. If your threshold is 70% but a batch of 25 jobs all score 30%, Discord still fires for all of them. Match scores aren't available at notification time (they're lazy), but we can use the same Jaccard proxy from Phase 15b as a pre-send filter.

- [x] `worker/src/notifications/dispatcher.ts` — after computing Jaccard scores for sort order (Phase 15b), also filter out jobs below a configurable `DISCORD_MIN_RELEVANCE` threshold (env var, default `0` = no filter); this prevents completely unrelated jobs from cluttering the Discord feed
- [x] Long-term (post Phase 15b): once skills-based Jaccard is in place, surface only jobs with score ≥ threshold in Discord

#### 18e — No Error Recovery on Anthropic API Failures

**The problem:** Cover letter generation, resume tailoring, STAR response drafting, and interview guide generation all call Claude with no retry, no timeout guard, and no user-facing fallback beyond a generic error. If Anthropic has a brief outage, the user gets a failed state with no way to recover other than clicking again (and there's no retry button on most of these surfaces).

- [x] `src/lib/llm/cover-letter.ts`, `resume-tailor.ts`, `star-builder.ts`, `question-generator.ts` — wrap Anthropic calls in a shared `withRetry(fn, maxAttempts = 2)` utility that retries once on 529/overloaded errors with a 2s delay; does not retry on 400/auth errors
- [x] `src/lib/llm/retry.ts` — implement the `withRetry` utility (10 lines, reused across all LLM callers)
- [ ] Each LLM-backed UI surface (cover letter editor, STAR builder, tailored resume generator) should show a "Retry" button in the error state rather than requiring a full page action

#### 18f — Work History Description Quality

**The problem:** The resume analyzer writes a "2–3 sentence summary of responsibilities and impact" as the work history description. But the extension uses this description to fill open-ended experience questions, and a dense summary paragraph is worse than bullet points for that purpose. The tailored resume generator also works better with bullet-formatted input.

- [x] `src/lib/llm/resume-analyzer.ts` — change the `description` field prompt to output 3–5 bullet points ("•  ...") instead of prose; this format is more useful for both extension auto-fill and resume tailoring context

#### 18g — Portal Companies Coverage Check

**The problem:** The 30+ portal companies list in `worker/src/portals/companies.ts` was seeded once and hasn't been audited. Some slugs may be stale (companies switch from Greenhouse to Lever or to Workday), and there are likely major new-grad-hiring companies missing.

- [x] Audit `worker/src/portals/companies.ts` — verify slugs still resolve (404s already handled gracefully, but dead entries waste a fetch); add any notable missing companies (Stripe, Figma, Notion, Linear, Vercel, etc.)
- [x] Add a `worker/src/portals/validate-slugs.ts` script (run manually) that hits each slug's API endpoint and logs which ones 404 — makes future audits easy

#### 18h — IdleLogout Event Listener Leak

**The problem:** `IdleLogout.tsx` registers a `focus` listener with an inline arrow function `() => void checkIdle()`, but the cleanup tries to remove a *different* arrow function with the same shape — `removeEventListener` requires the exact same function reference to succeed. The focus listener is therefore never removed. On pages that remount the component (e.g. soft navigation), listeners accumulate, causing multiple parallel idle checks that can fire logout prematurely.

- [x] `src/components/auth/IdleLogout.tsx` — extract the focus handler to a stable reference (e.g. `useCallback` or a ref) before passing to both `addEventListener` and `removeEventListener`

#### 18i — Open Redirect in Login Page

**The problem:** `login/page.tsx` reads the `redirectedFrom` search param and passes it directly to `router.push()`. The middleware only ever sets this param to `pathname + search` (always a same-origin path), but the param itself is unguarded. A crafted link like `/login?redirectedFrom=//evil.com` would redirect the user off-site after a successful login.

- [x] `src/app/(auth)/login/page.tsx` — validate `redirectedFrom` before use: accept only values that start with `/` and not `//`; fall back to `/dashboard` on anything else

#### 18j — Upsert Writes Duplicate Timeline Entry

**The problem:** `POST /api/applications` does an upsert on `(user_id, job_id)` and then *always* inserts a timeline row with `from_status: null, to_status: <status>`. If the same user POSTs the same job twice (e.g. double-clicking "Save", or clicking "Save" on a job that was already saved), the upsert silently updates the row but a second `from_status: null` timeline row is written, corrupting the status history.

- [x] `src/app/api/applications/route.ts` — check whether the upsert actually inserted a new row (Supabase returns `count` on upsert when `returning: 'minimal'` is not set, or compare before/after status); only write the initial timeline row if the row is newly created, not on update

---

### Phase 12 — Export & Integrations

- [ ] CSV export of full application history
- [ ] Google Sheets OAuth integration — push / sync tracker data on demand

> Note: Google Sheets OAuth requires setting up a Google Cloud project, OAuth credentials, and a redirect URI. More infrastructure than it looks — scope this carefully.

### Phase 13 — Polish, Performance & QoL

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

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Voice | Claude subagent | Independent 2nd opinion | 1 | issues_found | 10 issues raised, 4 critical incorporated into plan |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 6 issues found, all resolved |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**OUTSIDE VOICE:** 10 issues raised. 4 incorporated: (1) Tier 2 must not overwrite Tier 1, (2) `chrome.storage.session` is session-scoped not tab-scoped — need tabId key + onRemoved cleanup, (3) `history.pushState` patching requires `world: MAIN` for CSP-strict sites, (4) multi-page review must store filled fields at fill time (DOM is gone post-navigation). Remaining 6 are known risks accepted for personal-tool scope.

**UNRESOLVED:** 0 decisions open.

**VERDICT:** ENG REVIEW CLEARED — ready to implement. Suggested sequencing: Phase 10 immediate fixes first (remove fillGreenhouse, add blur dispatch, EEO profile UI, open-ended answer endpoint), then Phase 10A multi-page engine.
