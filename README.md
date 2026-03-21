# Backlog

> Apply faster. Track smarter. Land the role.

Backlog is a real-time job aggregation and application tracking web app built specifically for software engineers. It aggregates new job postings from community-maintained sources the moment they go live, helps you prioritize and apply quickly, generates tailored resumes and cover letters, preps you for interviews, and even auto-fills applications — all from one place.

The core insight: in SWE recruiting, applying within hours of a posting going live meaningfully increases your odds of getting a response. Backlog is built around that urgency.

---

## Features

### Live Job Feed
- Aggregates new grad and experienced SWE roles from GitHub sources (SimplifyJobs, etc.) in real time
- Supabase real-time subscriptions — new jobs appear in your feed without a page refresh
- "Just posted" badges on roles under 3 hours old
- LLM-powered resume match score (0–100%) on every card — computed lazily on first view per user, cached in DB, invalidated when resume changes
- **"Add Job from URL"** — paste any job posting link; Backlog fetches and normalizes it automatically. Greenhouse and Lever URLs use their public APIs for clean structured data. Other URLs are fetched and parsed via LLM. JS-rendered pages that can't be server-fetched can be added via the "Add to Backlog" button in the browser extension.

### Smart Filters
- Location, remote/hybrid/on-site, salary range, experience level, role type
- Saved filter presets so your default view is always ready
- Cursor-based infinite scroll — 25 jobs per page, loads more as you scroll

### Application Tracker
- Kanban board with drag-and-drop stages: `Saved → Applied → Phone Screen → Technical → Final Round → Offer / Rejected`
- Full status change timeline per application (not just current status)
- Per-application notes (rich text via Tiptap), recruiter contacts, linked job
- Follow-up nudges when applications go stale

### Profile & Settings
- Structured personal profile: full name, email, phone, address, LinkedIn, GitHub, portfolio URL
- Work authorization: citizenship status, visa sponsorship required, willing to relocate
- Job preferences: salary expectations, preferred locations, preferred role types, remote preference
- Work history: structured entries (company, title, dates, description) — not just resume text
- Education: school, degree, field of study, GPA, graduation year
- Skills list (user-managed, also auto-extracted from resume)
- Pre-written answers to common application questions ("Tell us about yourself", "Why are you interested in this role?") — reused by extension for standard text prompts
- This structured profile is the source of truth for the browser extension's auto-fill

### Resume Management
- Upload your resume as a PDF — text is extracted and stored in your profile
- "Tailor for this job" — LLM rewrites your resume bullets to align with a specific JD, saved as a versioned PDF separate from your base resume

### Cover Letter Generator
- Optional cover letter per application, triggered on demand
- Three templates: `formal`, `casual`, `startup-focused` — LLM picks the best fit based on company tone
- Inline editor to review, edit, and save before attaching
- Cover letters are linked to the application, not just the job

### Company Intelligence
- Company description, headcount, funding stage on every job detail page
- Minimal company record created automatically at job ingest time; enriched further in Phase 7
- Glassdoor ratings: populated where available via a third-party data source (not LLM-generated)
- Behavioral and technical questions the company is known to ask

### Interview Prep
- Per-application prep tab with company-specific questions
- STAR method response builder — paste a behavioral question, Claude drafts a structured answer using your profile and resume as context, you edit and save
- Saved responses reusable across similar applications

### Browser Extension (Chrome / Firefox)
- Connects to your Backlog account via a secure, user-scoped API key generated in Settings
- **Auto-fill flow**: click "Auto-Apply" on a Backlog job card → ATS page opens in a new tab → extension detects the form and fills it → you review everything in the extension popup → you click the site's native Submit button — **the extension never submits for you**
- Standard fields (name, email, phone, address, work history, education, work authorization, etc.) are filled directly from your structured profile — no LLM call
- LLM (Claude Sonnet) is invoked only for open-ended questions ("Why do you want to work here?", "Tell us about a challenge you overcame") — uses your STAR responses and profile as context
- Attaches your tailored resume and cover letter automatically when file upload fields are detected
- On submit, Backlog auto-marks the job as Applied in your kanban tracker
- **"Add to Backlog" button** appears on any job posting page — extracts the job details from whatever page you're on and sends it to Backlog as a manual entry (solves JS-rendered pages that can't be server-fetched)
- Workday support is best-effort: Workday uses Angular-rendered non-standard inputs that require synthetic input events rather than direct value setting

### Alerts & Notifications
- Email, browser push, and SMS alerts when a high-match job drops
- Configurable thresholds: match score, role type, location, salary floor
- Quiet hours support
- Notification log shows everything sent and when — deduplication prevents repeat alerts across worker runs

