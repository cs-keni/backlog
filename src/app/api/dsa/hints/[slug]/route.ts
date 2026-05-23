import { verifyApiKeyFromRequest } from '@/lib/auth/api-key'
import { getHints } from '@/lib/dsa/hints'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = await verifyApiKeyFromRequest(request)
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const hints = getHints(slug)
  if (!hints) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(hints, {
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
