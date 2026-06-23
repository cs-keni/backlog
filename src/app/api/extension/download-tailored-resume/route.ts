export const maxDuration = 60
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { preprocessResumeLol, parseResume } from '@/lib/pdf/resume-utils'
import { ResumeDoc } from '@/lib/pdf/resume-doc'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ProjectSuggestion {
  projectId:  string
  name:       string
  rank:       number
  relevance:  string
  swapReason: string
}

interface DownloadTailoredResumeBody {
  jobTitle:     string
  company:      string
  jobDescription: string
  suggestions:  ProjectSuggestion[]
}

interface ProjectRow {
  id:                   string
  name:                 string
  description:          string | null
  detailed_description: string | null
  tech_stack:           string[] | null
  highlights:           string[] | null
  role:                 string | null
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: DownloadTailoredResumeBody
  try {
    body = await request.json() as DownloadTailoredResumeBody
    if (!body.suggestions?.length) throw new Error()
  } catch {
    return Response.json({ error: 'suggestions array required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch user's resume markdown and project catalog entries in parallel
  const projectIds = body.suggestions.map(s => s.projectId)

  const [{ data: user }, { data: projects }] = await Promise.all([
    supabase.from('users').select('resume_markdown, full_name').eq('id', auth.userId).single(),
    supabase.from('projects').select('id, name, description, detailed_description, tech_stack, highlights, role').in('id', projectIds),
  ])

  if (!user?.resume_markdown) {
    return Response.json(
      { error: 'No resume on file. Run: node --env-file=.env.local scripts/upload-resume.mjs' },
      { status: 404 }
    )
  }

  const projectMap = new Map((projects as ProjectRow[] ?? []).map(p => [p.id, p]))

  // Build project context for Claude
  const projectContext = body.suggestions
    .sort((a, b) => a.rank - b.rank)
    .map((s) => {
      const p = projectMap.get(s.projectId)
      if (!p) return null
      const desc = p.detailed_description ?? p.description ?? ''
      const stack = p.tech_stack?.join(', ') ?? ''
      const highlights = p.highlights?.join('\n- ') ?? ''
      return `### ${p.name}\nRole: ${p.role ?? 'Lead Developer'}\nStack: ${stack}\n${desc}\nKey outcomes:\n- ${highlights}\nWhy this fits the role: ${s.relevance}`
    })
    .filter(Boolean)
    .join('\n\n')

  const cleanResume = preprocessResumeLol(user.resume_markdown)

  const prompt = `You are tailoring a resume for a specific job application. The output MUST fit on ONE page when rendered as a PDF with 9pt Times New Roman font and 36pt top/bottom margins.

## Job
**Title:** ${body.jobTitle}
**Company:** ${body.company}
**Description (excerpt):** ${body.jobDescription.slice(0, 1800)}

## Projects to feature (ranked by relevance)
${projectContext}

## Current resume (clean markdown)
${cleanResume}

## Task
Replace the Projects section with the ${body.suggestions.length} projects above.
For each project write EXACTLY 4 resume-style bullet points that:
- Lead with a strong action verb
- Name the specific technologies from the project's stack
- Mirror language from the job description where it fits naturally
- Quantify impact where the project data provides numbers
- Stay under 105 characters per bullet; write substantive, detail-rich bullets (not vague filler). Shorter bullets = fewer awkward line-wraps.

IMPORTANT rules:
- Keep every other section EXACTLY as-is (Experience, Skills, Education, header)
- If the existing Experience section has more than 4 bullets per role, trim to 4
- Use this format for each project heading: ### Name | Subtitle | Date Range
  - If no date range is known, omit the date part
  - The subtitle should be a short tech/category label (e.g. "Full-Stack Web App")
- Output ONLY the complete modified resume markdown — no commentary, no code fences`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const tailoredMarkdown = message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  // Count rendered PDF pages — each page object has "/Type /Page" (not "/Pages")
  function countPdfPages(buf: Buffer): number {
    const str = buf.toString('binary')
    const hits = str.match(/\/Type\s*\/Page[^s]/g)
    return hits ? hits.length : 1
  }

  const parsed = parseResume(tailoredMarkdown)
  let buffer = await renderToBuffer(
    createElement(ResumeDoc, { resume: parsed }) as unknown as Parameters<typeof renderToBuffer>[0]
  )

  // If it spilled onto a second page, re-render with compact spacing
  if (countPdfPages(buffer) > 1) {
    buffer = await renderToBuffer(
      createElement(ResumeDoc, { resume: parsed, compact: true }) as unknown as Parameters<typeof renderToBuffer>[0]
    )
  }

  const name     = user.full_name ?? 'Resume'
  const safeName = name.replace(/\s+/g, '_')
  const filename = `${safeName}_Resume_${body.company.replace(/\s+/g, '_')}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buffer.byteLength),
    },
  })
}
