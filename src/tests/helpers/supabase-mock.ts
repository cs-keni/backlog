import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321'

/**
 * Intercepts a Supabase REST SELECT for the given table and returns rows.
 * Resets automatically after each test via the global afterEach in setup.ts.
 *
 * Usage:
 *   mockSupabaseSelect('jobs', [makeJob()])
 */
export function mockSupabaseSelect(table: string, rows: Record<string, unknown>[]): void {
  server.use(
    http.get(`${SUPABASE_URL}/rest/v1/${table}`, () =>
      HttpResponse.json(rows)
    )
  )
}

/**
 * Intercepts a Supabase REST INSERT for the given table and returns the provided row.
 */
export function mockSupabaseInsert(table: string, row: Record<string, unknown>): void {
  server.use(
    http.post(`${SUPABASE_URL}/rest/v1/${table}`, () =>
      HttpResponse.json(row, { status: 201 })
    )
  )
}

/**
 * Intercepts a Supabase REST UPDATE/PATCH for the given table and returns the row.
 */
export function mockSupabasePatch(table: string, row: Record<string, unknown>): void {
  server.use(
    http.patch(`${SUPABASE_URL}/rest/v1/${table}`, () =>
      HttpResponse.json(row)
    )
  )
}

/**
 * Intercepts a Supabase REST DELETE for the given table and returns 204.
 */
export function mockSupabaseDelete(table: string): void {
  server.use(
    http.delete(`${SUPABASE_URL}/rest/v1/${table}`, () =>
      new HttpResponse(null, { status: 204 })
    )
  )
}

/**
 * Intercepts a Supabase REST call for the given table and returns an error.
 */
export function mockSupabaseError(table: string, message: string, status = 500): void {
  server.use(
    http.all(`${SUPABASE_URL}/rest/v1/${table}`, () =>
      HttpResponse.json({ message }, { status })
    )
  )
}