### Analytics
- Jobs posted today, weekly trends, 7-day rolling averages
- Application activity charts: weekly / monthly / yearly
- Application funnel: how many roles at each stage
- Response rate, time-to-first-response distribution
- Breakdown of manually-added jobs vs aggregated feed jobs

### Export
- CSV export of your full application history
- Google Sheets sync via OAuth

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | **Next.js (App Router)** | SSR, API routes, Vercel-native, file-based routing maps cleanly to the app's pages |
| Styling | **Tailwind CSS** | Utility-first, fast to iterate, consistent design system without a component library |
| Animations | **Framer Motion** | Spring physics, staggered entrances, gesture support — used for page transitions, job card entrances, and kanban animations |
| Drag & Drop | **@dnd-kit/core** | The modern, accessible DnD primitive for React. Framer Motion handles the animation layer on top; dnd-kit handles the actual drag logic |
| Rich Text | **Tiptap** | Headless rich text editor for application notes — stores as ProseMirror JSON (`jsonb` in DB), clean React integration, no opinionated UI |
| Command Palette | **cmdk** | Headless command menu primitive — powers the Cmd+K fuzzy search across jobs, applications, and companies |
| Backend | **Next.js API Routes + Render (worker)** | API routes handle app logic; Render runs the background aggregation worker on a cron schedule (Vercel serverless functions time out too quickly for long-running jobs) |
| Database | **Supabase (PostgreSQL)** | Managed Postgres with built-in auth, row-level security, and real-time subscriptions — eliminates the need for a separate auth service and WebSocket layer |
| LLM — High Frequency | **GPT-4o-mini (OpenAI)** | $0.15/1M tokens, fast. Used for job normalization, resume match scoring, and URL-pasted job extraction. Cost matters here |
| LLM — Quality Tasks | **Claude Sonnet 4.6 (Anthropic)** | Used for cover letters, resume tailoring, STAR responses, and extension open-ended field answers — fewer calls, quality matters |
| Notifications | **Resend (email)** | Simple REST API for transactional email, generous free tier |
| Notifications | **Web Push API** | Native browser push — no third-party service needed, works across Chrome and Firefox |
| Notifications | **Twilio (SMS)** | SMS as a high-urgency channel. Can be deferred if overkill for personal use |
| File Storage | **Supabase Storage** | Stores uploaded resume PDFs and generated tailored resume/cover letter PDFs. `users.resume_url` and `resume_versions.pdf_url` point to Storage URLs |
| PDF Parsing | **pdf-parse** | Lightweight server-side text extraction from uploaded resume PDFs |
| PDF Generation | **@react-pdf/renderer** | Generates versioned tailored resume PDFs server-side using a declarative React-style API — lighter than Puppeteer, no headless browser |
| Charts | **Recharts** | Composable, React-native chart library — integrates cleanly with Tailwind and Framer Motion |
| Unit/Integration Testing | **Vitest** | Better ESM support than Jest for Next.js 14+, fast, compatible with the same assertion API |
| API Mocking (tests) | **MSW (Mock Service Worker)** | Intercepts fetch calls in tests so we never hit real OpenAI/Anthropic/GitHub APIs in CI |
| E2E Testing | **Playwright** | Simulates real browser sessions to test full user flows (login → feed → apply → kanban). Unrelated to the browser extension — that uses native DOM manipulation via content scripts |
| Hosting | **Vercel (frontend) + Render (workers)** | Both have generous free tiers; Render's persistent background workers are the right fit for long-running cron jobs |
| Browser Extension | **Chrome Manifest V3 + Firefox MV2 compat** | MV3 is required for Chrome Web Store; a thin MV2 compatibility shim covers Firefox |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Next.js (Vercel)                     │
│  Job feed · Tracker · Resume · Cover letters · Prep      │
│  Analytics · Settings · Auth                             │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                  Supabase (PostgreSQL)                    │
│  jobs · applications · application_timeline              │
│  users · work_history · education · saved_answers        │
│  resume_versions · cover_letters · match_scores          │
│  company_profiles · sources · notification_log           │
│  api_keys                                                │
│  Real-time subscriptions for live feed updates           │
└──────────┬────────────────────────────┬──────────────────┘
           │ writes                     │ reads
┌──────────▼────────────┐   ┌──────────▼──────────────────┐
│  Aggregation Worker   │   │    Browser Extension        │
│  (Render cron)        │   │    (Chrome / Firefox)       │
│  GitHub API →         │   │    Content script reads ATS │
│  GPT-4o-mini          │   │    form fields via DOM      │
│  normalize → DB       │   │    Template-fills standard  │
│  upsert company stub  │   │    fields from local profile│
│  trigger alerts       │   │    LLM for open-ended only  │
└───────────────────────┘   │    user reviews → submits   │
                            │    → update tracker         │
           URL paste        │    "Add to Backlog" button  │
