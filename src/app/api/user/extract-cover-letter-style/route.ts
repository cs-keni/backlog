export const maxDuration = 120
export const dynamic = 'force-dynamic'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { extractTextFromPdf } from '@/lib/pdf/parser'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Max PDFs to process in a single request — balance token cost vs. coverage
const MAX_PDFS = 20
// Max chars per PDF to avoid overwhelming the context
const CHARS_PER_PDF = 2000

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) {
    // Also accept session-based auth for the web settings UI
    // (API key auth is for extension, session for the web app)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Expected multipart/form-data with PDF files' }, { status: 400 })
  }

  const files = formData.getAll('pdfs') as File[]
  if (files.length === 0) {
    return Response.json({ error: 'No PDFs provided — include files under the "pdfs" field' }, { status: 400 })
  }

  const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
  if (pdfFiles.length === 0) {
    return Response.json({ error: 'No valid PDF files found' }, { status: 400 })
  }

  const sampled = pdfFiles.slice(0, MAX_PDFS)

  // Extract text from each PDF in parallel
  const extractedTexts = await Promise.allSettled(
    sampled.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer())
      const text = await extractTextFromPdf(buffer)
      return text.slice(0, CHARS_PER_PDF)
    })
  )

  const validTexts = extractedTexts
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value.length > 100)
    .map((r, i) => `--- Cover Letter ${i + 1} ---\n${r.value}`)

  if (validTexts.length === 0) {
    return Response.json({ error: 'Could not extract text from any of the provided PDFs' }, { status: 422 })
  }

  const combinedText = validTexts.join('\n\n')

  const prompt = `I'm going to show you ${validTexts.length} cover letters written by the same person. Your job is to extract their writing style so it can be used to generate future cover letters that sound like them.

Analyze these cover letters and write a style guide in 300–500 words covering:

1. **Voice and tone** — formal vs. casual, confident vs. humble, warm vs. direct
2. **Sentence structure** — short punchy vs. complex subordinate clauses, use of em dashes, semicolons, parentheses
3. **Opening patterns** — how they typically begin (anecdote, hook, direct statement of fit, company compliment)
4. **Storytelling patterns** — how they describe their work (STAR format, outcome-first, challenge-first)
5. **Signature phrases or vocabulary** — recurring words, phrases, or framing they favor
6. **What they avoid** — clichés they don't use, formality they skip
7. **Paragraph length and structure** — typical paragraph count, how they transition

Be specific and quote examples from the letters.

${combinedText}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const styleContext = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    // Persist to users table
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await supabase
      .from('users')
      .update({ cover_letter_style_context: styleContext })
      .eq('id', auth.userId)

    return Response.json({
      styleContext,
      processedPdfs: validTexts.length,
      skippedPdfs: sampled.length - validTexts.length,
    })
  } catch (err) {
    console.error('[extract-cover-letter-style] Anthropic error:', err)
    return Response.json({ error: 'AI analysis failed' }, { status: 500 })
  }
}
