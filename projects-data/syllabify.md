# Syllabify — AI-Powered Academic Study Scheduler

## One-Line Pitch
Syllabify turns any university syllabus — uploaded as a PDF or pasted as raw text — into a balanced, conflict-aware study schedule in seconds, then syncs directly to Google Calendar; built as a full-stack team project using React, Flask, GPT-5 nano, and a min-cost max-flow scheduling algorithm.

## Status
GitHub: [cs-keni/syllabify](https://github.com/cs-keni/syllabify) | Demo: [docs/demo.mp4](https://raw.githubusercontent.com/cs-keni/syllabify/main/docs/demo.mp4)

## Problem Statement
Students spend hours manually reading syllabi, copying due dates into calendars, and guessing how to distribute study time across a semester. Syllabify automates the entire pipeline: extract → review → schedule → sync. The key design insight is that scheduling should respect not just assignment deadlines but also the student's existing calendar events, class meeting times, and per-course workload caps.

## What Was Built
A full-stack web application where students upload a PDF or paste raw syllabus text, confirm the AI-extracted assignments in an inline review step, and receive a personalized week-by-week schedule they can sync directly to Google Calendar or export as an ICS feed. Built by a 4-person Scrum team using Jira for sprint planning and PR-based Git workflows.

## Tech Stack
- **Frontend:** React 18, Tailwind CSS, FullCalendar (schedule display), Vite
- **Backend:** Python / Flask, SQLAlchemy, PostgreSQL (Supabase), REST APIs
- **AI:** OpenAI GPT-5 nano (syllabus extraction) with a deterministic rule-based fallback
- **Auth:** JWT (access + refresh tokens), Google OAuth 2.0
- **Integrations:** Google Calendar API (OAuth import/export), ICS feed generation
- **Infrastructure:** Render (API), Vercel (frontend), Supabase (managed PostgreSQL), GitHub Actions (CI)

## Features in Detail

### AI Syllabus Parser with Deterministic Fallback
Two-tier parsing pipeline:
1. **Heuristic extraction (first pass):** A rule-based parser looks for common syllabus patterns — date-followed-by-assignment-name, "Due:", "Exam:", section headers like "Assignments" or "Schedule" — and extracts structured records with high confidence.
2. **GPT-5 nano (second pass):** The heuristic output is passed to GPT-5 nano as structured context, with instructions to fill in missing fields, resolve ambiguous dates, and normalize inconsistent formatting. GPT-5 nano is cheap enough ($0.0001/1K tokens) to run on every upload without meaningful cost.

Output: a structured list of `{assignment_name, due_date, estimated_hours, course}` records. If GPT-5 nano is unavailable or returns invalid JSON, the system falls back gracefully to the heuristic-only output.

The user sees all extracted records in an inline review step before scheduling — they can add, delete, or edit any item. This human-in-the-loop step was explicitly designed to prevent AI extraction errors from silently propagating into the schedule.

### Conflict-Aware Scheduling Engine
A min-cost max-flow-inspired scheduling algorithm that assigns study blocks to open calendar slots subject to:
- **Class meeting times:** imported from Google Calendar or manually entered — study blocks never overlap with class times
- **Existing Google Calendar events:** OAuth-imported events block out time slots before scheduling runs
- **Per-course weekly hour caps:** students set a maximum hours-per-week per course; the scheduler respects these caps as hard constraints
- **User work hour preferences:** configurable daily start time, end time, and maximum daily study hours
- **Deadline pressure:** assignments with nearer due dates receive higher priority in the flow allocation

The result is a schedule where study load is distributed across the week rather than front-loaded or clustered before deadlines.

### Google Calendar Integration — Full Bidirectional Sync
- **Import:** OAuth 2.0 flow imports existing calendar events as blocked time slots before scheduling
- **Export:** the generated schedule is written back to the student's Google Calendar as individual events, each tagged with the course name and assignment
- **ICS feed:** an ICS export is also available for students who use Apple Calendar, Outlook, or any other CalDAV-compatible client

### Inline Review Interface
Between parsing and scheduling, students see a table of every extracted assignment with editable fields. This step was included deliberately after early testing revealed that GPT sometimes misread ambiguous date formats ("10/11" could be October 11 or November 10 depending on the syllabus region) — the review step ensures the user confirms the input before the schedule is generated.

### Team Collaboration — Scrum with Jira
Built with a 4-person Scrum team. Workflow:
- Weekly sprints planned and tracked in Jira
- All features developed on feature branches, merged via pull request with at least one code review
- GitHub Actions CI ran linting (ESLint, flake8) and automated tests on every PR
- Google OAuth and JWT auth implemented with a shared auth middleware consumed by all API routes

## Measurable Outcomes / Impact
- Syllabus to structured assignment list in under 5 seconds
- Scheduling engine respects Google Calendar events, class times, weekly hour caps, and daily work preferences simultaneously
- Full bidirectional Google Calendar sync (import conflicts + export schedule)
- ICS export for non-Google calendar clients
- Delivered by a 4-person team on a Scrum cadence with PR-based review workflow and GitHub Actions CI

## Best For (Role Targeting)
- Full-stack SWE roles (React + Flask + PostgreSQL + external APIs)
- AI-augmented product roles (AI pipeline with human-in-the-loop review step)
- EdTech companies (any company building tools for students or academic institutions)
- Roles that mention "Python," "Flask," "REST APIs," "Google OAuth," or "calendar integrations"
- Roles where "team collaboration," "Scrum," or "Agile" is mentioned (demonstrates real team project experience)

## Talking Points for Interviews
- **Human-in-the-loop design:** The inline review step between parsing and scheduling is an explicit trust mechanism — AI errors are surfaced for correction before they affect the schedule. This is a design choice, not an afterthought.
- **Two-tier parser cost efficiency:** Heuristic-first, LLM-second means the LLM only processes records the heuristic couldn't resolve confidently — reducing cost and latency compared to sending the raw PDF directly to GPT
- **Min-cost max-flow scheduling:** Scheduling with multiple simultaneous hard constraints (class times, existing events, per-course caps, daily hours) is a constraint satisfaction problem — framing it as a flow optimization gives it a principled structure, not just a greedy loop
- **Bidirectional calendar sync:** Most calendar integrations are one-directional exports. Importing existing events as blocking constraints before scheduling is the key design that makes the schedule actually usable
- **Team project with real workflow:** Jira sprint planning, PR review, GitHub Actions CI, and feature branches — not a solo project pushed to GitHub at the end, but an actual iterative team delivery
