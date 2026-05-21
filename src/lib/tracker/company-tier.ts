const FAANG = new Set(['google', 'meta', 'facebook', 'amazon', 'apple', 'microsoft', 'netflix'])

const LARGE_TECH = new Set([
  'salesforce',
  'oracle',
  'ibm',
  'adobe',
  'uber',
  'airbnb',
  'lyft',
  'doordash',
  'stripe',
  'databricks',
  'snowflake',
  'coinbase',
  'robinhood',
  'linkedin',
  'intuit',
  'atlassian',
  'dropbox',
  'pinterest',
  'nvidia',
  'tesla',
])

const MID_MARKET = new Set([
  'rippling',
  'plaid',
  'figma',
  'notion',
  'linear',
  'brex',
  'ramp',
  'gusto',
  'zapier',
  'asana',
  'mongodb',
  'confluent',
  'hashicorp',
  'elastic',
])

export type CompanyTier = 'faang' | 'large' | 'mid' | 'startup'

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function getCompanyTier(name: string): CompanyTier {
  const normalized = normalizeCompanyName(name)
  const tokens = normalized.split(/\s+/).filter(Boolean)

  if (FAANG.has(normalized) || tokens.some(token => FAANG.has(token))) return 'faang'
  if (LARGE_TECH.has(normalized) || tokens.some(token => LARGE_TECH.has(token))) return 'large'
  if (MID_MARKET.has(normalized) || tokens.some(token => MID_MARKET.has(token))) return 'mid'
  return 'startup'
}
