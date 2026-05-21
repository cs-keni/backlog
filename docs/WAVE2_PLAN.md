# Backlog Co-Pilot — Wave 2 Plan

**Generated:** 2026-05-21  
**Mode:** SCOPE EXPANSION  
**Score going in:** 77/100 (B+)  
**Target:** ~88/100 (A-)  
**Full CEO plan:** `~/.gstack/projects/cs-keni-backlog/ceo-plans/2026-05-21-backlog-co-pilot-wave2.md`

---

## Codex Quick-Start

**All phases in this plan are Codex-owned.** No Claude Code reservation.

1. Read this file top to bottom before writing any code.
2. Start with **P0** — the bugs block trust in the app.
3. Each phase section has: exact file paths, code shapes, migration SQL, and test specs.
4. Apply migrations in Supabase **before** implementing the feature that depends on them.
5. Run checks after each phase:
   ```bash
   node node_modules/typescript/bin/tsc --noEmit
   node node_modules/vitest/vitest.mjs run <test-file>
   ```
6. Update `docs/HANDOFF.md` and `docs/ENGINEERING_LOG.md` after each phase.

---

## Execution Order

Ship phases in order. Each phase is independently deployable.

| Phase | Owner | Description |
|-------|-------|-------------|
| **P0** | **Codex** | 3 bug fixes — must ship first |
| **P5** | **Codex** | UX polish trio — ship alongside P0 |
| **P1** | **Codex** | DSA track modes + interview-aware Today queue |
| **P2** | **Codex** | Application health scores on Tracker cards |
| **P3** | **Codex** | Callback rate analytics breakdown |
| **P4** | **Codex** | Interview day kit (streaming LLM brief) |

---

## P0 — Bug Fixes (ship first)

### BUG-001 — Log Application "Failed to create job"

**File:** `src/app/api/jobs/manual/route.ts`

The `POST /api/jobs/manual` route returns 500 "Failed to create job" on the `jobs` insert. First step: deploy with enhanced logging and repro to capture `jobError`:

```ts
if (jobError || !job) {
  console.error('[manual] job insert failed:', JSON.stringify(jobError))
  // ...
}
```

Two likely root causes:
- **Cause A — unique constraint violation** (`jobError.code === '23505'`): a prior test created the same (company, title) record. Fix: check if a duplicate job already exists and reuse it, or add `ON CONFLICT DO NOTHING` with a fallback select.
- **Cause B — null value violation** (`jobError.message` includes `null value`): `company_profiles` upsert silently returned null, and a `NOT NULL` constraint on `jobs.company_id` blocked insert. Fix: make `company_id` optional (already is in schema) — ensure the insert uses `company_id: companyId ?? null` without implicit coercion.

---

### BUG-002 — Settings "1 Issue" toast (React controlled input)

**File:** `src/components/settings/NotificationSettings.tsx:301`

The timezone `<select>` has `value` + `onBlur` but no `onChange`. React treats this as a read-only controlled input and emits a warning that the app's global error boundary is surfacing as a toast.

**Fix:** Add `onChange` handler to the select:

```tsx
// Line ~300-303
<select
  value={prefs.notification_timezone}
  onChange={e => setPrefs(p => ({ ...p, notification_timezone: e.target.value }))}
  onBlur={e => savePref('notification_timezone', e.target.value)}
  className="..."
>
```

The `onChange` updates local state immediately; `onBlur` persists to the server (existing pattern used everywhere else in this component).

---

### BUG-003 — Company enrich 500s on Tracker/Feed load

**File:** `src/components/feed/JobDetail.tsx:82`, `src/app/api/company/[id]/enrich/route.ts`

`JobDetail.tsx` fires `fetch('/api/company/:id/enrich', { method: 'POST' })` fire-and-forget when `enriched_at` is null. The LLM provider returns `invalid_request_error` after a 40s timeout (likely expired API key or provider rate limit).

**Fix in two parts:**
1. In `JobDetail.tsx`: wrap the fire-and-forget in a proper catch that swallows errors silently — the UI gracefully shows whatever enrichment data is available:
   ```ts
   fetch(`/api/company/${job.company_id}/enrich`, { method: 'POST' })
     .then(r => r.ok ? r.json() : null)
     .then(data => { if (data) setEnrichedCompany(data) })
     .catch(() => {}) // silent — enrichment is best-effort
   ```
2. In `route.ts`: verify the `ANTHROPIC_API_KEY` env var is valid and not expired. The `invalid_request_error` from the LLM provider is the signal.

---

## P5 — UX Polish (ship with P0)

