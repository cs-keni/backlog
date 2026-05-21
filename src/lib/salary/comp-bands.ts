export interface CompBand {
  p25: number
  p50: number
  p75: number
}

export type LocationTier = 'tier1' | 'tier2' | 'tier3' | 'remote'
type RoleBucket =
  | 'swe_ic4' | 'swe_ic5' | 'swe_staff' | 'swe_principal'
  | 'em_l5' | 'em_director'
  | 'pm_ic4' | 'pm_ic5' | 'pm_staff'
  | 'ds_ic4' | 'ds_ic5'
  | 'design_ic4' | 'design_ic5'
  | 'default'

const TIER1: Record<RoleBucket, CompBand> = {
  swe_ic4: { p25: 210_000, p50: 260_000, p75: 320_000 },
  swe_ic5: { p25: 280_000, p50: 360_000, p75: 450_000 },
  swe_staff: { p25: 350_000, p50: 450_000, p75: 600_000 },
  swe_principal: { p25: 500_000, p50: 650_000, p75: 900_000 },
  em_l5: { p25: 250_000, p50: 320_000, p75: 400_000 },
  em_director: { p25: 400_000, p50: 550_000, p75: 750_000 },
  pm_ic4: { p25: 180_000, p50: 230_000, p75: 290_000 },
  pm_ic5: { p25: 240_000, p50: 310_000, p75: 400_000 },
  pm_staff: { p25: 310_000, p50: 400_000, p75: 520_000 },
  ds_ic4: { p25: 170_000, p50: 220_000, p75: 280_000 },
  ds_ic5: { p25: 240_000, p50: 310_000, p75: 400_000 },
  design_ic4: { p25: 160_000, p50: 210_000, p75: 270_000 },
  design_ic5: { p25: 220_000, p50: 290_000, p75: 380_000 },
  default: { p25: 130_000, p50: 170_000, p75: 230_000 },
}

function scaleBands(multiplier: number): Record<RoleBucket, CompBand> {
  return Object.fromEntries(
    Object.entries(TIER1).map(([bucket, band]) => [
      bucket,
      {
        p25: Math.round(band.p25 * multiplier),
        p50: Math.round(band.p50 * multiplier),
        p75: Math.round(band.p75 * multiplier),
      },
    ])
  ) as Record<RoleBucket, CompBand>
}

export const COMP_BANDS: Record<LocationTier, Record<RoleBucket, CompBand>> = {
  tier1: TIER1,
  tier2: scaleBands(0.8),
  tier3: scaleBands(0.65),
  remote: scaleBands(0.8),
}

function roleBucket(roleTitle: string): RoleBucket {
  const title = roleTitle.toLowerCase()
  if (/principal|distinguished/.test(title)) return title.includes('engineer') ? 'swe_principal' : 'default'
  if (/staff/.test(title)) {
    if (/engineer|swe/.test(title)) return 'swe_staff'
    if (/pm|product/.test(title)) return 'pm_staff'
    return 'default'
  }
  if (/director/.test(title)) return 'em_director'
  if (/engineering manager|eng manager/.test(title)) return 'em_l5'
  if (/senior|sr\.?/.test(title)) {
    if (/engineer|swe|developer/.test(title)) return 'swe_ic5'
    if (/pm|product/.test(title)) return 'pm_ic5'
    if (/data/.test(title)) return 'ds_ic5'
    if (/design|ux|ui/.test(title)) return 'design_ic5'
  }
  if (/engineer|swe|dev|developer/.test(title)) return 'swe_ic4'
  if (/product manager|pm/.test(title)) return 'pm_ic4'
  if (/data scientist|data science/.test(title)) return 'ds_ic4'
  if (/design|ux|ui/.test(title)) return 'design_ic4'
  return 'default'
}

export function lookupCompBand(roleTitle: string, locationTier: LocationTier): CompBand {
  return COMP_BANDS[locationTier][roleBucket(roleTitle)]
}

export function isLocationTier(value: unknown): value is LocationTier {
  return value === 'tier1' || value === 'tier2' || value === 'tier3' || value === 'remote'
}
