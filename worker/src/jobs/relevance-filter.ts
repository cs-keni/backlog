import type { RawJobEntry } from '../github/parser'
import type { NormalizedJob } from '../llm/normalizer'

// ─── Title blocklists ─────────────────────────────────────────────────────────

// Exact-phrase patterns that disqualify a role regardless of other context.
// Checked against lowercase title.
const BLOCKED_TITLE_PATTERNS: RegExp[] = [
  // Degree gating
  /\bphd\b/,
  /\bph\.d\b/,
  /\bdoctorate\b/,
  /\bpostdoc(toral)?\b/,

  // Non-CS business roles
  /\baccount\s+executive\b/,
  /\baccount\s+manager\b/,
  /\baccount\s+leader\b/,
  /\bsales\b/,
  /\bproduct\s+marketing\b/,
  /\bmarketing\s+(manager|specialist|analyst|coordinator|director)\b/,
  /\bgrowth\s+marketing\b/,
  /\bbrand\s+(manager|strategist)\b/,
  /\bbusiness\s+(operations|ops)\s*(manager|analyst|lead)?\b/,
  /\bassistant\s+controller\b/,
  /\bcontroller\b/,
  /\baccounting\b/,
  /\bfinance\s+(analyst|manager|director)\b/,
  /\bfinancial\s+(analyst|planning|advisor)\b/,
  /\brecruiter\b/,
  /\btalent\s+(acquisition|sourcer|partner)\b/,
  /\bhuman\s+resources?\b/,
  /\b\bhr\s+(manager|generalist|business\s+partner)\b/,
  /\blegal\s+(counsel|advisor|analyst)\b/,
  /\bparalegal\b/,
  /\badministrative\s+assistant\b/,
  /\bexecutive\s+assistant\b/,
  /\bcustomer\s+success\b/,
  /\bcustomer\s+support\b/,
  /\bcustomer\s+service\b/,
  /\bsupply\s+chain\b/,
  /\boperations\s+analyst\b/,
  /\bbusiness\s+analyst\b/,   // not a CS role; distinct from "data analyst" or "software engineer"
  /\bproduct\s+manager\b/,
  /\bprogram\s+manager\b/,
  /\btechnical\s+program\s+manager\b/,
  /\btpm\b/,

  // Seniority ceiling — entry-level only (≤3 years experience)
  /\bsenior\b/,
  /\bsr\.\s*(software|engineer|swe|developer|ml)\b/,
  /\blead\s+(software|engineer|swe|developer|ml|data|platform|security|mobile)\b/,
  /\b(software|engineer|swe|developer|ml|data|platform)\s+lead\b/,
  /\btech(nical)?\s+lead\b/,
  /\bstaff\b/,
  /\bprincipal\b/,
  /\bengineering\s+manager\b/,
  /\barchitect\b/,
  /\bmid[-\s]?level\b/,
  /\b(software|engineer|swe|sde|developer)\b.*\b(ii|iii|iv|v|2|3|4|5)\b/,
  /\b(ii|iii|iv|v|2|3|4|5)\b.*\b(software|engineer|swe|sde|developer)\b/,
  /\blevel\s*[2-9]\b/,
  /\bvp\s+of\b/,
  /\bvice\s+president\b/,
  /\bdirector\s+of\b/,
  /\bhead\s+of\b/,
  /\bchief\s+(technology|product|operating|executive|financial)\b/,
  /\bcto\b/,
  /\bcoo\b/,
  /\bcfo\b/,
  /\bceo\b/,

  // Internships (stray portal entries now that the source is removed)
  /\bintern(ship)?\b/,
  /\bco[-\s]?op\b/,
  /\bcooperative\s+education\b/,

  // ML/data/research roles are intentionally excluded. AI software engineering
  // titles are allowed below, but machine-learning roles tend to be a different
  // search track with different requirements.
  /\bmachine\s+learning\b/,
  /\bml\s+(engineer|scientist|researcher|developer)\b/,
  /\b(ml|machine\s+learning)\b.*\b(engineer|scientist|researcher)\b/,
  /\bdeep\s+learning\b/,
  /\bdata\s+scientist\b/,
  /\bdata\s+science\b/,
  /\bresearch\s+(scientist|engineer|researcher)\b/,
  /\bscientist\b/,
  /\bcomputer\s+vision\b/,
  /\bnatural\s+language\s+processing\b/,
  /\bnlp\b/,
  /\bperception\b/,
]