### POLISH-001 — Button label semantics

- **Feed job cards:** `src/components/feed/JobCard.tsx` — change "✓ Applied" to "Mark Applied" (action verb, no checkmark prefix) for jobs the user hasn't applied to. After applying, the button becomes "✓ Applied" (status, past tense) — disabled or different style.
- **DSA problem rows:** `src/components/dsa/ProblemLogger.tsx` — change unsolved button from "Solved ✓" to "Mark Solved". After solving, show "✓ Solved" as a status indicator.

---

### POLISH-002 — Tracker empty state

**File:** `src/components/tracker/TrackerBoard.tsx` (or the page)

When `allApplications.length === 0` across all columns, show above the kanban grid:

```tsx
<div className="flex flex-col items-center gap-3 py-12 text-center">
  {/* grid-of-4-cards icon */}
  <h3 className="text-sm font-semibold text-zinc-200">Track your job search</h3>
  <p className="text-xs text-zinc-500 max-w-xs">
    Log applications manually or save jobs from the Feed to start tracking.
  </p>
  <div className="flex gap-2 mt-1">
    <Link href="/feed" className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
      Browse jobs →
    </Link>
    <button onClick={() => setShowLogModal(true)} className="px-3 py-1.5 rounded-lg bg-zinc-100 text-xs font-medium text-zinc-900 hover:bg-white transition-colors">
      + Log Application
    </button>
  </div>
</div>
```

---

### POLISH-003 — "ST ORY BANK" CSS glitch

**File:** The `StoryBank` tab heading in Prep (find by searching for "Story Bank" in the prep component tree).

Add `whitespace-nowrap` to the section label element that has `text-transform: uppercase` + letter-spacing:
```tsx
<span className="... whitespace-nowrap">Story Bank</span>
```

---

## P1 — DSA Intelligence

### DSA-001 — Track modes: 75 / 150 / 250

**Migration 027:** `supabase/migrations/027_add_dsa_track.sql`
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dsa_track text NOT NULL DEFAULT '150'
  CHECK (dsa_track IN ('75', '150', '250'));
