# Backlog — Wave 3 Plan: Outcome Engine

**Generated:** 2026-05-21
**Mode:** SCOPE EXPANSION
**CEO plan:** `~/.gstack/projects/cs-keni-backlog/ceo-plans/2026-05-21-backlog-wave3.md`

---

## Codex Quick-Start

**All phases in this plan are Codex-owned.** No Claude Code reservation.

1. Read this file top to bottom before writing any code.
2. Start with **P6** and **P8** — they're read-only UI work with zero migration risk.
3. Apply migrations in Supabase **before** implementing the feature that depends on them.
4. Run checks after each phase:
   ```bash
   node node_modules/typescript/bin/tsc --noEmit
   node node_modules/vitest/vitest.mjs run
   ```
5. Update `docs/HANDOFF.md` and `docs/ENGINEERING_LOG.md` after each phase.

---

## Execution Order

Ship phases in order. Each phase is independently deployable.

| Phase | Description | Risk |
|-------|-------------|------|
| **P6** | Application packet checklist | Low — read-only, no migration |
| **P8** | Company reuse banner | Low — read-only query |
| **P1** | Resume tailor UI | Low — backend exists, verify contract first |
| **P7** | Job freshness badge | Low — display only, `jobs.fetched_at` exists |
| **P4** | Source yield feedback loop | Low — bySource already computed |
| **P2** | Per-ATS completeness score | Med — new migration + pattern-match logic |
| **P5** | Negative relevance feedback | Med — new table + filter logic |
| **P0** | ATS keyword gap analysis | High — LLM call + cache table + invalidation |
| **P3** | Salary negotiation playbook | High — LLM call + static comp bands + new column |

---

## P6 — Application Packet Checklist

**Description:** Show completion badges in ApplicationDetail for the items that make a strong application. Derives from existing data — no new columns, no migration.

**File:** `src/components/tracker/ApplicationDetail.tsx` (or a new `ApplicationChecklist.tsx` sub-component)

**Checklist items and their data sources:**

| Item | Data check |
|------|-----------|
| Resume on file | `users.resume_text IS NOT NULL AND LENGTH > 0` |
| Cover letter added | `applications.cover_letter IS NOT NULL` (if column exists, else skip) |
| Interview kit generated | `interview_kits.application_id = app.id` (join or separate fetch) |
| Applied date logged | `applications.applied_at IS NOT NULL` |
| Referral contact | `applications.referral_contact IS NOT NULL` (if column exists, else skip) |

**UI shape:**
```tsx
// ApplicationChecklist.tsx
interface ChecklistItem { label: string; done: boolean }

function ApplicationChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter(i => i.done).length
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Application Packet
        </h4>
        <span className="text-[11px] text-zinc-500">{done}/{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span
            key={item.label}
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              item.done
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-zinc-800 text-zinc-500'
            )}
          >
            {item.done ? '✓ ' : ''}{item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Data fetching:** The ApplicationDetail component already fetches the application row. Add a parallel fetch for `interview_kits` keyed on `application_id`. Derive checklist from prop data — no new API route needed.

**Tests:** Snapshot or unit test the checklist derivation logic (pure function mapping app data → `ChecklistItem[]`).

---

## P8 — Company Reuse Banner

**Description:** In ApplicationDetail, if the user has applied to the same company before, show a banner linking to past applications.

**File:** `src/components/tracker/ApplicationDetail.tsx`

**Query shape:**
```ts
// Inside ApplicationDetail data fetch (server component or useEffect)
const { data: priorApps } = await supabase
  .from('applications')
  .select('id, jobs(title), applied_at, status')
  .eq('user_id', user.id)
  .eq('jobs.company', currentJob.company)  // filter via join
  .neq('id', currentApplicationId)         // exclude current
  .order('applied_at', { ascending: false })
  .limit(3)