┌──────────▼────────────┐   │    on any job posting page  │
│  URL Job Extractor    │   └─────────────────────────────┘
│  Greenhouse/Lever API │
│  → structured data    │
│  Other URLs → fetch   │
│  + GPT-4o-mini parse  │
│  JS pages → extension │
└───────────────────────┘
```

---

## Module Structure

```
lib/
  supabase/
    client.ts          # browser Supabase client
    server.ts          # server-side client (service role key)
  github/
    fetcher.ts         # GitHub API polling, commit diff fetching
    parser.ts          # markdown diff → raw job entries
  jobs/
    url-extractor.ts   # "Add Job from URL": Greenhouse/Lever API + HTML fetch fallback
  llm/
    normalizer.ts      # GPT-4o-mini: raw entry → jobs schema
    matcher.ts         # GPT-4o-mini: resume × JD → match score (lazy, cached)
    writer.ts          # Claude Sonnet: cover letters, tailored resume, STAR
    field-mapper.ts    # Claude Sonnet: extension open-ended question answers
  notifications/
    email.ts           # Resend
    push.ts            # Web Push API
    sms.ts             # Twilio
    dispatcher.ts      # orchestrates multi-channel, checks thresholds, deduplicates
  pdf/
    parser.ts          # pdf-parse wrapper (resume text extraction)
    generator.ts       # @react-pdf/renderer wrapper (tailored resume PDF output)
workers/
  aggregator.ts        # orchestrates fetcher → parser → normalizer → dedup → DB write → company upsert → notify
```

---

## Database Schema

**`jobs`**
- `id`, `title`, `company`, `company_id`, `location`, `salary_min`, `salary_max`, `url`, `source` (github | manual), `posted_at`, `fetched_at`, `description`, `tags[]`, `is_remote`, `experience_level`
- `source` distinguishes automated aggregation (`github`) from user-pasted entries (`manual`)

**`applications`**
- `id`, `user_id`, `job_id`, `status` (saved | applied | phone_screen | technical | final | offer | rejected), `applied_at`, `notes` (`jsonb` — Tiptap ProseMirror format), `recruiter_name`, `recruiter_email`, `last_updated`

**`application_timeline`** ← tracks full status history, not just current
- `id`, `application_id`, `from_status`, `to_status`, `changed_at`, `note`

**`users`** ← full structured profile; source of truth for extension auto-fill
- `id`, `email`, `full_name`, `phone`, `address`, `linkedin_url`, `github_url`, `portfolio_url`
- `citizenship_status`, `visa_sponsorship_required` (bool), `willing_to_relocate` (bool)
- `resume_text`, `resume_url`
- `preferred_locations[]`, `preferred_salary_min`, `preferred_role_types[]`, `remote_preference` (remote | hybrid | onsite | any)
- `skills[]`, `experience_level`, `years_of_experience`
- `notification_email` (bool), `notification_push` (bool), `notification_sms` (bool)
- `notification_quiet_hours_start` (time), `notification_quiet_hours_end` (time)
- `alert_match_threshold`

**`work_history`** ← structured work entries for extension form-fill
- `id`, `user_id`, `company`, `title`, `start_date`, `end_date`, `is_current` (bool), `description`

**`education`** ← structured education entries for extension form-fill
- `id`, `user_id`, `school`, `degree`, `field_of_study`, `gpa`, `graduation_year`

**`saved_answers`** ← pre-written answers to common application questions
- `id`, `user_id`, `question`, `answer`
- Example questions: "Tell us about yourself", "Why are you interested in this role?", "Describe a challenge you overcame"
- Reused by extension for standard open-ended text prompts before falling back to LLM generation

**`star_responses`** ← STAR method prep responses, per company, reusable across applications
- `id`, `user_id`, `company_id` (nullable — some responses are general-purpose), `question`, `situation`, `task`, `action`, `result`, `full_response` (compiled text), `created_at`, `updated_at`
- Surfaced in the per-application Prep tab; used as few-shot context for extension open-ended LLM answers

**`push_subscriptions`** ← browser push subscription objects per user per device
- `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`
- Required by Web Push API to push notifications to a specific browser session; one row per device/browser the user has enabled push on

**`resume_versions`** ← versioned tailored resumes, separate from base resume
- `id`, `user_id`, `job_id`, `content_text`, `pdf_url`, `created_at`

**`match_scores`** ← lazy-computed, cached per user per job
- `id`, `user_id`, `job_id`, `score`, `rationale`, `computed_at`, `is_stale` (bool)
- UNIQUE constraint on `(user_id, job_id)` — upsert on conflict, never accumulate duplicates
- Marked stale when `users.resume_text` changes; recomputed on next view

**`cover_letters`** ← linked to application, not just job
- `id`, `user_id`, `application_id`, `template_type` (formal | casual | startup), `content`, `pdf_url` (nullable — generated when letter is finalized, used by extension for file attachment), `created_at`

**`company_profiles`**
- `id`, `name`, `description`, `glassdoor_rating` (nullable — populated via third-party API, not LLM), `headcount_range`, `funding_stage`, `behavioral_questions[]`, `technical_questions[]`, `last_updated`

**`sources`**
- `id`, `name`, `type` (github), `url`, `last_fetched_at`, `fetch_interval_minutes`

**`notification_log`**
- `id`, `user_id`, `job_id`, `channel` (email | push | sms), `sent_at`

**`api_keys`** ← user-scoped tokens for browser extension auth
- `id`, `user_id`, `key_hash`, `label`, `last_used_at`, `created_at`, `revoked_at`

### RLS Policy Summary

| Table | Authenticated Read | Write |
|---|---|---|
| `jobs` | All users | Service role only (aggregation worker + URL extractor API route) |
| `company_profiles` | All users | Service role only |
| `match_scores` | Own rows | Own rows (computed server-side on demand) |
| `applications` | Own rows | Own rows |
| `application_timeline` | Via application ownership | Via application ownership |
| `users` | Own row | Own row |
| `work_history` | Own rows | Own rows |
| `education` | Own rows | Own rows |
| `saved_answers` | Own rows | Own rows |
| `resume_versions` | Own rows | Own rows |
| `cover_letters` | Own rows | Own rows |
| `notification_log` | Own rows | Service role (dispatcher writes) |
| `api_keys` | Own rows | Own rows |
| `sources` | All users | Service role only |

---

## Auto-Fill Flow (End-to-End)

```
1. User sees a job in Backlog feed
2. Clicks "Auto-Apply"
   → ATS page opens in new tab (Greenhouse, Lever, Workday, etc.)
   → Extension content script activates, detects the form