```

**Data files:** `src/lib/dsa/neetcode150.ts`
- Add `NEETCODE_75: NeetcodeProblem[]` — the canonical Blind 75 list (subset of NEETCODE_150 slugs). Source: neetcode.io/practice (75-problem list).
- Add `NEETCODE_250: NeetcodeProblem[]` — NEETCODE_150 plus 100 additional problems from neetcode.io's full practice list.
- Add `TRACK_PROBLEMS: Record<'75'|'150'|'250', Set<string>>` — slug sets for O(1) filter lookup.

**API:** New route `src/app/api/dsa/track/route.ts`
```ts
// PATCH { track: '75' | '150' | '250' }
// Updates users.dsa_track for authenticated user
// Returns { track }
```

**DSAClient changes:** `src/components/dsa/DSAClient.tsx`
- Add `initialTrack: '75' | '150' | '250'` prop
- Add segmented control in header: `[75] [150] [250]` — teal highlight on active, calls PATCH on change
- Filter `filteredSolves` and problem list using `TRACK_PROBLEMS[track]`
- Pass `track` down to `TodayPanel` for recommendation filtering

**DSAPage changes:** `src/app/(app)/dsa/page.tsx`
- Fetch `users.dsa_track` alongside existing queries, pass as `initialTrack` to `DSAClient`

**Tests:**
- Unit: `NEETCODE_75.length === 75`, all slugs exist in `NEETCODE_150`
- Unit: `NEETCODE_250.length === 250`, NEETCODE_150 slugs are a subset
- Integration: `PATCH /api/dsa/track { track: '75' }` → 200, `users.dsa_track === '75'`
- Component: DSAClient with `initialTrack='75'` renders exactly 75 problem rows

---

### DSA-002 — Interview-aware Today queue

**Data file:** `src/lib/dsa/company-patterns.ts` (new)
```ts
// Maps company name (case-insensitive) to Neetcode pattern names
// Patterns must match PATTERNS array from neetcode150.ts
// Curate before shipping — plan ~30 min to verify against community sources
export const COMPANY_PATTERNS: Record<string, string[]> = {
  'Google':     ['1D Dynamic Programming', '2D Dynamic Programming', 'Graphs'],
  'Meta':       ['Trees', 'Graphs', 'Arrays & Hashing'],
  'Amazon':     ['Trees', 'Graphs', 'Two Pointers'],
  'Microsoft':  ['Trees', 'Arrays & Hashing', 'Linked List'],
  'Apple':      ['Arrays & Hashing', 'Trees', 'Binary Search'],
  'Stripe':     ['Arrays & Hashing', '1D Dynamic Programming', 'Greedy'],
  'Airbnb':     ['Trees', 'Graphs', 'Backtracking'],
  'Uber':       ['Graphs', '1D Dynamic Programming', 'Sliding Window'],
  'Lyft':       ['Graphs', 'Arrays & Hashing', 'Two Pointers'],
  'DoorDash':   ['Graphs', '1D Dynamic Programming', 'Arrays & Hashing'],
  'Snowflake':  ['Arrays & Hashing', 'Sliding Window', 'Binary Search'],
  'Databricks': ['Arrays & Hashing', 'Graphs', '1D Dynamic Programming'],
  'Coinbase':   ['Arrays & Hashing', 'Trees', '1D Dynamic Programming'],
  'Robinhood':  ['Arrays & Hashing', '1D Dynamic Programming', 'Heap / Priority Queue'],
  // add remaining companies before shipping...
}
```

**DSAPage changes:**
- Add query: fetch applications with `status IN ('technical', 'final')` alongside existing queries
- Pass as `openTechnicalApps: { company: string, applied_at: string }[]` to DSAClient → TodayPanel

**TodayPanel changes:** `src/components/dsa/TodayPanel.tsx`
- New "Interview focus" section (shows when ≥1 technical/final app exists + match in COMPANY_PATTERNS):
  ```
  Google screen — focus on Graphs today
  You've solved 2/15 Graph problems. [problem title] →
  ```
- Weakness detection: for the matched pattern, compute `solved / total` in the active track. Show the weakest matched pattern.
- If no pattern match (company not in map), no banner shown.

**Tests:**
- Unit: `COMPANY_PATTERNS['Google']` includes `'Graphs'`
- Component: TodayPanel with `openTechnicalApps=[{company:'Google'}]` + 0 Graphs solves → renders interview focus banner
- Component: TodayPanel with `openTechnicalApps=[]` → no banner

---

## P2 — Tracker Intelligence

### TRACKER-001 — Application health scores

**New files:**
- `src/lib/tracker/company-tier.ts` — FAANG list + tier detection
- `src/lib/tracker/health.ts` — `getApplicationHealth(app, tier)`

```ts
// company-tier.ts
const FAANG = new Set(['Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix'])
const LARGE_TECH = new Set(['Salesforce', 'Oracle', 'IBM', 'Adobe', 'Uber', 'Airbnb', ...])

export type CompanyTier = 'faang' | 'large' | 'mid' | 'startup'
export function getCompanyTier(name: string): CompanyTier { ... }

// health.ts
export const RESPONSE_WINDOW_DAYS: Record<CompanyTier, number> = {
  faang: 14, large: 21, mid: 10, startup: 7,
}
export type HealthStatus = 'green' | 'yellow' | 'red'
export function getApplicationHealth(appliedAt: string, tier: CompanyTier): HealthStatus {
  const days = (Date.now() - new Date(appliedAt).getTime()) / 86400000
  const window = RESPONSE_WINDOW_DAYS[tier]
  if (days < window * 0.8) return 'green'
  if (days < window) return 'yellow'
  return 'red'
}
```

**ApplicationCard changes:** `src/components/tracker/ApplicationCard.tsx`
- Show health dot only on `status === 'applied'` cards
- Tooltip on hover: "X days since application · Typical response: ~Y days"
- Colors: green = `bg-emerald-500`, yellow = `bg-amber-500`, red = `bg-red-500`
- Dot size: 6px, positioned top-right of card alongside existing elements

**Tests:**
- Unit: `getApplicationHealth` — FAANG, 15 days → `'yellow'`; startup, 30 days → `'red'`; mid, 3 days → `'green'`
- Component: ApplicationCard with `status='applied'` + red health → renders red dot

---

## P3 — Analytics Intelligence

### ANALYTICS-001 — Callback rate breakdown

**New files:**
- `src/lib/analytics/conversion.ts` — `computeConversionStats(applications)`
- `src/components/analytics/ConversionStats.tsx`

```ts
// conversion.ts
export interface ConversionStats {
  byTier: { tier: CompanyTier; applied: number; callbacks: number; rate: number }[]
  byTitle: { keyword: string; applied: number; callbacks: number; rate: number }[]
  bySource: { source: string; applied: number; callbacks: number; rate: number }[]
  totalCallbacks: number
}

