import { extractText } from 'unpdf'

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // ── Attempt 1: unpdf ──────────────────────────────────────────────────────
  try {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true })
    const raw = Array.isArray(result.text) ? result.text.join('\n') : (result.text ?? '')
    const trimmed = raw.trim()
    console.log(`[pdf] unpdf: ${trimmed.length} chars, raw type: ${typeof result.text}`)
    if (trimmed.length > 50) return trimmed
    console.warn('[pdf] unpdf empty/short — trying pdfjs-dist direct')
  } catch (err) {
    console.error('[pdf] unpdf threw:', err)
  }

  // ── Attempt 2: pdfjs-dist directly, no worker ────────────────────────────
  try {
    // Dynamic import to avoid build-time bundling issues
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

    // Disable the worker — required for serverless where worker threads are unavailable
    pdfjs.GlobalWorkerOptions.workerSrc = ''

    const loadTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    })

    const pdf = await loadTask.promise
    const pageTexts: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item: unknown) => (item as { str?: string }).str ?? '')
        .join(' ')
      pageTexts.push(pageText)
    }

    await pdf.destroy()
    const text = pageTexts.join('\n').trim()
    console.log(`[pdf] pdfjs-dist direct: ${text.length} chars`)
    if (text.length > 0) return text
    console.warn('[pdf] pdfjs-dist direct also returned empty')
  } catch (err) {
    console.error('[pdf] pdfjs-dist direct threw:', err)
  }

  // ── Attempt 3: pdf-parse ──────────────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const result = await pdfParse(buffer)
    const text = result.text.trim()
    console.log(`[pdf] pdf-parse: ${text.length} chars`)
    if (text.length > 0) return text
    console.warn('[pdf] pdf-parse also returned empty')
  } catch (err) {
    console.error('[pdf] pdf-parse threw:', err)
  }

  return ''
}
