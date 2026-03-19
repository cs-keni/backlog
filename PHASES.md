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

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js (App Router)** | SSR, API routes, Vercel-native, excellent DX |
| Styling | **Tailwind CSS** | Fast, consistent, utility-first |
| Animations | **Framer Motion** | Spring physics, staggered entrances, gesture support |
| Backend | **Next.js API Routes + Render (worker)** | API routes for app logic; Render runs background aggregation workers on a cron schedule |
| Database | **Supabase (PostgreSQL)** | Free tier, built-in auth, real-time subscriptions, great JS SDK |
| LLM — High Frequency | **GPT-4o-mini (OpenAI)** | Cheap, fast, used for job normalization (runs on every new posting) |
| LLM — Quality Tasks | **Claude Sonnet 4.6 (Anthropic)** | Used for cover letters, resume tailoring, STAR responses — fewer calls, higher stakes |
| Notifications | **Resend (email) + Web Push API + Twilio (SMS)** | Multi-channel alerts for new high-match jobs |
| PDF Parsing | **pdf-parse or pdfjs-dist** | Extract raw text from uploaded resume PDFs |
| Charts | **Recharts** | Composable, React-native chart library |
| Hosting | **Vercel (frontend) + Render (workers)** | Both have generous free tiers |

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
│  - jobs              (normalized job postings)            │
│  - applications      (user pipeline + notes)             │
│  - users             (profile, resume text, preferences) │
│  - cover_letters     (generated letters per application) │
│  - company_profiles  (description, Q&A bank, metadata)   │
│  - sources           (GitHub repos + fetch schedule)     │
│  - notifications     (alert preferences per user)        │
│  - Real-time subscriptions → live feed updates           │
└───────────────────────▲──────────────────────────────────┘
                        │ writes normalized jobs
┌───────────────────────┴──────────────────────────────────┐
│              Aggregation Worker (Render)                  │
│  - Cron jobs poll SimplifyJobs + similar GitHub repos    │
│  - GitHub API fetches latest commits / markdown diffs    │
│  - GPT-4o-mini normalizes raw entries into DB schema     │
│  - Deduplication before writing                          │
│  - Triggers notification pipeline for matching users     │
└──────────────────────────────────────────────────────────┘
                        │ alerts
