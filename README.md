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
- LLM-powered resume match score (0–100%) on every card with a short rationale

### Smart Filters
- Location, remote/hybrid/on-site, salary range, experience level, role type
- Saved filter presets so your default view is always ready

### Application Tracker
- Kanban board with drag-and-drop stages: `Saved → Applied → Phone Screen → Technical → Final Round → Offer / Rejected`
- Per-application notes, recruiter contacts, timeline of status changes
- Follow-up nudges when applications go stale

### Resume & Profile
- Upload your resume as a PDF — text is extracted and stored in your profile
- Structured profile: work history, education, skills, work authorization, salary expectations
- "Tailor for this job" — LLM rewrites your resume bullets to align with a specific JD, saved as a separate versioned PDF

### Cover Letter Generator
- Optional cover letter per application, triggered on demand
- Three templates: `formal`, `casual`, `startup-focused` — LLM picks the best fit based on company tone
- Inline editor to review, edit, and save before attaching

### Company Intelligence
- Company description, headcount, funding stage, Glassdoor rating on every job detail page
- Behavioral and technical questions the company is known to ask

### Interview Prep
- Per-application prep tab with company-specific questions
- STAR method response builder — paste a behavioral question, Claude drafts a structured answer using your profile and resume as context, you edit and save
- Saved responses reusable across similar applications

### Browser Extension (Chrome / Firefox)
- Connects to your Backlog account via a secure API key
- Detects job application forms on external sites (Greenhouse, Lever, Workday, iCIMS, and more)
- LLM maps every form field to your structured profile and generates answers for open-ended questions
- Attaches your tailored resume and cover letter automatically
- You review the filled form before submitting — nothing goes out without your approval
- On submit, Backlog auto-marks the job as Applied in your tracker

### Alerts & Notifications
- Email, browser push, and SMS alerts when a high-match job drops
- Configurable thresholds: match score, role type, location, salary floor
- Quiet hours support

### Analytics
- Jobs posted today, weekly trends, 7-day rolling averages
- Application activity charts: weekly / monthly / yearly
- Application funnel: how many roles at each stage
- Response rate, time-to-first-response distribution

### Export
- CSV export of your full application history
- Google Sheets sync via OAuth

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), Tailwind CSS, Framer Motion |
| Database | Supabase (PostgreSQL + real-time subscriptions + auth) |
| Background Workers | Node.js on Render (job aggregation cron jobs) |
| LLM — Normalization | GPT-4o-mini (OpenAI) |
| LLM — Writing & Reasoning | Claude Sonnet 4.6 (Anthropic) |
| Notifications | Resend (email), Web Push API (browser), Twilio (SMS) |
| PDF Parsing | pdf-parse |
| Charts | Recharts |
| Hosting | Vercel (frontend) + Render (workers) |
| Browser Extension | Chrome Manifest V3 + Firefox MV2 compatibility |

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
│  jobs · applications · users · cover_letters             │
│  company_profiles · sources · notification_log           │
│  Real-time subscriptions for live feed updates           │
└──────────┬────────────────────────────┬──────────────────┘
           │ writes                     │ reads
┌──────────▼────────────┐   ┌──────────▼──────────────────┐
│  Aggregation Worker   │   │    Browser Extension        │
│  (Render cron)        │   │    (Chrome / Firefox)       │
│  GitHub API →         │   │    Reads external ATS forms │
│  GPT-4o-mini          │   │    LLM maps fields →        │
│  normalize → DB       │   │    fills → user reviews →   │
│  trigger alerts       │   │    submit → update tracker  │
└───────────────────────┘   └─────────────────────────────┘
```

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
```

---

## Roadmap

See [PHASES.md](./PHASES.md) for the full development roadmap broken down into phases with task-level detail.

---

## License

Private. All rights reserved.
