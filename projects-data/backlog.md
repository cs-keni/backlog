# Backlog — Full-Stack Job Search Platform

## One-Line Pitch
Backlog is a full-stack job search platform built for new grad software engineers where applying early — within the first hours of a posting — is the highest-leverage action available, so the platform automates the entire pipeline from real-time job discovery to ATS form submission.

## Status
Live at [backlog-sand.vercel.app](https://backlog-sand.vercel.app) | GitHub: [cs-keni/backlog](https://github.com/cs-keni/backlog)

## Problem Statement
Most job trackers are passive boards you update manually. The core insight behind Backlog is that new grads who apply within the first 24–48 hours of a posting see meaningfully higher callback rates — not because the application is stronger, but because early applicants land in a shorter pile before screening volume peaks. No existing tool was built around that timing insight, and none automated the actual application submission step.

## What Was Built
A live end-to-end job search platform with five major systems: a real-time job aggregation engine, an AI match scoring and resume tailoring pipeline, a Chrome MV3 browser extension for ATS auto-fill, a force-directed company relationship graph, and a built-in DSA spaced repetition tracker — all in a single product used by new grad SWEs.

## Tech Stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Data / visualization:** Recharts, react-force-graph-2d, @dnd-kit/core, Tiptap
- **Backend / DB:** Supabase (PostgreSQL + Auth + Realtime)
- **AI:** Anthropic Claude Sonnet 4.6 (resume tailoring, ATS long-answer generation), Anthropic Claude Haiku (ATS short-field fill), OpenAI GPT-5 nano (job normalization batch pipeline)
- **Chrome Extension:** Manifest V3, content scripts, background service worker
- **Infrastructure:** Vercel (frontend), Render (aggregation worker / cron)
- **Testing:** Vitest, MSW (API mocking), Playwright (E2E)

## Features in Detail

### Real-Time Job Aggregation Engine
Polls SimplifyJobs and 30+ Greenhouse/Lever career portals on a 15-minute cron cycle hosted on Render. A deterministic pre-filter (no LLM cost) drops PhD-required, non-US, and senior-level roles based on title and description keyword heuristics. Surviving entries are normalized through GPT-5 nano in batches — extracting structured fields (company, role level, tech stack, compensation) from raw HTML. The result is a live feed that surfaces new grad roles within minutes of posting, with structured metadata that feeds the scoring system.

### Multi-Dimensional AI Match Scoring + Resume Tailoring
Every job card displays a 4-dimension fit score: role fit, tech stack alignment, experience level match, and compensation alignment. Scores are computed lazily (only on first view of a job card) via Claude Sonnet and cached in Supabase — so repeated page loads are instant and LLM cost is bounded. The resume tailoring pipeline lets a user select any job and generate a version of their resume with bullets rewritten to align to that specific JD, without touching the canonical base resume. Tailored versions are stored as versioned records in Supabase, tied to the job ID.

### Chrome MV3 Extension — ATS Auto-Fill Engine
A hybrid two-tier engine handles auto-fill on Greenhouse, Lever, and Workday forms. A deterministic regex FIELD_MAP handles ~80% of standard fields (name, email, phone, work auth, LinkedIn, GitHub) instantly at zero API cost. Unmapped fields trigger a single batched Claude Haiku call that receives all remaining field labels and user profile data, returning fill values for ~$0.0001 per page. Open-ended long-form questions (cover letter, "why us?", behavioral prompts) are handled by Claude Sonnet after first checking a library of saved pre-written responses — so commonly asked questions are answered for free after the first generation. The extension navigates multi-page forms, handles dropdown normalization, and works across all three major ATS platforms. Cost at heavy use: under $3/month.

### Force-Directed Company Relationship Graph
Built with react-force-graph-2d. Node color encodes application status (grey → applied → interviewed → offer/reject). Node size encodes the number of open roles at that company. Edges connect companies that share tech stack overlap, computed via Jaccard similarity on the normalized tech stack arrays in Supabase. ML, fintech, and consumer SaaS clusters emerge naturally from the data as the graph builds up over an active job search — a view no standard tracker provides.

### DSA Spaced Repetition Tracker
Covers all 150 NeetCode problems with SM-2-inspired review intervals. A Tailwind month-grid calendar visualizes upcoming review load so users can pace themselves. A bulk-backfill mode lets users log past solves at a custom date, automatically skipping review dates already in the past. Integrated directly in the Backlog dashboard — no context switch to Anki or a separate site.

## Measurable Outcomes / Impact
- Real-time feed surfaces new grad roles within ~15 minutes of posting across 30+ portals
- ATS auto-fill covers ~80% of fields at zero API cost, remainder at ~$0.0001/page
- Chrome extension works across Greenhouse, Lever, and Workday — the three dominant ATS platforms for tech hiring
- Resume tailoring produces job-specific bullet rewrites without touching the canonical base resume
- Full E2E test coverage via Playwright for the core apply flow

## Best For (Role Targeting)
This project is strongest when applying for:
- Full-stack SWE roles (demonstrates Next.js App Router, Supabase, TypeScript end-to-end)
- AI/LLM product engineering roles (multi-model orchestration, cost-aware prompt design, lazy evaluation + caching)
- Chrome extension / browser engineering roles (MV3, content scripts, background service worker)
- Roles at startups that ship fast and care about real user problems
- Any company where "AI-assisted workflows" or "developer tooling" is part of the pitch

## Talking Points for Interviews
- **Cost engineering:** Deliberately chose a 3-tier AI cost structure (free regex → $0.0001 Haiku → $0.002 Sonnet) to keep the extension under $3/month at heavy use — not just "we used AI"
- **Lazy evaluation pattern:** Scores are computed on-demand and cached in Supabase, not pre-computed for every job — keeps LLM cost proportional to actual user engagement
- **Baseline insight:** The entire product is built around one empirical insight about timing — everything else (aggregation speed, Chrome extension, match scoring) serves that thesis
- **Real tech stack normalization:** GPT-5 nano batch normalization converts raw job description text into structured arrays, enabling the Jaccard similarity graph — shows understanding of structured extraction vs generation