```

If `priorApps.length > 0`, render above the main content:
```tsx
<div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-300">
  You've applied to {currentJob.company} {priorApps.length}x before.{' '}
  <button className="underline" onClick={() => /* open prior apps */}>
    View past applications →
  </button>
</div>
```

**No new tables.** Read-only query only.

---

## P1 — Resume Tailor UI

**Description:** Wire `POST /api/resume/tailor` into ApplicationDetail. The backend (`src/lib/llm/resume-tailor.ts`, `src/app/api/resume/tailor/route.ts`) is fully implemented.

**Pre-condition — verify contract before wiring:**
Before writing UI code, read `src/app/api/resume/tailor/route.ts` and confirm:
- Request body shape: `{ application_id: string }`
- Response: streaming JSON or plain text? Check the Content-Type header.
- Auth: uses `createClient()` session-based auth (same as all other routes).
- Error states: what does a non-200 look like?

The route returns a PDF or structured JSON response (check the implementation). If it returns a PDF blob, the UI flow is "download" not "stream inline". Adapt accordingly.

**UI shape (assumes JSON response with `summary` + `work_experience` array):**
```tsx
// In ApplicationDetail, inside the prep section
function ResumeTailor({ applicationId }: { applicationId: string }) {
  const [result, setResult] = useState<TailoredResume | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function tailor() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/resume/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      })
      if (!res.ok) throw new Error('Failed')
      setResult(await res.json())
    } catch {
      setError('Could not tailor resume')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Resume Tailor
        </h3>
        <button
          onClick={tailor}
          disabled={loading}
          className="rounded-md border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
        >
          {loading ? 'Tailoring…' : result ? 'Re-tailor' : 'Tailor Resume'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {result && <TailoredResumeDisplay result={result} />}
    </div>
  )
}
```

If the route returns a PDF blob, change the button to trigger a download instead of inline display.

**Tests:** Integration test for `POST /api/resume/tailor` — 401 for unauthed, 404 for app not owned by user, 200 with correct Content-Type otherwise. Mirror the pattern in `src/tests/integration/interview-kit.test.ts`.

---

## P7 — Job Freshness Badge

**Description:** Show how old a job posting is using `jobs.fetched_at`. Display in the Feed job card and ApplicationDetail.

**Scope:** Freshness badge only — based on `jobs.fetched_at`. The background HTTP liveness checker (checking if URLs are still alive) is deferred to TODOS.md due to rate-limit and infrastructure complexity.

**Utility function:**
```ts
// src/lib/tracker/freshness.ts
export function freshnessLabel(fetchedAt: string | null): string | null {
  if (!fetchedAt) return null
  const days = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 86_400_000)
  if (days <= 1) return 'Posted today'
  if (days <= 7) return `Posted ${days}d ago`
  if (days <= 30) return `Posted ${Math.floor(days / 7)}w ago`
  return `Posted ${Math.floor(days / 30)}mo ago`
}

