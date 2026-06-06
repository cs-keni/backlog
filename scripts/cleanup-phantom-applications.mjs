#!/usr/bin/env node
/**
 * One-off cleanup for phantom "applied" records created by the extension's
 * false-positive apply-detection bug (fixed in commit 9f1153b — see PHASES.md
 * Phase 22). Removes two kinds of bogus `jobs`+`applications` rows:
 *
 *   1. JUNK   — stubs scraped from pages that were never job applications
 *               (the user's own GitHub pages, a "join our talent community"
 *               signup page).
 *   2. DUPES  — the detector fired multiple times on ONE real multi-step
 *               application (each step got its own job+application stub).
 *               We keep the single cleanest-titled record per cluster and
 *               delete the rest.
 *
 * `applications.job_id` FKs to `jobs.id`, so applications are deleted first.
 *
 * Run with: node --env-file=.env.local scripts/cleanup-phantom-applications.mjs
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Each entry: the job/application pair to delete, the expected current title
// (verified live before deletion so we abort if the data has shifted since
// this list was compiled), and why it's being removed.
const TO_DELETE = [
  // ── Junk: not job applications at all ──────────────────────────────────
  { jobId: '13f7db01-deaf-4fe5-937f-c92cb48823ae', appId: '3ca498ba-6249-47ac-9587-8b20d4a7235e', expectedTitle: 'Provide feedback', reason: 'junk — github.com repo page' },
  { jobId: '3207a38f-491a-45ea-b6f6-3a6d30c75aec', appId: '925b6b01-43fb-42eb-a3d7-96165daacf1d', expectedTitle: 'Provide feedback', reason: 'junk — github.com repo settings page' },
  { jobId: '6493db0b-8908-4ed5-a9cd-591751bb5cfb', appId: '55eff7f0-e7c9-4c0a-9441-e45e480c38c6', expectedTitle: 'Provide feedback', reason: 'junk — github.com/settings/emails' },
  { jobId: '607817fa-819e-4bca-8ffd-695594adfae0', appId: '6f6fb8c5-1efa-4eb4-b295-7e438f673d08', expectedTitle: 'Provide feedback', reason: 'junk — github.com profile page' },
  { jobId: 'd8c70251-99d1-4f1a-86b3-321da6464cb8', appId: '5964b5a1-f2bd-4199-9c92-be08cf7e849b', expectedTitle: 'Sign up for the Early Careers Talent Community', reason: 'junk — Wells Fargo talent-community signup, not a job application' },

  // ── Duplicates: HR Block "Associate Software Engineer, Seasonal" (job 42434) ──
  // Detector fired 7x across one login → candidate → questions → forms flow on
  // 2026-05-13. Keeping b78e19ba (the candidate-info page, cleanest title).
  { jobId: '6dd00b51-73fa-4582-8dca-aabd467ef468', appId: '07d6f4c8-7cc8-4916-8bc5-ff1e1820e3e8', expectedTitle: 'Applying for Associate Software Engineer, Seasonal', reason: 'duplicate stub — HR Block flow, login step' },
  { jobId: 'bdfcc8be-a161-41c6-8041-9468c1c425ba', appId: '56e2680f-6f57-46a3-ab38-a6ce90b4b261', expectedTitle: 'Associate Software Engineer, Seasonal', reason: 'duplicate stub — HR Block flow, questions step' },
  { jobId: '2baebdb8-519e-414e-a7a9-a92424a2e4b1', appId: 'cd9be52e-d760-4686-bbc1-f5c45f8ab727', expectedTitle: 'Associate Software Engineer, Seasonal', reason: 'duplicate stub — HR Block flow, questions step (re-scrape)' },
  { jobId: 'd30f2ccc-fd53-4465-89ab-179d45926ab6', appId: '5da220fd-c0e3-4499-b048-3245a25b94a2', expectedTitle: 'Unknown role', reason: 'duplicate stub — HR Block flow, packet form step 6' },
  { jobId: '05510d2f-5883-4b88-b744-61896ba6a095', appId: 'e0305417-c0ec-47c0-87e9-a5f7faf78eda', expectedTitle: 'Unknown role', reason: 'duplicate stub — HR Block flow, EEO data form' },
  { jobId: '1bb9ab08-cc82-43e1-b77c-96377577e125', appId: 'db86e388-e7be-492f-aa76-5469b7d4f878', expectedTitle: 'Unknown role', reason: 'duplicate stub — HR Block flow, WOTC acknowledgement form' },

  // ── Duplicates: GDMS "Entry Level Software Engineer" (job 72592) ──────────
  // Detector fired 4x across one login → questions flow spanning 2026-05-24
  // through 2026-06-02. Keeping e3a23411 (the questions page, cleanest title).
  { jobId: '22ebd025-121f-4b1b-aede-c8abd29637da', appId: 'ed804aa4-2992-494a-aa95-5e19a3c0e5ea', expectedTitle: 'Enter Your Information', reason: 'duplicate stub — GDMS 72592 flow, login/email step' },
  { jobId: '165c3cc4-6019-4e76-ab52-6ee72edcf1c1', appId: '8ddbf347-e157-4884-aa61-509a06982dca', expectedTitle: 'Enter Your Password', reason: 'duplicate stub — GDMS 72592 flow, login/password redirect' },
  { jobId: '17a9c16d-ea74-43f6-acb0-2c38fec61ed6', appId: 'ee448544-20b2-41f0-9fe4-dd1385ca4398', expectedTitle: 'Enter Your Password', reason: 'duplicate stub — GDMS 72592 flow, questions page re-scrape' },
]

console.log(`Verifying ${TO_DELETE.length} records before deletion...\n`)

for (const entry of TO_DELETE) {
  const { data: job, error } = await admin
    .from('jobs')
    .select('id, title, hide_from_feed, applications(id)')
    .eq('id', entry.jobId)
    .maybeSingle()

  if (error) {
    console.error(`  ABORT — failed to fetch job ${entry.jobId}:`, error.message)
    process.exit(1)
  }
  if (!job) {
    console.error(`  ABORT — job ${entry.jobId} no longer exists (already deleted?). Stopping without changes.`)
    process.exit(1)
  }
  if (job.title !== entry.expectedTitle) {
    console.error(`  ABORT — job ${entry.jobId} title changed: expected "${entry.expectedTitle}", found "${job.title}". Stopping without changes.`)
    process.exit(1)
  }
  if (!job.hide_from_feed) {
    console.error(`  ABORT — job ${entry.jobId} is no longer hide_from_feed=true. Stopping without changes.`)
    process.exit(1)
  }
  if (!job.applications.some((a) => a.id === entry.appId)) {
    console.error(`  ABORT — application ${entry.appId} is not linked to job ${entry.jobId} anymore. Stopping without changes.`)
    process.exit(1)
  }
  console.log(`  OK   ${entry.jobId}  "${job.title}"  — ${entry.reason}`)
}

console.log(`\nAll ${TO_DELETE.length} records verified. Deleting applications, then jobs...\n`)

const appIds = TO_DELETE.map((e) => e.appId)
const jobIds = TO_DELETE.map((e) => e.jobId)

const { error: appDeleteErr, count: appDeleteCount } = await admin
  .from('applications')
  .delete({ count: 'exact' })
  .in('id', appIds)

if (appDeleteErr) {
  console.error('ABORT — failed to delete applications:', appDeleteErr.message)
  process.exit(1)
}
console.log(`Deleted ${appDeleteCount} application row(s).`)

const { error: jobDeleteErr, count: jobDeleteCount } = await admin
  .from('jobs')
  .delete({ count: 'exact' })
  .in('id', jobIds)

if (jobDeleteErr) {
  console.error('ABORT — applications were deleted but job deletion failed:', jobDeleteErr.message)
  console.error('Manual follow-up needed — orphaned job rows remain for:', jobIds.join(', '))
  process.exit(1)
}
console.log(`Deleted ${jobDeleteCount} job row(s).`)

console.log(`\nDone. Removed ${TO_DELETE.length} phantom job+application pairs:`)
console.log(`  - 5 junk stubs (GitHub pages, talent-community signup)`)
console.log(`  - 6 HR Block duplicate stubs (kept b78e19ba-d0cd-4483-9a18-9c18a0dc515a)`)
console.log(`  - 3 GDMS-72592 duplicate stubs (kept e3a23411-2c25-4084-8e67-4f9a58293a5f)`)
console.log(`\nLeft untouched: the ambiguous GDMS-72580 "Enter Your Information" stub (d22bf80c-...)`)
