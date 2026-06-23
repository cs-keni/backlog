export const maxDuration = 30
export const dynamic = 'force-dynamic'

import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { CoverLetterDoc } from '@/lib/pdf/cover-letter-doc'

interface DownloadCoverLetterBody {
  jobTitle:        string
  company:         string
  coverLetterBody: string
}

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let body: DownloadCoverLetterBody
  try {
    body = await request.json() as DownloadCoverLetterBody
    if (!body.coverLetterBody) throw new Error()
  } catch {
    return Response.json({ error: 'coverLetterBody required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: user } = await supabase
    .from('users')
    .select('full_name, email, phone, linkedin_url, github_url, portfolio_url')
    .eq('id', auth.userId)
    .single()

  const name = user?.full_name ?? 'Applicant'

  function formatPhone(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    const local = digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : digits
    if (local.length === 10) return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`
    return raw
  }

  const contacts = [
    user?.email,
    user?.phone ? formatPhone(user.phone) : null,
    user?.portfolio_url,
    user?.github_url,
    // LinkedIn intentionally omitted from cover letter header
  ].filter(Boolean) as string[]

  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Los_Angeles',
  })

  const buffer = await renderToBuffer(
    // CoverLetterDoc renders a <Document> internally; cast satisfies renderToBuffer's
    // ReactElement<DocumentProps> constraint without losing runtime correctness.
    createElement(CoverLetterDoc, {
      name,
      contacts,
      date,
      jobTitle: body.jobTitle,
      company:  body.company,
      body:     body.coverLetterBody,
    }) as unknown as Parameters<typeof renderToBuffer>[0]
  )

  const filename = `${name.replace(/\s+/g, '_')}_Cover_Letter_${body.company.replace(/\s+/g, '_')}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(buffer.byteLength),
    },
  })
}
