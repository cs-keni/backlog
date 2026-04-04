import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

interface UnfilledField {
  selector: string
  label: string
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select'
  options?: string[]
}

type FieldAnalysisResult =
  | { type: 'value'; selector: string; value: string }
  | { type: 'open_ended'; selector: string; question: string }
  | { type: 'skip'; selector: string }

const SYSTEM_PROMPT = `You are an assistant that maps job application form fields to a user's profile data.

Given a list of unfilled form fields (label, input type, and any dropdown options), respond with a JSON array where each item is one of:
- { "type": "value", "selector": "<selector>", "value": "<value>" } — when you can determine a profile-based value
- { "type": "open_ended", "selector": "<selector>", "question": "<full question text>" } — for free-text questions requiring a written answer (e.g. "Why do you want to work here?", "Describe your experience with...")
- { "type": "skip", "selector": "<selector>" } — when you cannot determine the value

Rules:
- Only classify as "open_ended" if the field is genuinely asking for a written, personalized answer
- Fields like "years of experience", "availability date", "start date" are "value" type — make a reasonable guess (e.g. "2 weeks" for notice period)
- For dropdowns, the value must exactly match one of the provided options
- Return only valid JSON, no markdown, no explanation`

export async function POST(request: Request) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  let fields: UnfilledField[]
  try {
    const body = await request.json() as { fields?: unknown }
    if (!Array.isArray(body.fields)) {
      return Response.json({ error: 'fields must be an array' }, { status: 400 })
    }
    fields = body.fields as UnfilledField[]
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (fields.length === 0) {
    return Response.json({ results: [] })
  }

  // Cap at 40 fields per call to keep token count manageable
  const fieldsToAnalyze = fields.slice(0, 40)

  const fieldDescriptions = fieldsToAnalyze.map((f) => {
    const optionsStr = f.options?.length ? ` Options: [${f.options.join(', ')}]` : ''
    return `selector="${f.selector}" label="${f.label}" type="${f.type}"${optionsStr}`
  }).join('\n')

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze these unfilled form fields and return a JSON array:\n\n${fieldDescriptions}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return Response.json({ results: [] })
    }

    // Parse the JSON response
    let results: FieldAnalysisResult[]
    try {
      // Strip markdown code fences if Haiku wraps in them
      const cleaned = content.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
      results = JSON.parse(cleaned) as FieldAnalysisResult[]
    } catch {
      console.error('[analyze-page] Failed to parse Haiku response:', content.text)
      return Response.json({ results: [] })
    }

    return Response.json({ results })
  } catch (err) {
    console.error('[analyze-page] Haiku error:', err)
    return Response.json({ results: [] })
  }
}
