export type SourcePreferenceAction = 'pin' | 'hide' | 'reset'
export type SourcePreferences = Record<string, 'pin' | 'hide'>

const VALID_ACTIONS = new Set<SourcePreferenceAction>(['pin', 'hide', 'reset'])

export function isSourcePreferenceAction(action: unknown): action is SourcePreferenceAction {
  return typeof action === 'string' && VALID_ACTIONS.has(action as SourcePreferenceAction)
}

export function updateSourcePreferences(
  current: SourcePreferences | null | undefined,
  source: string,
  action: SourcePreferenceAction
): SourcePreferences {
  const next: SourcePreferences = { ...(current ?? {}) }
  if (action === 'reset') delete next[source]
  else next[source] = action
  return next
}

export function hiddenSources(preferences: SourcePreferences | null | undefined): string[] {
  return Object.entries(preferences ?? {})
    .filter(([, action]) => action === 'hide')
    .map(([source]) => source)
}