export function freshnessColor(fetchedAt: string | null): 'green' | 'yellow' | 'red' | null {
  if (!fetchedAt) return null
  const days = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 86_400_000)
  if (days <= 7) return 'green'
  if (days <= 21) return 'yellow'
  return 'red'
}
```

**Usage in JobCard:**
```tsx
// src/components/feed/JobCard.tsx
{job.fetched_at && (
  <span className={cn('text-[10px]', {
    'text-emerald-500': freshnessColor(job.fetched_at) === 'green',
    'text-amber-500': freshnessColor(job.fetched_at) === 'yellow',
    'text-red-500': freshnessColor(job.fetched_at) === 'red',
  })}>
    {freshnessLabel(job.fetched_at)}
  </span>
)}
```

**Tests:** Unit test `freshnessLabel` and `freshnessColor` with known timestamps.

---

## P4 — Source Yield Feedback Loop

**Description:** Display per-source conversion rates in the Analytics/Discovery tab and let users pin or hide sources.

**What's already built:** `bySource` is computed in `src/lib/analytics/conversion.ts`.

**Migration:** None needed. Source preferences stored as JSONB on `users`.

**Migration 030:**
```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS source_preferences jsonb NOT NULL DEFAULT '{}';
```

**API route — `PUT /api/user/source-preferences`:**
```ts
// src/app/api/user/source-preferences/route.ts
export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // body: { source: string, action: 'pin' | 'hide' | 'reset' }
  if (typeof body.source !== 'string' || !['pin', 'hide', 'reset'].includes(body.action)) {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Fetch current prefs, update, upsert
  const { data: current } = await supabase
    .from('users')
    .select('source_preferences')
    .eq('id', user.id)
    .single()

  const prefs = (current?.source_preferences ?? {}) as Record<string, string>
  if (body.action === 'reset') {
    delete prefs[body.source]
  } else {
    prefs[body.source] = body.action
  }

  await supabase.from('users').update({ source_preferences: prefs }).eq('id', user.id)
  return Response.json({ ok: true })
}
```

**UI changes in Analytics tab:**
- Extend the existing `bySource` table to show conversion % per source.
- Add a pin/hide toggle per row (☆ pin, ✕ hide).
- Hidden sources are excluded from the Feed job list query (pass `hiddenSources` to the job fetch as `NOT IN` clause).

**Tests:** Unit test the preference merge logic. Integration test the PUT route (401, 400 invalid action, 200 success).

---

## P2 — Per-ATS Completeness Score

**Description:** For each application, show what % of required fields the target ATS needs.

### Migration 031

```sql
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ats_platform text;

-- Valid values: 'greenhouse', 'workday', 'lever', 'ashby', 'icims', 'taleo', 'unknown', null
-- null = not yet detected; 'unknown' = detected but pattern unrecognized
```

**Do not backfill existing rows.** Existing applications get `NULL`, which means the completeness UI is hidden. New applications get `ats_platform` set on insert via the pattern-match below.

### Platform detection

```ts
// src/lib/tracker/ats-platform.ts
const ATS_PATTERNS: Array<[RegExp, string]> = [
  [/greenhouse\.io/i, 'greenhouse'],
  [/myworkdayjobs\.com/i, 'workday'],
  [/lever\.co/i, 'lever'],
  [/ashbyhq\.com/i, 'ashby'],
  [/icims\.com/i, 'icims'],
  [/taleo\.net/i, 'taleo'],
  [/jobvite\.com/i, 'jobvite'],
  [/smartrecruiters\.com/i, 'smartrecruiters'],
]

export function detectAtsPlatform(careersUrl: string | null | undefined): string | null {
  if (!careersUrl) return null
  for (const [pattern, name] of ATS_PATTERNS) {
    if (pattern.test(careersUrl)) return name
  }
  return 'unknown'  // URL present but no pattern matched
}
```

**Fallback behavior:**
- `ats_platform = null` → completeness section not rendered
- `ats_platform = 'unknown'` → completeness section not rendered, but show manual platform picker
- `ats_platform = known_value` → render completeness score

**Manual override:** In ApplicationDetail, add a small "Set ATS Platform" link that opens a dropdown (`greenhouse | workday | lever | ashby | other`) and PUTs to a new route `PUT /api/applications/[id]/ats-platform`.

### Required fields per ATS

```ts
// src/lib/tracker/ats-fields.ts
interface AtsFieldSpec { label: string; dataKey: keyof UserProfile }

