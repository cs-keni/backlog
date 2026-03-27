import { extractText } from 'unpdf'

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true })
  return (Array.isArray(text) ? text.join('\n') : (text ?? '')).trim()
}
