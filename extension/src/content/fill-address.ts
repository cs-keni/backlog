import type { FullProfile } from '../shared/types'

export interface ParsedAddress {
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
}

export function parseAddress(address: string): ParsedAddress {
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  const parseStateZip = (s: string) => {
    const m = s.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/)
    return m ? { state: m[1], zip: m[2] } : null
  }

  if (parts.length >= 3) {
    const stateZip = parseStateZip(parts[parts.length - 1])
    if (stateZip) return { street: parts[0], city: parts[1], ...stateZip }
    if (parts.length >= 4) return { street: parts[0], city: parts[1], state: parts[2], zip: parts[3] }
    return { street: parts[0], city: parts[1], state: parts[2], zip: null }
  }

  if (parts.length === 2) {
    const stateZip = parseStateZip(parts[1])
    if (stateZip) return { street: null, city: parts[0], ...stateZip }
    return { street: null, city: parts[0], state: parts[1], zip: null }
  }

  return { street: null, city: parts[0] ?? null, state: null, zip: null }
}

export function getProfileAddress(profile: FullProfile): ParsedAddress {
  const fallback = parseAddress(profile.user.address ?? '')
  return {
    street: profile.user.street_address || fallback.street,
    city: profile.user.city || fallback.city,
    state: profile.user.state || fallback.state,
    zip: profile.user.postal_code || fallback.zip,
  }
}

export function getFullAddress(profile: FullProfile): string | null {
  const { street, city, state, zip } = getProfileAddress(profile)
  if (street && city && state && zip) return `${street}, ${city}, ${state} ${zip}`
  if (city && state && zip) return `${city}, ${state} ${zip}`
  if (city && state) return `${city}, ${state}`
  return profile.user.address
}