const ATS_REQUIRED_FIELDS: Record<string, AtsFieldSpec[]> = {
  greenhouse: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Resume', dataKey: 'resume_text' },
    { label: 'LinkedIn URL', dataKey: 'linkedin_url' },
    { label: 'Work authorization', dataKey: 'work_authorization' },
  ],
  workday: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Street address', dataKey: 'street_address' },
    { label: 'Phone number', dataKey: 'phone' },
    { label: 'Resume', dataKey: 'resume_text' },
    { label: 'Work authorization', dataKey: 'work_authorization' },
  ],
  lever: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Resume', dataKey: 'resume_text' },
    { label: 'LinkedIn URL', dataKey: 'linkedin_url' },
  ],
  ashby: [
    { label: 'Full name', dataKey: 'full_name' },
    { label: 'Email', dataKey: 'email' },
    { label: 'Resume', dataKey: 'resume_text' },
  ],
}

// Add columns to users table as needed (see migration 032 below)
```

### Migration 032 — add missing profile fields

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS work_authorization text;
```

### Completeness computation

```ts
export function computeAtsCompleteness(
  platform: string,
  profile: UserProfile
): { score: number; missing: string[] } {
  const fields = ATS_REQUIRED_FIELDS[platform] ?? []
  if (fields.length === 0) return { score: 100, missing: [] }
  const missing = fields.filter(f => !profile[f.dataKey]).map(f => f.label)
  const score = Math.round(((fields.length - missing.length) / fields.length) * 100)
  return { score, missing }
}
```

**UI:** Render a completion ring (SVG circle) with the percentage and a "Missing: street_address, phone" callout. Only render when `ats_platform` is a known value.

**Tests:** Unit test `computeAtsCompleteness` for each platform. Test that `null` and `'unknown'` produce no render.

---

## P5 — Negative Relevance Feedback

**Description:** When a user dismisses a job, prompt for a reason. Store reasons. Apply soft filters once enough signals accumulate.

### Migration 033

```sql
CREATE TABLE IF NOT EXISTS public.job_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('not_my_level', 'too_far', 'wrong_stack', 'company_culture', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS job_feedback_user_id_idx ON public.job_feedback(user_id);

ALTER TABLE public.job_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own feedback" ON public.job_feedback
  FOR ALL USING (auth.uid() = user_id);
```

### Dismiss flow in Feed

When a user dismisses a job (e.g., clicks an ✕ button), show a reason picker:

```tsx
const DISMISS_REASONS = [
  { value: 'not_my_level', label: 'Not my level' },
  { value: 'too_far', label: 'Too far' },
  { value: 'wrong_stack', label: 'Wrong stack' },
  { value: 'company_culture', label: 'Company culture' },
  { value: 'other', label: 'Other' },
]
```

POST to `/api/jobs/feedback`:
```ts
// src/app/api/jobs/feedback/route.ts
export async function POST(request: Request) {
  // auth check, then:
  await supabase.from('job_feedback').upsert(
    { user_id: user.id, job_id: body.job_id, reason: body.reason },
    { onConflict: 'user_id,job_id' }
  )
  return Response.json({ ok: true })
}
```

### Soft filter activation

**Threshold: N ≥ 5 dismissals with the same reason before any filter activates.**

```ts
// src/lib/feed/feedback-filters.ts
export async function getActiveFeedbackFilters(userId: string, supabase: SupabaseClient) {
  const { data } = await supabase
    .from('job_feedback')
    .select('reason')
    .eq('user_id', userId)

  const counts = (data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.reason] = (acc[row.reason] ?? 0) + 1
    return acc
  }, {})

  return {
    excludeTooFar: (counts['too_far'] ?? 0) >= 5,
    excludeWrongStack: (counts['wrong_stack'] ?? 0) >= 5,
    // not_my_level and company_culture are soft signals only — logged but not filtered
  }
}
```

**UI nudge when < 5 signals:** Show beneath the dismiss confirmation: "Learning your preferences (X/5 signals)." Hide once threshold is reached.

**Tests:** Unit test `getActiveFeedbackFilters` with counts below and above threshold. Integration test the POST route.

---

## P0 — ATS Keyword Gap Analysis

**Description:** Show which keywords from the job description are absent from the user's resume. Cached per application. Invalidated on resume update.

### Migration 034

