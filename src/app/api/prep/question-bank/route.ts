import { createClient } from '@/lib/supabase/server'
import { getPrimers, getQuestionBank, isPrepBank } from '@/lib/prep/banks'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const bank = searchParams.get('bank')
  if (!isPrepBank(bank)) return Response.json({ error: 'Invalid bank' }, { status: 400 })

  return Response.json(
    { questions: getQuestionBank(bank), primers: getPrimers() },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } }
  )
}