3. Extension loads user's structured profile from cache (fetched on init)
4. Standard fields are filled via DOM manipulation (no LLM):
   - Name, email, phone, address
   - LinkedIn, GitHub, portfolio URLs
   - Work authorization / citizenship / visa
   - Work history entries (company, title, dates, description)
   - Education (school, degree, GPA, graduation year)
   - Skills, years of experience
5. Open-ended text fields trigger Claude Sonnet:
   - First checks saved_answers for a matching pre-written response
   - Falls back to LLM generation using profile + STAR responses as context
6. Resume and cover letter are attached to file upload fields
7. Extension popup shows a review panel — all filled fields visible, editable
8. User reviews, adjusts anything needed, then clicks the site's native Submit button
9. Extension detects navigation / submission event
   → Calls Backlog API → job status set to "Applied"
   → application_timeline row written
   → Toast in Backlog: "Marked as Applied"
```

**Workday note:** Workday uses Angular-rendered inputs that ignore direct `value` assignment. The extension must dispatch synthetic `InputEvent` and `change` events after setting values. This is doable but imperfect — Workday is supported on a best-effort basis.

---

## "Add Job from URL" Flow

```
User pastes URL into "Add Job from URL" input in Backlog
→ Backend detects URL format:
   Greenhouse (boards.greenhouse.io/*): hit public Greenhouse Jobs API → structured JSON
   Lever (jobs.lever.co/*):             hit public Lever Postings API → structured JSON
   Other:                               server-side HTML fetch → GPT-4o-mini extraction
   JS-rendered / fails:                 prompt: "Open this page in Chrome and click
                                         'Add to Backlog' in the extension"
→ Job normalized into jobs schema with source = 'manual'
→ Job appears in user's feed and can be auto-applied like any other job
```

Alternatively: on any job posting page, click the extension's "Add to Backlog" button. The content script extracts the JD from the already-rendered page (no server-side fetch needed) and sends it to the API.

---

## Access

Account creation is currently closed. Accounts are provisioned manually. If you're the admin, create your account directly in the Supabase dashboard and log in at the `/login` route.

---

## Development Setup

> Prerequisites: Node.js 18+, a Supabase project, OpenAI API key, Anthropic API key

```bash
git clone https://github.com/cs-keni/backlog.git
cd backlog
npm install
cp .env.example .env.local
# fill in your environment variables
npm run dev
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=

RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

GITHUB_TOKEN=

NEXT_PUBLIC_APP_URL=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

---

## Roadmap

See [PHASES.md](./PHASES.md) for the full development roadmap broken down into phases with task-level detail.

---

## License

Private. All rights reserved.