```sql
CREATE TABLE IF NOT EXISTS public.keyword_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gaps jsonb NOT NULL,  -- { skills: string[], tools: string[], verbs: string[] }
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, user_id)
);

ALTER TABLE public.keyword_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own gaps" ON public.keyword_gaps
  FOR ALL USING (auth.uid() = user_id);
```

### Prompt shape

The LLM call returns JSON directly — one call, no separate categorization step:

```ts
// src/lib/llm/keyword-gap.ts
export function buildKeywordGapPrompt(resumeText: string, jobDescription: string): string {
  return `You are an ATS keyword analyst.

Compare the resume and job description below. Return a JSON object listing keywords present in the job description but absent from the resume, grouped by category.

Resume:
${resumeText.slice(0, 3000)}

Job Description:
${jobDescription.slice(0, 2000)}

Return ONLY valid JSON in this exact shape (no markdown, no explanation):
{
  "skills": ["skill1", "skill2"],
  "tools": ["tool1", "tool2"],
  "verbs": ["verb1", "verb2"]
}

Rules:
- skills: technical competencies (languages, frameworks, methodologies)
- tools: named products or platforms (e.g. "Kubernetes", "Datadog", "Salesforce")
- verbs: action verbs the JD emphasizes that are absent from the resume (e.g. "architected", "scaled", "owned")
- Only include terms that appear in the JD but NOT in the resume
- Omit generic words ("experience", "team", "strong")
- Return at most 8 items per category
- If a category has no gaps, return an empty array`
}
```

### Cache invalidation

Two triggers:
1. **Application deleted:** CASCADE from `applications` table handles this.
2. **Resume updated:** In the profile update route (`PUT /api/user/profile` or wherever `resume_text` is written), add:
   ```ts
   // After updating users.resume_text, delete all cached gaps for this user
   await supabase
     .from('keyword_gaps')
     .delete()
     .eq('user_id', user.id)
   ```
3. **Manual refresh:** The UI includes a "Refresh" button that calls the generate endpoint again (the route handles upsert, so re-calling it overwrites the cache).

### API route

```ts
// src/app/api/prep/keyword-gap/route.ts
export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildKeywordGapPrompt } from '@/lib/llm/keyword-gap'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(request: Request) {
  // Returns cached gap for application_id (query param), or null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (typeof body.application_id !== 'string') {
    return Response.json({ error: 'application_id required' }, { status: 400 })
  }

  // Fetch app (ownership check) + user resume + job description in parallel
  const [appResult, profileResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, jobs(description)')
      .eq('id', body.application_id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('users')
      .select('resume_text')
      .eq('id', user.id)
      .single(),
  ])

  if (!appResult.data) return Response.json({ error: 'Application not found' }, { status: 404 })

  const jobDescription = (appResult.data.jobs as any)?.description
  const resumeText = profileResult.data?.resume_text

  if (!jobDescription || !resumeText) {
    return Response.json({ error: 'Resume or job description missing' }, { status: 422 })
  }

  const prompt = buildKeywordGapPrompt(resumeText, jobDescription)

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',  // Haiku: fast + cheap for JSON extraction
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  let gaps: { skills: string[]; tools: string[]; verbs: string[] }
  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
    gaps = JSON.parse(text)
  } catch {
    return Response.json({ error: 'Failed to parse LLM response' }, { status: 500 })
  }

  const { data, error } = await supabase
    .from('keyword_gaps')
    .upsert(
      { application_id: body.application_id, user_id: user.id, gaps, generated_at: new Date().toISOString() },
      { onConflict: 'application_id,user_id' }
    )
    .select('id, gaps, generated_at')
    .single()

  if (error) return Response.json({ error: 'Failed to save gap analysis' }, { status: 500 })
  return Response.json(data)
}
```

### UI — KeywordGap component

