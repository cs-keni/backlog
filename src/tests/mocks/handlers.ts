import { http, HttpResponse } from 'msw'

// Add mock request handlers here as needed in later phases.
// Example:
// http.get('/api/jobs', () => HttpResponse.json({ jobs: [] }))

export const handlers = [
  // Placeholder — no API routes yet in Phase 1
  http.get('/api/health', () => HttpResponse.json({ status: 'ok' })),
]
