export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildInterviewKitPrompt } from '@/lib/llm/interview-kit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ApplicationRow {
  id: string
  job_id: string
  jobs: {
    title: string
    company: string
    description: string | null
    company_profiles: { description: string | null } | null
  } | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const applicationId = searchParams.get('application_id')
  if (!applicationId) return Response.json({ error: 'application_id is required' }, { status: 400 })

  const { data: app } = await supabase
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 })

  const { data } = await supabase
    .from('interview_kits')
    .select('id, application_id, generated_at, content, created_at')
    .eq('application_id', applicationId)
    .maybeSingle()

  return Response.json(data ?? null)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { application_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.application_id !== 'string') {
    return Response.json({ error: 'application_id is required' }, { status: 400 })
  }

  const [appResult, profileResult, storiesResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, job_id, jobs(title, company, description, company_profiles(description))')
      .eq('id', body.application_id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('users')
      .select('full_name, years_of_experience, skills')
      .eq('id', user.id)
      .single(),
    supabase
      .from('star_responses')
      .select('question, situation, full_response')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(5),
  ])

  const app = appResult.data as unknown as ApplicationRow | null
  const job = app?.jobs
  if (!app || !job) return Response.json({ error: 'Application not found' }, { status: 404 })

  const profile = profileResult.data as {
    full_name: string | null
    years_of_experience: number | null
    skills: string[] | null
  } | null

  const prompt = buildInterviewKitPrompt({
    companyName: job.company,
    companyDescription: job.company_profiles?.description ?? null,
    roleTitle: job.title,
    jobDescription: job.description,
    fullName: profile?.full_name ?? null,
    currentTitle: null,
    yearsExperience: profile?.years_of_experience ?? null,
    skills: profile?.skills ?? null,
    starStories: (storiesResult.data ?? []) as Array<{
      question: string
      situation: string | null
      full_response: string | null
    }>,
  })

  const encoder = new TextEncoder()
  const llmStream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of llmStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch {
        // stream error — client will surface its own error state
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
