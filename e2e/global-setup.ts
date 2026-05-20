import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FullConfig } from '@playwright/test'

async function globalSetup(_config: FullConfig) {
  process.env.NEXT_PUBLIC_E2E_TEST_MODE = '1'
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
  process.env.OPENAI_API_KEY ??= 'test'
  process.env.ANTHROPIC_API_KEY ??= 'test'

  const envPath = path.join(process.cwd(), 'e2e', '.env.test')
  await mkdir(path.dirname(envPath), { recursive: true })
  await writeFile(
    envPath,
    [
      'NEXT_PUBLIC_E2E_TEST_MODE=1',
      `NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      `SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      `OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`,
      `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`,
      '',
    ].join('\n'),
  )
}

export default globalSetup
