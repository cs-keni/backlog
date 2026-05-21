# Current Task

**Last updated:** 2026-05-21
**Status:** Wave 3 + quality pass complete. Next: integration test coverage for high-value untested routes.

---

## Context: where we are

Wave 3 (Outcome Engine) is fully implemented locally. A quality pass on 2026-05-21 brought coverage from ~20% to ~32% of routes tested and fixed several architecture issues. The current grade is estimated **90/100**.

**All migrations 028–035 still need to be applied in Supabase before production use of Wave 2/3 features.**

---

## Active plan: Quality Wave 4 — Test coverage + ApplicationDetail skeleton

### Goal

Push from 90 → 92 by adding integration tests for 3 high-value, currently-untested route groups, plus one UX fix.

### Phase order

| Phase | What | Priority | Estimated tests |
|-------|------|----------|-----------------|
| **QW4-A** | Integration tests: `cover-letter` routes | High | 8 tests |
| **QW4-B** | Integration tests: `resume/tailor` routes | High | 6 tests |
| **QW4-C** | Integration tests: `star-responses` routes | Medium | 8 tests |
| **QW4-D** | ApplicationDetail skeleton while `detailMeta` is null | Medium | visual |

---

## QW4-A: Cover-letter integration tests

**File to create:** `src/tests/integration/cover-letter.test.ts`

**Routes under test:**
- `GET /api/cover-letter` → `src/app/api/cover-letter/route.ts`
- `POST /api/cover-letter` → same file
- `PATCH /api/cover-letter/[id]` → `src/app/api/cover-letter/[id]/route.ts`

**Mock setup needed:**

```ts
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: mockAdminStorageFrom },
  })),
}))
// Dynamic import mock — works even for await import(...)
vi.mock('@/lib/llm/cover-letter', () => ({
  generateCoverLetter: vi.fn().mockResolvedValue({
    template_type: 'formal',
    content: 'Generated cover letter content.',
  }),
}))
```

**Tests to write:**

| Test | Expected |
|------|----------|
| `GET` — 401 unauthenticated | 401 |
| `GET` — 400 missing `job_id` | 400 |
| `GET` — returns null when no application exists for the job | 200, body `null` |
| `GET` — returns existing cover letter | 200, cover letter object |
| `POST` — 401 unauthenticated | 401 |
| `POST` — 400 missing `job_id` | 400 |
| `POST` — 400 when `resume_text` is missing/too short | 400 |
| `POST` — generates and saves cover letter for existing application | 200, `{ id, content, template_type, application_id }` |
| `PATCH` — 401 unauthenticated | 401 |
| `PATCH` — 400 when no valid fields provided | 400 |
| `PATCH` — updates content for owner row | 200, updated object |

**Notes:**
- The POST route has E2E bypass (`hasE2EAuthCookie`). Do NOT send the E2E cookie in tests — just let the real auth path run.
- POST has many parallel `from()` calls. Mock in order: users, work_history, jobs, projects, then the applications check, then cover_letters insert.
- Use `mockFrom.mockReturnValueOnce()` chains — same pattern as `src/tests/integration/profile.test.ts`.

---

## QW4-B: Resume tailor integration tests

**File to create:** `src/tests/integration/resume-tailor.test.ts`

**Routes under test:**
- `GET /api/resume/tailor` → `src/app/api/resume/tailor/route.ts`
- `POST /api/resume/tailor` → same file

**Mock setup needed:**

```ts
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: { from: mockAdminStorageFrom },
  })),
}))
vi.mock('@/lib/llm/resume-tailor', () => ({
  tailorResume: vi.fn().mockResolvedValue({ summary: 'Tailored summary', work: [] }),
}))
vi.mock('@/lib/pdf/resume-generator', () => ({
  generateResumePDF: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
}))
```

**Tests to write:**

| Test | Expected |
|------|----------|
| `GET` — 401 unauthenticated | 401 |
| `GET` — 400 missing `job_id` | 400 |
| `GET` — returns null when no version exists | 200, body `null` |
| `GET` — returns existing version | 200, `{ id, pdf_url, created_at }` |
| `POST` — 401 unauthenticated | 401 |
| `POST` — 400 missing `job_id` | 400 |
| `POST` — 400 when resume text is missing/too short | 400 |
| `POST` — generates PDF, uploads, and returns pdf_url | 200, `{ id, pdf_url }` |

**Notes:**
- The admin storage mock needs `.upload()` returning `{ error: null }` and `.getPublicUrl()` returning `{ data: { publicUrl: 'https://...' } }`.
- POST parallel fetches in order: users, work_history, education, jobs, projects.
- After that: resume_versions check, then resume_versions insert/update.

---

## QW4-C: Star-responses integration tests

**File to create:** `src/tests/integration/star-responses.test.ts`

**Routes under test:**
- `GET /api/star-responses` → `src/app/api/star-responses/route.ts`
- `POST /api/star-responses` → same file
- `PATCH /api/star-responses/[id]` → `src/app/api/star-responses/[id]/route.ts`

**Mock setup:**

```ts
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/llm/star-builder', () => ({
  buildStarResponse: vi.fn().mockResolvedValue({
    situation: 'S', task: 'T', action: 'A', result: 'R', full_response: 'Full STAR',
  }),
}))
```

**Tests to write:**

| Test | Expected |
|------|----------|
| `GET` — 401 unauthenticated | 401 |
| `GET` — returns all responses for user | 200, array |
| `GET` — filters by `company_id` when provided | 200, filtered array |
| `POST` — 401 unauthenticated | 401 |
| `POST` — 400 when `question` is missing | 400 |
| `POST` — saves without LLM when `generate` is falsy | 200, saved row |
| `POST` — calls LLM and saves when `generate: true` | 200, has `situation/task/action/result` |
| `PATCH` — 401 unauthenticated | 401 |
| `PATCH` — 403 for non-owner row | 403 |
| `PATCH` — updates owner row | 200, updated row |

---

## QW4-D: ApplicationDetail skeleton

**File to modify:** `src/components/tracker/ApplicationDetail.tsx`

**Problem:** `detailMeta` is null until the `GET /api/applications/[id]` fetch completes. While it's loading, the side panel renders the recruiter fields and action buttons, but the lower sections (checklist, ATS profile, keyword gaps, resume tailor, salary playbook) show nothing. This causes layout shift.

**Fix:** Add a `detailLoading` boolean state (starts `true`, cleared after the fetch). While `detailLoading`, render skeleton placeholders for the sections that depend on `detailMeta`. Use the same `animate-pulse` pattern already used in `KeywordGap.tsx` and `SalaryPlaybook.tsx`.

The skeleton should mimic the shape of what will appear:
- A 3-row checklist skeleton
- A rectangular block for ATS Profile
- Single-line "Keyword Gaps" placeholder

No new components needed — inline `div` blocks with `animate-pulse bg-zinc-800 rounded` is sufficient.

---

## Checks to run after any change

```bash
node node_modules/typescript/bin/tsc --noEmit

node node_modules/vitest/vitest.mjs run src/tests/integration/cover-letter.test.ts
node node_modules/vitest/vitest.mjs run src/tests/integration/resume-tailor.test.ts
node node_modules/vitest/vitest.mjs run src/tests/integration/star-responses.test.ts

# Full regression
node node_modules/vitest/vitest.mjs run src/tests/
```

---

## Existing test baseline (as of 2026-05-21)

- 88 unit tests (`src/tests/unit/`) — all passing
- 123 integration tests (`src/tests/integration/`) — all passing
- Total: **211 tests**

Do not break any of these. Run the full suite before declaring a phase done.
