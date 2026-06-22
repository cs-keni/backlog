#!/usr/bin/env node
/**
 * Uploads resume-data/resume.md to the users.resume_markdown column.
 * Run once after migration 043 is applied.
 *
 *   node --env-file=.env.local scripts/upload-resume.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESUME_PATH = join(__dirname, '..', 'resume-data', 'resume.md')
const USER_EMAIL  = 'kenny.hn.nguyen@gmail.com'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const content = readFileSync(RESUME_PATH, 'utf-8')

const { data: { users } } = await admin.auth.admin.listUsers()
const user = users.find(u => u.email === USER_EMAIL)
if (!user) { console.error(`User ${USER_EMAIL} not found`); process.exit(1) }

const { error } = await admin
  .from('users')
  .update({ resume_markdown: content })
  .eq('id', user.id)

if (error) { console.error('Upload failed:', error.message); process.exit(1) }

console.log(`✓ resume.md uploaded (${content.length} chars) for ${USER_EMAIL}`)
