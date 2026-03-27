export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import avoids pdf-parse running its test-file reads at module load time,
  // which crashes Next.js serverless functions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { PDFParse } = await import('pdf-parse') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new PDFParse({ data: buffer }) as any
  await parser.load()
  const result = await parser.getText()
  const pages = (result?.pages ?? []) as Array<{ text: string }>
  return pages.map((p: { text: string }) => p.text).join('\n').trim()
}
