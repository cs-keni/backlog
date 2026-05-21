#!/usr/bin/env node
/**
 * Creates (or idempotently upserts) the QA test user via the Supabase Admin API.
 * Run with: node --env-file=.env.local scripts/create-qa-user.mjs
 *
 * The user is confirmed immediately (no email needed) so it can log in right away.
 */

import { createClient } from '@supabase/supabase-js'

const QA_EMAIL = 'gstackqa@qa.local'
const QA_PASSWORD = 'QAtest1234!'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Check if user already exists
const { data: list, error: listErr } = await admin.auth.admin.listUsers()
if (listErr) {
  console.error('Failed to list users:', listErr.message)
  process.exit(1)
}

const existing = list.users.find((u) => u.email === QA_EMAIL)

if (existing) {
  // Update password so it matches the known value even if someone changed it
  const { error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
    password: QA_PASSWORD,
    email_confirm: true,
  })
  if (updateErr) {
    console.error('Failed to update existing QA user:', updateErr.message)
    process.exit(1)
  }
  console.log(`QA user already exists — password reset.\n  ID:    ${existing.id}\n  Email: ${QA_EMAIL}\n  Pass:  ${QA_PASSWORD}`)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: QA_EMAIL,
    password: QA_PASSWORD,
    email_confirm: true,
  })
  if (error) {
    console.error('Failed to create QA user:', error.message)
    process.exit(1)
  }
  console.log(`QA user created.\n  ID:    ${data.user.id}\n  Email: ${QA_EMAIL}\n  Pass:  ${QA_PASSWORD}`)
}
