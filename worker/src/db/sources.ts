import { supabase } from './client'

export interface Source {
  id: string
  name: string
  url: string
  last_fetched_at: string | null
  last_sha: string | null
  fetch_interval_minutes: number
}

export async function getOrCreateSource(name: string, url: string): Promise<Source> {
  const { data: existing, error: selectError } = await supabase
    .from('sources')
    .select('*')
    .eq('name', name)
    .maybeSingle()

  if (selectError) throw new Error(`Failed to query sources: ${selectError.message}`)
  if (existing) return existing as Source

  const { data: created, error: insertError } = await supabase
    .from('sources')
    .insert({ name, url, fetch_interval_minutes: 15 })
    .select()
    .single()

  if (insertError || !created) {
    throw new Error(`Failed to create source "${name}": ${insertError?.message}`)
  }

  return created as Source
}

export async function updateSourceSha(id: string, sha: string): Promise<void> {
  const { error } = await supabase
    .from('sources')
    .update({ last_sha: sha, last_fetched_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(`Failed to update source SHA: ${error.message}`)
}