```tsx
// src/components/tracker/KeywordGap.tsx
interface GapData {
  skills: string[]
  tools: string[]
  verbs: string[]
}

function GapSection({ label, terms }: { label: string; terms: string[] }) {
  if (terms.length === 0) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {terms.map(term => (
          <span key={term} className="rounded-full bg-red-950/40 px-2 py-0.5 text-[11px] text-red-400">
            {term}
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Tests:** Unit test `buildKeywordGapPrompt`. Integration test the route (401, 422 missing resume, 200 cached result).

---

## P3 — Salary Negotiation Playbook

**Description:** When an application reaches `offer` status, surface a negotiation brief with market range, comp target, and 3 LLM-generated scripts.

### Migration 035

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS comp_target integer;  -- annual USD, user-set

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS comp_location_tier text DEFAULT 'tier1'
  CHECK (comp_location_tier IN ('tier1', 'tier2', 'tier3', 'remote'));
```

### Static comp bands

Stored in `src/lib/salary/comp-bands.ts`. Updated quarterly via code PR. No external API dependency.

```ts
// src/lib/salary/comp-bands.ts
// Annual total comp bands (base + RSU) in USD, 2026 Q2
// Tier 1: SF/NYC/Seattle. Tier 2: Austin/Denver/Boston/Chicago. Tier 3: everywhere else.

interface CompBand { p25: number; p50: number; p75: number }

type LocationTier = 'tier1' | 'tier2' | 'tier3' | 'remote'
type RoleBucket =
  | 'swe_ic3' | 'swe_ic4' | 'swe_ic5' | 'swe_ic6'
  | 'swe_staff' | 'swe_principal'
  | 'em_l5' | 'em_l6' | 'em_director'
  | 'pm_ic4' | 'pm_ic5' | 'pm_staff'
  | 'ds_ic4' | 'ds_ic5'
  | 'design_ic4' | 'design_ic5'
  | 'default'

export const COMP_BANDS: Record<LocationTier, Record<RoleBucket, CompBand>> = {
  tier1: {
    swe_ic3: { p25: 160_000, p50: 190_000, p75: 230_000 },
    swe_ic4: { p25: 210_000, p50: 260_000, p75: 320_000 },
    swe_ic5: { p25: 280_000, p50: 360_000, p75: 450_000 },
    swe_ic6: { p25: 380_000, p50: 500_000, p75: 650_000 },
    swe_staff: { p25: 350_000, p50: 450_000, p75: 600_000 },
    swe_principal: { p25: 500_000, p50: 650_000, p75: 900_000 },
    em_l5: { p25: 250_000, p50: 320_000, p75: 400_000 },
    em_l6: { p25: 330_000, p50: 420_000, p75: 550_000 },
    em_director: { p25: 400_000, p50: 550_000, p75: 750_000 },
    pm_ic4: { p25: 180_000, p50: 230_000, p75: 290_000 },
    pm_ic5: { p25: 240_000, p50: 310_000, p75: 400_000 },
    pm_staff: { p25: 310_000, p50: 400_000, p75: 520_000 },
    ds_ic4: { p25: 170_000, p50: 220_000, p75: 280_000 },
    ds_ic5: { p25: 240_000, p50: 310_000, p75: 400_000 },
    design_ic4: { p25: 160_000, p50: 210_000, p75: 270_000 },
    design_ic5: { p25: 220_000, p50: 290_000, p75: 380_000 },
    default: { p25: 130_000, p50: 170_000, p75: 230_000 },
  },
  tier2: {
    // ~80% of tier1 bands
    swe_ic3: { p25: 128_000, p50: 152_000, p75: 184_000 },
    swe_ic4: { p25: 168_000, p50: 208_000, p75: 256_000 },
    swe_ic5: { p25: 224_000, p50: 288_000, p75: 360_000 },
    swe_ic6: { p25: 304_000, p50: 400_000, p75: 520_000 },
    swe_staff: { p25: 280_000, p50: 360_000, p75: 480_000 },
    swe_principal: { p25: 400_000, p50: 520_000, p75: 720_000 },
    em_l5: { p25: 200_000, p50: 256_000, p75: 320_000 },
    em_l6: { p25: 264_000, p50: 336_000, p75: 440_000 },
    em_director: { p25: 320_000, p50: 440_000, p75: 600_000 },
    pm_ic4: { p25: 144_000, p50: 184_000, p75: 232_000 },
    pm_ic5: { p25: 192_000, p50: 248_000, p75: 320_000 },
    pm_staff: { p25: 248_000, p50: 320_000, p75: 416_000 },
    ds_ic4: { p25: 136_000, p50: 176_000, p75: 224_000 },
    ds_ic5: { p25: 192_000, p50: 248_000, p75: 320_000 },
    design_ic4: { p25: 128_000, p50: 168_000, p75: 216_000 },
    design_ic5: { p25: 176_000, p50: 232_000, p75: 304_000 },
    default: { p25: 104_000, p50: 136_000, p75: 184_000 },
  },
  tier3: {
    // ~65% of tier1 bands
    swe_ic3: { p25: 104_000, p50: 124_000, p75: 150_000 },
    swe_ic4: { p25: 137_000, p50: 169_000, p75: 208_000 },
    swe_ic5: { p25: 182_000, p50: 234_000, p75: 293_000 },
    swe_ic6: { p25: 247_000, p50: 325_000, p75: 423_000 },
    swe_staff: { p25: 228_000, p50: 293_000, p75: 390_000 },
    swe_principal: { p25: 325_000, p50: 423_000, p75: 585_000 },
    em_l5: { p25: 163_000, p50: 208_000, p75: 260_000 },
    em_l6: { p25: 215_000, p50: 273_000, p75: 358_000 },
    em_director: { p25: 260_000, p50: 358_000, p75: 488_000 },
    pm_ic4: { p25: 117_000, p50: 150_000, p75: 189_000 },
    pm_ic5: { p25: 156_000, p50: 202_000, p75: 260_000 },
    pm_staff: { p25: 202_000, p50: 260_000, p75: 338_000 },
    ds_ic4: { p25: 111_000, p50: 143_000, p75: 182_000 },
    ds_ic5: { p25: 156_000, p50: 202_000, p75: 260_000 },
    design_ic4: { p25: 104_000, p50: 137_000, p75: 176_000 },
    design_ic5: { p25: 143_000, p50: 189_000, p75: 247_000 },
    default: { p25: 85_000, p50: 111_000, p75: 150_000 },
  },
  remote: {
    // Same as tier2 for remote roles
    swe_ic3: { p25: 128_000, p50: 152_000, p75: 184_000 },
    swe_ic4: { p25: 168_000, p50: 208_000, p75: 256_000 },
    swe_ic5: { p25: 224_000, p50: 288_000, p75: 360_000 },
    swe_ic6: { p25: 304_000, p50: 400_000, p75: 520_000 },
    swe_staff: { p25: 280_000, p50: 360_000, p75: 480_000 },
    swe_principal: { p25: 400_000, p50: 520_000, p75: 720_000 },
    em_l5: { p25: 200_000, p50: 256_000, p75: 320_000 },
    em_l6: { p25: 264_000, p50: 336_000, p75: 440_000 },
    em_director: { p25: 320_000, p50: 440_000, p75: 600_000 },
    pm_ic4: { p25: 144_000, p50: 184_000, p75: 232_000 },
    pm_ic5: { p25: 192_000, p50: 248_000, p75: 320_000 },
    pm_staff: { p25: 248_000, p50: 320_000, p75: 416_000 },
    ds_ic4: { p25: 136_000, p50: 176_000, p75: 224_000 },
    ds_ic5: { p25: 192_000, p50: 248_000, p75: 320_000 },
    design_ic4: { p25: 128_000, p50: 168_000, p75: 216_000 },
    design_ic5: { p25: 176_000, p50: 232_000, p75: 304_000 },
    default: { p25: 104_000, p50: 136_000, p75: 184_000 },
  },
}

export function lookupCompBand(roleTitle: string, locationTier: LocationTier): CompBand {
  const titleLower = roleTitle.toLowerCase()
  let bucket: RoleBucket = 'default'

  if (/principal|distinguished/i.test(titleLower)) {
    bucket = titleLower.includes('engineer') ? 'swe_principal' : 'default'
  } else if (/staff/i.test(titleLower)) {
    bucket = titleLower.includes('engineer') || titleLower.includes('swe') ? 'swe_staff' :
             titleLower.includes('pm') || titleLower.includes('product') ? 'pm_staff' : 'default'
  } else if (/director/i.test(titleLower)) {
    bucket = 'em_director'
  } else if (/engineering manager|eng manager/i.test(titleLower)) {
    bucket = 'em_l5'
  } else if (/senior|sr\.?\s/i.test(titleLower)) {
    bucket = titleLower.includes('engineer') || titleLower.includes('swe') ? 'swe_ic5' :
             titleLower.includes('pm') || titleLower.includes('product') ? 'pm_ic5' :
             titleLower.includes('data') ? 'ds_ic5' :
             titleLower.includes('design') ? 'design_ic5' : 'default'
  } else if (/engineer|swe|dev|developer/i.test(titleLower)) {
    bucket = 'swe_ic4'
  } else if (/product manager|pm/i.test(titleLower)) {
    bucket = 'pm_ic4'
  } else if (/data scientist|data science/i.test(titleLower)) {
    bucket = 'ds_ic4'
  } else if (/design|ux|ui/i.test(titleLower)) {
    bucket = 'design_ic4'
  }

  return COMP_BANDS[locationTier][bucket]
}
```