// Positive title gate: only software engineering tracks should enter the feed.
// Generic SWE titles are kept because the New-Grad source is already scoped, and
// many entry-level portals omit "junior" from otherwise valid titles.
const SOFTWARE_ENGINEERING_TITLE_PATTERNS: RegExp[] = [
  /\bsoftware\s+(engineer|developer)\b/,
  /\b(swe|sde)\b/,
  /\b(front[-\s]?end|frontend|back[-\s]?end|backend|full[-\s]?stack|fullstack|web)\s+(engineer|developer)\b/,
  /\b(engineer|developer)\b.*\b(front[-\s]?end|frontend|back[-\s]?end|backend|full[-\s]?stack|fullstack|web)\b/,
  /\bmobile\s+(engineer|developer)\b/,
  /\b(ios|android)\s+(engineer|developer)\b/,
  /\bplatform\s+engineer\b/,
  /\binfrastructure\s+engineer\b/,
  /\bdevops\s+engineer\b/,
  /\bsite\s+reliability\s+engineer\b/,
  /\bsre\b/,
  /\bqa\s+automation\s+engineer\b/,
  /\btest\s+automation\s+engineer\b/,

  // AI engineering is in scope when it is framed as engineering/product
  // software work, not ML research/science.
  /\b(ai|artificial\s+intelligence|generative\s+ai|genai|llm)\s+(software\s+)?engineer\b/,
  /\b(applied\s+ai|ai\s+product)\s+engineer\b/,
  /\b(software|swe|sde)\b.*\b(ai|artificial\s+intelligence|generative\s+ai|genai|llm)\b/,
  /\b(ai|artificial\s+intelligence|generative\s+ai|genai|llm)\b.*\b(software|swe|sde)\b/,
]

// ─── Location blocklist ───────────────────────────────────────────────────────

// Keywords that indicate a clearly non-US location when found in the location string.
// We keep "Remote" and blank/unknown (default US) — only block explicit foreign cities/countries.
const NON_US_LOCATION_PATTERNS: RegExp[] = [
  /\b(united\s+kingdom|uk)\b/i,
  /\b(london|manchester|edinburgh|birmingham|bristol)\b/i,
  /\bcanada\b/i,
  /\b(toronto|vancouver|montreal|calgary|ottawa)\b/i,
  /\bgermany\b/i,
  /\b(berlin|munich|hamburg|frankfurt)\b/i,
  /\bfrance\b/i,
  /\bparis\b/i,
  /\baustralia\b/i,
  /\b(sydney|melbourne|brisbane)\b/i,
  /\bsingapore\b/i,
  /\bindia\b/i,
  /\b(bangalore|bengaluru|mumbai|hyderabad|pune|delhi|chennai)\b/i,
  /\bnetherlands\b/i,
  /\b(amsterdam)\b/i,
  /\bsweden\b/i,
  /\b(stockholm)\b/i,
  /\bdenmark\b/i,
  /\b(copenhagen)\b/i,
  /\bireland\b/i,
  /\bdublin\b/i,
  /\bisrael\b/i,
  /\btel\s+aviv\b/i,
  /\bjapan\b/i,
  /\btokyo\b/i,
  /\bchina\b/i,
  /\b(beijing|shanghai|shenzhen)\b/i,
  /\bbrazil\b/i,
  /\bsao\s+paulo\b/i,
  /\bmexico\b/i,
  /\bpoland\b/i,
  /\bwarsaw\b/i,
  /\bromania\b/i,
  /\bbucharest\b/i,
]

// ─── Core filter logic ────────────────────────────────────────────────────────

function isTitleBlocked(title: string): boolean {
  const lower = title.toLowerCase()
  return BLOCKED_TITLE_PATTERNS.some(re => re.test(lower))
}

function isSoftwareEngineeringTitle(title: string): boolean {
  const lower = title.toLowerCase()
  return SOFTWARE_ENGINEERING_TITLE_PATTERNS.some(re => re.test(lower))
}

function isLocationNonUS(location: string): boolean {
  if (!location) return false
  // "Remote" or empty → assume US
  if (/^remote$/i.test(location.trim())) return false
  return NON_US_LOCATION_PATTERNS.some(re => re.test(location))
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Pre-normalization filter for GitHub-sourced raw entries.
// Runs before the GPT normalization step to avoid burning tokens on ineligible jobs.
export function filterRelevantEntries(entries: RawJobEntry[]): RawJobEntry[] {
  const before = entries.length
  const filtered = entries.filter(e => {
    if (isTitleBlocked(e.title)) return false
    if (!isSoftwareEngineeringTitle(e.title)) return false
    if (isLocationNonUS(e.location)) return false
    return true
  })
  const dropped = before - filtered.length
  if (dropped > 0) {
    console.log(`[relevance-filter] Dropped ${dropped}/${before} raw entries (non-qualifying title or non-US location)`)
  }
  return filtered
}

// Post-dedup filter for portal-sourced NormalizedJob[].
// Runs after deduplication, before enrichJobs, to skip enrichment calls on ineligible jobs.
export function filterRelevantJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const before = jobs.length
  const filtered = jobs.filter(j => {
    if (isTitleBlocked(j.title)) return false
    if (!isSoftwareEngineeringTitle(j.title)) return false
    if (j.experience_level === 'mid' || j.experience_level === 'senior') return false
    // For normalized jobs prefer the country field; fall back to location string
    if (j.country && j.country !== 'United States') return false
    if (!j.country && isLocationNonUS(j.location ?? '')) return false
    return true
  })
  const dropped = before - filtered.length
  if (dropped > 0) {
    console.log(`[relevance-filter] Dropped ${dropped}/${before} normalized jobs (non-qualifying title or non-US location)`)
  }
  return filtered
}
