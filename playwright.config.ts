import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const extensionPath = path.resolve(__dirname, 'extension/dist')
const extensionArgs =
  process.env.LOAD_EXTENSION_E2E === '1'
    ? [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`]
    : []

export default defineConfig({
  testDir: './src/tests/e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 10_000,
  },
  expect: {
    timeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: extensionArgs.length > 0 ? { args: extensionArgs } : undefined,
      },
    },
  ],
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_E2E_TEST_MODE: '1',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'test',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? 'test',
    },
  },
})
