// Curated list of tech companies with their ATS portal slugs.
// Greenhouse API: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
// Lever API:      https://api.lever.co/v0/postings/{slug}
//
// These are all public APIs — no auth required.
// Add new companies by appending to the list; invalid slugs return 404 and are skipped gracefully.

export interface PortalCompany {
  name: string
  greenhouseSlug?: string
  leverSlug?: string
}

export const PORTAL_COMPANIES: PortalCompany[] = [
  // AI / ML
  { name: 'Anthropic',      leverSlug: 'anthropic' },
  { name: 'OpenAI',         leverSlug: 'openai' },
  { name: 'Cohere',         leverSlug: 'cohere' },
  { name: 'Perplexity AI',  greenhouseSlug: 'perplexityai' },
  { name: 'Character.AI',   leverSlug: 'character' },
  { name: 'ElevenLabs',     leverSlug: 'elevenlabs' },
  { name: 'Runway',         leverSlug: 'runwayml' },
  { name: 'Harvey',         leverSlug: 'harvey' },
  { name: 'Weights & Biases', leverSlug: 'wandb' },
  { name: 'Hugging Face',   leverSlug: 'huggingface' },
  { name: 'Scale AI',       greenhouseSlug: 'scaleai' },

  // Dev tools / infra
  { name: 'Vercel',         leverSlug: 'vercel' },
  { name: 'Netlify',        leverSlug: 'netlify' },
  { name: 'Cloudflare',     leverSlug: 'cloudflare' },
  { name: 'Fastly',         greenhouseSlug: 'fastly' },
  { name: 'Databricks',     greenhouseSlug: 'databricks' },
  { name: 'Retool',         leverSlug: 'retool' },
  { name: 'Linear',         leverSlug: 'linear' },

  // Fintech
  { name: 'Stripe',         leverSlug: 'stripe' },
  { name: 'Brex',           leverSlug: 'brex' },
  { name: 'Ramp',           leverSlug: 'ramp' },
  { name: 'Rippling',       leverSlug: 'rippling' },
  { name: 'Mercury',        leverSlug: 'mercury' },
  { name: 'Plaid',          leverSlug: 'plaid' },

  // Productivity / collaboration
  { name: 'Notion',         leverSlug: 'notion' },
  { name: 'Airtable',       leverSlug: 'airtable' },
  { name: 'Figma',          leverSlug: 'figma' },
  { name: 'Loom',           leverSlug: 'loom' },

  // Defense / hard tech
  { name: 'Anduril',        leverSlug: 'anduril' },

  // Enterprise / data
  { name: 'Palantir',       leverSlug: 'palantir' },
  { name: 'Snowflake',      greenhouseSlug: 'snowflake' },
]