// callback = any status beyond 'applied': phone_screen, technical, final, offer
// title keywords: 'Senior', 'Staff', 'Principal', else 'Software Engineer'
// source: 'manual' | 'extension' | other
```

**Analytics page changes:** `src/app/(app)/analytics/page.tsx`
- Fetch full applications list (with status + company + source) — already partially fetched
- Pass to `ConversionStats` component
- Render below existing charts as "Conversion Insights" section

**ConversionStats component:**
- 3 stat cards: "Best tier: X (Y% callback)", "Best title: X (Y%)", "Best source: X (Y%)"
- If `totalCallbacks < 5`: show placeholder "Apply to more jobs to unlock insights (need 5 callbacks)"
- Cards only show tiers/titles/sources with ≥2 applications

**Tests:**
- Unit: `computeConversionStats` — 10 apps (4 FAANG applied, 2 FAANG → phone_screen) → FAANG rate 50%
- Unit: `totalCallbacks < 5` → placeholder mode
- Component: ConversionStats renders 3 stat cards with correct best-tier label

---

## P4 — Interview Day Kit

### PREP-001 — Interview kit (streaming)

**Migration 028:** `supabase/migrations/028_interview_kits.sql`
```sql
CREATE TABLE IF NOT EXISTS interview_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS interview_kits_application_id_idx ON interview_kits(application_id);
-- One kit per application (regenerate = delete + re-insert)
CREATE UNIQUE INDEX IF NOT EXISTS interview_kits_application_id_unique ON interview_kits(application_id);
```

**Streaming route:** `src/app/api/prep/interview-kit/route.ts`
```ts
// POST { application_id: string }
// Auth guard: 401 if not authenticated
// Fetch: application + job + company_profile + user (full_name, current_title, years_experience, skills) + top 5 star_responses
// If job has no description: proceed with thinner kit (omit job description section)
// Build Anthropic streaming call with prompt template
// Stream tokens via ReadableStream / text/event-stream
// On client-side stream-end signal: store completed content via upsert into interview_kits
```

**Prompt template:**
```
Company: {company_name}
Company description: {company_profiles.description ?? 'Not available'}
Role: {job.title}
Job description: {job.description truncated to 2000 chars, or 'Not available'}
My profile: {users.full_name}, {users.current_title ?? 'Software Engineer'}, 
  {users.years_experience ?? 'N'} yrs, skills: {users.skills?.join(', ') ?? 'not specified'}
My top STAR stories: {top 5 star_responses.title + ' — ' + star_responses.situation_summary}

Generate a concise 1-page interview brief with exactly these sections:
1. **Company** (3 bullets: what they do, recent focus, why this role matters)
2. **Likely behavioral questions** (3 questions specific to this role/company)
3. **Your strongest stories** (pick 3 from my STAR list, explain why each fits)
4. **Questions to ask** (2 sharp questions — not generic)
5. **One thing NOT to say** (common mistake for this type of role/company)
```

**Streaming architecture:**
```
POST /api/prep/interview-kit
  → Returns: ReadableStream, Content-Type: text/event-stream
  → Client: fetch → response.body.getReader() → read chunks → append to state
  → On done: POST /api/prep/interview-kit/save { application_id, content }
     → upserts interview_kits table
```

**InterviewKit component:** `src/components/tracker/InterviewKit.tsx`
- "Generate Kit" button (visible only on technical/final status)
- Loading state: streaming indicator ("Generating your brief…" with animated dots)
- Renders markdown as it streams in using a simple markdown parser
- After generation: "Regenerate" button (triggers delete + re-generate)
- If kit already exists in DB: shows cached version with "Generated X days ago · Regenerate"

**ApplicationDetail changes:** `src/components/tracker/ApplicationDetail.tsx`
- Import and render `InterviewKit` below the existing content, gated on `status === 'technical' || status === 'final'`

**Tests:**
- Unit: prompt builder includes all 5 sections; handles null job description gracefully
- Integration: `POST /api/prep/interview-kit` with valid application_id → 200, streaming response
- Integration: auth guard → 401
- Component: InterviewKit renders "Generate Kit" on technical status; hidden on applied status

---

## Migrations Checklist

Apply in order after P0 is deployed:

- [ ] `027_add_dsa_track.sql` — before P1 DSA work
- [ ] `028_interview_kits.sql` — before P4 Interview Kit

---

## Deferred (do not implement in this wave)

- Salary negotiation playbook — needs comp data layer
- Warm referral radar — needs LinkedIn data
- Auto-apply queue — needs callback rate data to validate matching quality first
- ATS keyword gap analysis — good idea, next wave