┌───────────────────────▼──────────────────────────────────┐
│              Notification Service                         │
│  - Resend → email alerts                                 │
│  - Web Push API → browser push notifications             │
│  - Twilio → SMS to registered phone number              │
└──────────────────────────────────────────────────────────┘
```

### Database Schema (High-Level)

**`jobs`**
- `id`, `title`, `company`, `location`, `salary_min`, `salary_max`, `url`, `source`, `posted_at`, `fetched_at`, `description`, `tags[]`, `is_remote`, `experience_level`, `company_id`

**`applications`**
- `id`, `user_id`, `job_id`, `status` (saved | applied | phone_screen | technical | final | offer | rejected), `applied_at`, `notes`, `recruiter_name`, `recruiter_email`, `last_updated`

**`users`**
- `id`, `email`, `phone`, `resume_text`, `resume_url`, `preferred_locations[]`, `preferred_salary_min`, `skills[]`, `experience_level`, `notification_email`, `notification_push`, `notification_sms`, `alert_match_threshold`

**`cover_letters`**
- `id`, `user_id`, `job_id`, `template_type` (formal | casual | startup), `content`, `created_at`

**`company_profiles`**
- `id`, `name`, `description`, `glassdoor_rating`, `headcount_range`, `funding_stage`, `behavioral_questions[]`, `technical_questions[]`, `last_updated`

**`sources`**
- `id`, `name`, `type` (github), `url`, `last_fetched_at`, `fetch_interval_minutes`

**`notification_log`**
- `id`, `user_id`, `job_id`, `channel` (email | push | sms), `sent_at`

### Job Sources (Phase 1 Scope)

| Source | Method | Update Frequency |
|---|---|---|
| SimplifyJobs/New-Grad-Positions | GitHub API — poll for new commits, parse markdown diff | Every 15 min |
| SimplifyJobs/Summer2025-Internships | GitHub API | Every 15 min |
| Other community GitHub job repos | GitHub API | Every 30 min |

Additional sources (LinkedIn, Indeed, Glassdoor) are deferred to a future phase due to scraping complexity and ToS considerations.

### LLM Strategy

| Task | Model | Rationale |
|---|---|---|
| Job normalization (title, salary, location, skills extraction) | GPT-4o-mini | High frequency, low cost ($0.15/1M tokens), fast |
| Resume match scoring | GPT-4o-mini | Runs per job per user, needs to be cheap |
| Resume tailoring for a specific job | Claude Sonnet 4.6 | Quality matters, fewer calls |
| Cover letter generation | Claude Sonnet 4.6 | Nuanced writing, template adherence |
| STAR method response drafting | Claude Sonnet 4.6 | Structured, thoughtful output |
| Cover letter template selection | Claude Sonnet 4.6 | Reads job/company tone, picks formal/casual/startup |

### Key Features

**Real-Time Job Feed**
- Supabase real-time subscriptions push new jobs to the UI without a page refresh
- Jobs sorted by `posted_at` — newest first, always
- "Just posted" badge on jobs under 3 hours old
- Resume match score (0–100%) on every card with a short LLM rationale

**Filters & Search**
- Location (city, state, remote, hybrid, on-site)
- Salary range (min/max slider)
- Experience level (new grad, mid-level, senior, staff)
- Role type (frontend, backend, full-stack, ML/AI, infra, mobile, etc.)
- Saved filter presets — save your default view

**Resume Management**
- Upload a PDF resume — text is extracted and stored in your profile
- "Tailor for this job" button on any job detail page — Claude rewrites your resume bullets to better align with the JD, without fabricating experience
- Original resume always preserved; tailored versions are separate

**Cover Letter Generator**
- Optional — triggered by a "Generate Cover Letter" button per job
- Three templates: `formal`, `casual`, `startup-focused`
- LLM reads the job description and company profile to pick the best-fit template automatically
- User can override template choice, regenerate, and edit inline before saving
- Saved per application

**Application Pipeline / Kanban**
- Stages: `Saved → Applied → Phone Screen → Technical → Final Round → Offer / Rejected`
- Drag-and-drop cards between stages with smooth animation
- Each card: company logo, role title, date applied, days since last update
- Per-application detail panel: notes (rich text), recruiter name + email, application URL, timeline of status changes

**Company Intelligence Panel**
- Every job detail page has a collapsible company panel
- Contains: company description, industry, headcount range, funding stage, Glassdoor rating (where available)
- Behavioral questions this company is known to ask (community-sourced + LLM-enriched)
- Technical questions / topics (e.g. "often asks system design for distributed caches")
- Helps you walk into an interview having done your homework

**Interview Prep**
- Per-application "Prep" tab with company-specific behavioral and technical questions
- STAR method response builder: paste a question → Claude drafts a structured response using your profile/resume as context → you edit and save it
- Saved responses are reusable across applications to the same company or similar roles

**Alert System**
- User configures: match score threshold, preferred role types, locations, salary floor
- When a new job clears all thresholds, alerts fire across configured channels
- Channels: email (Resend), browser push (Web Push API), SMS (Twilio)
- Notification log in settings so you can see what was sent and when

**Analytics Page (`/analytics`)**
- Jobs posted today vs. 7-day rolling average
- Application activity chart — toggle between weekly / monthly / yearly views
- Application funnel: how many at each stage (applied → phone screen → technical → offer)
- Response rate (applications that moved past "applied" / total applied)
- Most active companies hiring right now
- Time-to-first-response distribution (how long before you heard back)

**Dashboard Mini-Stats**
- Compact stat strip on the main dashboard: jobs posted today, your open applications, interviews this week, match score of the top new job
- Small sparkline of your application activity over the last 30 days

**Export**
- CSV export of all application data
- Google Sheets integration — OAuth connect once, push or sync application tracker to a sheet on demand

**Auth & Access Control**
- Supabase Auth handles login/session
- Registration page exists but shows "Account creation is temporarily closed" on submit — no actual signup flow
- Accounts are created manually by the admin directly in Supabase dashboard
- Row-level security (RLS) on all tables ensures users only see their own data

---

## Quality of Life / UX

- **Dark mode by default** — designed dark-first, light mode optional
- **Framer Motion throughout** — staggered job card entrances on feed load, spring-physics drag on kanban, smooth page transitions, micro-animations on buttons and badges
- **Loading skeletons** — every async surface has a skeleton state, no blank screens
- **Keyboard shortcuts** — `F` to focus filters, `K`/`J` to navigate job cards, `A` to mark as applied, `?` to show shortcut cheatsheet
- **Onboarding flow** — first login prompts resume upload + notification preferences + alert configuration before showing the feed
- **Profile completeness indicator** — subtle progress bar encouraging users to fill in skills, salary expectations, locations
- **"Quick apply" action** — one-click to mark a job as applied directly from the feed card without opening the detail page
- **Recruiter contact auto-detection** — when pasting a job URL into the notes, LLM attempts to extract recruiter name and email if present in the page
- **Notification preferences page** — granular control over which events trigger which channels
- **Application age indicator** — visual cue when a saved job is getting old ("applied 12 days ago — follow up?")
- **Responsive layout** — fully usable on mobile for quick triage on the go
- **Toast notifications** — non-blocking feedback for actions (job saved, cover letter generated, export complete)
- **Command palette** (`Cmd+K`) — fuzzy search across jobs, applications, companies
- **Empty state illustrations** — friendly, on-brand empty states instead of blank white boxes
- **Optimistic UI updates** — kanban card moves feel instant; rollback on failure

---

## Phases

### Phase 1 — Foundation & Auth
- [ ] Initialize Next.js project with App Router, Tailwind CSS, Framer Motion
- [ ] Configure Supabase project — create all tables, enable RLS, set up auth
- [ ] Build auth pages: login, "registration closed" message on signup
- [ ] Provision admin account directly in Supabase
- [ ] Build base layout: sidebar nav, header, route structure (`/feed`, `/tracker`, `/analytics`, `/prep`, `/profile`, `/settings`)
- [ ] Implement protected routes — redirect unauthenticated users to login
- [ ] Deploy skeleton app to Vercel; confirm environment variables and Supabase connection

### Phase 2 — Job Aggregation Engine
- [ ] Set up Render worker service (Node.js)
- [ ] Integrate GitHub API to poll SimplifyJobs repos for new commits
- [ ] Parse markdown diffs to extract new job entries
- [ ] Integrate GPT-4o-mini to normalize raw entries into `jobs` schema
- [ ] Implement deduplication logic before DB writes
- [ ] Schedule cron jobs (every 15 min for primary sources)
- [ ] Write aggregated jobs to Supabase in real time
- [ ] Add `sources` table management and last-fetched tracking

### Phase 3 — Job Feed & Discovery
- [ ] Build real-time job feed UI with Supabase subscriptions
- [ ] Job card component: title, company, location, salary, posted time, match score placeholder, "Just posted" badge
- [ ] Job detail page/drawer: full description, company panel, apply button, save button
- [ ] Filter sidebar: location, salary range, experience level, role type, remote toggle
- [ ] Saved filter presets
- [ ] Sort controls (newest, highest match, salary)
- [ ] Skeleton loading states for feed and detail

### Phase 4 — Application Tracker
- [ ] Kanban board with drag-and-drop (Framer Motion)
- [ ] Application stages: Saved → Applied → Phone Screen → Technical → Final → Offer / Rejected
- [ ] Application detail panel: notes (rich text), recruiter info, timeline, linked job
- [ ] "Quick apply" action from feed card
- [ ] Application age and follow-up nudges
- [ ] Animations: card entrance, drag physics, stage transition

### Phase 5 — Resume & Profile
> Profile data here powers the browser extension in Phase 10 — the richer this is, the better auto-fill works.

- [ ] Profile page with structured fields:
  - Personal: full name, email, phone, address, LinkedIn URL, GitHub URL, portfolio URL
  - Work authorization: citizenship status, visa sponsorship required, willing to relocate
  - Preferences: salary expectations, preferred locations, preferred role types, remote preference
  - Experience level, years of experience
- [ ] Work history section: structured entries (company, title, start/end dates, description) — not just resume text
- [ ] Education section: school, degree, field of study, GPA, graduation year
- [ ] Skills list (user-managed, also auto-extracted from resume)
- [ ] Pre-written answers to common application questions ("Tell us about yourself", "Why are you interested in this role?")
- [ ] PDF resume upload → text extraction via `pdf-parse`
- [ ] Store resume text + structured profile in `users` table; display parsed preview
- [ ] Resume match scoring: GPT-4o-mini compares resume to each job's JD, returns 0–100 score + rationale
- [ ] Display match score + rationale on job cards and detail page
- [ ] "Tailor resume for this job" — Claude Sonnet rewrites resume bullets aligned to JD, saved separately as a versioned PDF
- [ ] Profile completeness indicator with per-section breakdown

### Phase 6 — Cover Letters
- [ ] Cover letter template definitions: `formal`, `casual`, `startup-focused`
- [ ] "Generate Cover Letter" button on job detail page
- [ ] Claude Sonnet reads JD + company profile + user resume → selects template → generates letter
- [ ] Inline editor for reviewing and editing generated letter
- [ ] Save finalized letter to `cover_letters` table linked to application
- [ ] Template override option (user can force a specific template)

### Phase 7 — Company Intelligence & Interview Prep
- [ ] `company_profiles` table population: LLM-enriched descriptions from job postings
- [ ] Company panel on job detail: description, headcount, funding, Glassdoor rating
- [ ] Behavioral and technical question bank per company
- [ ] Per-application "Prep" tab surfacing company-specific questions
- [ ] STAR response builder: input question → Claude drafts structured response using user profile → user edits and saves
- [ ] Saved responses reusable across similar applications

### Phase 8 — Notifications & Alerts
- [ ] Notification preferences UI (match threshold, role types, channels)
- [ ] Email alerts via Resend — triggered when new job clears user thresholds
- [ ] Browser push notifications via Web Push API
- [ ] SMS alerts via Twilio to user's registered phone
- [ ] Notification log page in settings
- [ ] Respect quiet hours preference

### Phase 9 — Analytics
- [ ] `/analytics` page
- [ ] Jobs posted today + 7-day rolling average chart
- [ ] Application activity chart with weekly / monthly / yearly toggle (Recharts)
- [ ] Application funnel visualization (Sankey or stacked bar)
- [ ] Response rate metric
- [ ] Most active companies hiring right now
- [ ] Time-to-first-response distribution
- [ ] Dashboard mini-stats strip + 30-day sparkline

### Phase 10 — Browser Extension (Auto-Fill)
> A Chrome extension that connects to Backlog's backend and automatically fills out job applications on external sites using the user's structured profile, tailored resume, and generated cover letter.

**How it works:** The extension runs a content script inside whatever job application page the user is on (Greenhouse, Lever, Workday, iCIMS, custom portals). It reads all form field labels and input types, sends them to the Backlog API, the LLM maps each field to the user's profile data and generates answers for open-ended questions, then fills the form programmatically. The user reviews the filled form before submitting. On submit, the extension notifies Backlog and auto-moves the job to "Applied" in the kanban.

- [ ] Chrome extension scaffold (Manifest V3, content script, background service worker, popup)
- [ ] Secure API key linking — extension authenticates against Backlog backend with a user-scoped key generated in Settings
- [ ] Content script: DOM traversal to detect and extract all form fields (label text, input type, name attributes, dropdowns, textareas, file inputs)
- [ ] Targeted parsers for major ATS platforms: Greenhouse, Lever, Workday, iCIMS, BambooHR — these have consistent HTML structures that improve fill accuracy
- [ ] LLM field mapper (Claude Sonnet): receives field list + job context → returns a `{ fieldId: value }` mapping using user's structured profile
- [ ] LLM answer generation for open-ended questions ("Why do you want to work here?", "Tell us about a challenge you overcame") using resume + company profile + STAR responses from prep
- [ ] Cover letter attachment: if a cover letter was generated for this job in Backlog, extension attaches it to file upload fields
- [ ] Tailored resume attachment: attaches the job-specific tailored resume PDF if one exists, otherwise falls back to base resume
- [ ] Review UI: extension popup shows a diff-style preview of what will be filled before committing — user can edit individual fields
- [ ] One-click fill + manual submit: extension fills all fields, user reviews, user clicks the site's native Submit button
- [ ] Post-submit callback: extension detects successful submission and notifies Backlog API → job auto-moves to "Applied", applied_at timestamp set
- [ ] Settings page in extension: view linked account, API key, toggle auto-detect on/off per site
- [ ] "Initiate from Backlog" flow: clicking "Auto-Apply" on a Backlog job card opens the application URL in a new tab with the extension pre-loaded and ready
- [ ] Firefox support (Manifest V2 compatibility layer)

### Phase 11 — Export & Integrations
- [ ] CSV export of full application history
- [ ] Google Sheets OAuth integration — push / sync tracker data on demand

### Phase 12 — Polish, Performance & QoL
- [ ] Keyboard shortcuts (`F`, `K`/`J`, `A`, `?`, `Cmd+K`)
- [ ] Command palette with fuzzy search (jobs, applications, companies)
- [ ] Onboarding flow for first login
- [ ] Full mobile-responsive layout audit
- [ ] Empty state illustrations
- [ ] Optimistic UI updates across all mutations
- [ ] Toast notification system
- [ ] Performance audit: lazy loading, image optimization, query caching
- [ ] PWA manifest + service worker for offline basic functionality

---

## Future / Long-Term

- [ ] Additional job sources: LinkedIn, Indeed, Glassdoor (when scraping strategy is solid)
- [ ] Collect anonymized cover letter + resume + outcome data (with user consent) to build a training dataset
- [ ] Fine-tune a custom LLM on successful application materials — eventually replace Claude/OpenAI calls for cover letters and resume tailoring with a self-hosted model trained on real outcomes
- [ ] Referral network: surface mutual connections at companies you're applying to (LinkedIn graph integration)
- [ ] Salary negotiation assistant: LLM-powered coaching based on offer details and market data
- [ ] Auto-submit mode: after user reviews and approves a filled form once, allow fully automated submission for similar ATS platforms with no review step
