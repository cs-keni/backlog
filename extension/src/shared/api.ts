import { BACKLOG_URL } from './config'
import type { FullProfile } from './types'

const STORAGE_KEY = 'backlog_api_key'

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as string | undefined) ?? null
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: key })
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = await getApiKey()
  return fetch(`${BACKLOG_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...init?.headers,
    },
  })
}

export async function fetchProfile(): Promise<FullProfile> {
  const res = await apiFetch('/api/extension/profile')
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`)
  return res.json() as Promise<FullProfile>
}

export async function markApplied(payload: {
  jobUrl: string
  jobTitle?: string | null
  company?: string | null
  jobId?: string
  applicationId?: string | null
}): Promise<{ applicationId: string }> {
  const res = await apiFetch('/api/extension/apply', {
    method: 'POST',
    body: JSON.stringify({
      jobUrl: payload.jobUrl,
      jobTitle: payload.jobTitle ?? undefined,
      company: payload.company ?? undefined,
      jobId: payload.jobId,
      applicationId: payload.applicationId ?? undefined,
    }),
  })
  if (!res.ok) throw new Error(`Apply failed: ${res.status}`)
  return res.json() as Promise<{ applicationId: string }>
}

export async function fetchJobContext(jobId: string): Promise<{
  id: string
  title: string
  company: string
  applications?: Array<{ id: string; status: string }>
}> {
  const res = await apiFetch(`/api/jobs/${encodeURIComponent(jobId)}`)
  if (!res.ok) throw new Error(`Job fetch failed: ${res.status}`)
  return res.json() as Promise<{
    id: string
    title: string
    company: string
    applications?: Array<{ id: string; status: string }>
  }>
}

export async function fetchApplicationForJob(jobId: string): Promise<{
  id: string
  status: string
  cover_letter_url: string | null
} | null> {
  const res = await apiFetch(`/api/applications?jobId=${encodeURIComponent(jobId)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Application fetch failed: ${res.status}`)
  const json = await res.json() as { id: string; status: string; cover_letter_url: string | null } | null
  if (json?.cover_letter_url?.startsWith('/')) {
    json.cover_letter_url = `${BACKLOG_URL}${json.cover_letter_url}`
  }
  return json
}

export async function analyzePage(fields: Array<{
  selector: string
  label: string
  type: string
  options?: string[]
}>): Promise<Array<{ type: string; selector: string; value?: string; question?: string }>> {
  const res = await apiFetch('/api/extension/analyze-page', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) return []
  const json = await res.json() as { results?: Array<{ type: string; selector: string; value?: string; question?: string }> }
  return json.results ?? []
}

export async function answerQuestion(question: string): Promise<string | null> {
  const res = await apiFetch('/api/extension/answer-question', {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
  if (!res.ok) return null
  const json = await res.json() as { answer?: string }
  return json.answer ?? null
}

export async function improveSkills(payload: {
  currentSkills: string
  profileSkills: string[]
  jobDescription: string | null
}): Promise<string | null> {
  const res = await apiFetch('/api/extension/improve-skills', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) return null
  const json = await res.json() as { skills?: string }
  return json.skills ?? null
}

export async function addJob(payload: {
  url: string
  title: string
  company: string
  description?: string | null
  location?: string | null
}): Promise<{ job: { id: string }; duplicate: boolean }> {
  const res = await apiFetch('/api/extension/add-job', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Add job failed: ${res.status}`)
  return res.json() as Promise<{ job: { id: string }; duplicate: boolean }>
}
