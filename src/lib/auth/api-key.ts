import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export function generateApiKey(): string {
  // blg_ prefix + 40 hex chars — easy to identify, hard to guess
  return 'blg_' + crypto.randomBytes(20).toString('hex')
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Verifies a raw API key against stored hashes.
 * Updates last_used_at as a side-effect (fire-and-forget).
 * Returns { userId, keyId } on success, null on failure.
 */
export async function verifyApiKey(
  key: string
): Promise<{ userId: string; keyId: string } | null> {
  if (!key.startsWith('blg_')) return null

  const hash = hashApiKey(key)

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await serviceClient
    .from('api_keys')
    .select('id, user_id')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .single()

  if (!data) return null

  // Fire-and-forget last_used_at update
  void serviceClient
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return { userId: data.user_id as string, keyId: data.id as string }
}

/**
 * Extracts and verifies the API key from an Authorization: Bearer <key> header.
 */
export async function verifyApiKeyFromRequest(
  request: Request
): Promise<{ userId: string; keyId: string } | null> {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer blg_')) return null
  return verifyApiKey(auth.slice(7))
}