### Negotiation playbook route

```ts
// src/app/api/prep/salary-playbook/route.ts
export const maxDuration = 45

// GET: return cached playbook for application_id (if user.comp_target set and status = offer)
// POST: generate + stream 3 negotiation scripts
```

**Only render the Salary Playbook section in ApplicationDetail when `application.status === 'offer'`.**

**Tests:** Unit test `lookupCompBand` for each major role bucket. Integration test the route (401, 422 when status is not offer, 200 stream).

---

## Deferred to TODOS.md

```markdown
## DEFERRED — Wave 3 deferred items

- **P7 HTTP liveness checker**: Background worker that periodically re-checks saved job URLs
  for 404/dead links. Deferred due to rate-limit and per-domain throttle complexity.
  Prerequisite: define a job queue infrastructure (pgmq, Inngest, etc.) first.

- **Warm referral radar**: Surface mutual connections to target companies.
  Blocked: no viable LinkedIn data API. Revisit when a data source exists.

- **Auto-apply queue**: Automatically submit to ATS portals.
  Blocked: needs P0 (keyword gap), P2 (ATS completeness), and callback rate data
  from P4 (source yield) before value can be validated.
```

---

## Test Coverage Summary

Each phase should add:

| Phase | Tests |
|-------|-------|
| P6 | Unit: checklist derivation logic |
| P8 | Integration: prior apps query returns correct results |
| P1 | Integration: POST /api/resume/tailor (401, 404, 200) |
| P7 | Unit: freshnessLabel, freshnessColor |
| P4 | Unit: pref merge logic. Integration: PUT /api/user/source-preferences |
| P2 | Unit: computeAtsCompleteness, detectAtsPlatform. Integration: PUT ats-platform |
| P5 | Unit: getActiveFeedbackFilters threshold. Integration: POST /api/jobs/feedback |
| P0 | Unit: buildKeywordGapPrompt. Integration: GET/POST /api/prep/keyword-gap |
| P3 | Unit: lookupCompBand all buckets. Integration: POST /api/prep/salary-playbook |
