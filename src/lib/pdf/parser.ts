import { PDFParse } from 'pdf-parse'

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new PDFParse({ data: buffer }) as any
  await parser.load()
  const result = await parser.getText()
  const pages = (result?.pages ?? []) as Array<{ text: string }>
  return pages.map((p: { text: string }) => p.text).join('\n').trim()
}
