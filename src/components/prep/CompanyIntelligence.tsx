'use client'

import type { CompanyProfile } from '@/lib/jobs/types'

interface CompanyIntelligenceProps {
  company: CompanyProfile
  enriching?: boolean
}

export function CompanyIntelligence({ company, enriching = false }: CompanyIntelligenceProps) {
  const glassdoorUrl = `https://www.glassdoor.com/Search/Results.htm?keyword=${encodeURIComponent(company.name)}`
  const linkedinUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company.name)}`

  const hasContent = company.description || company.mission || (company.notable_products?.length ?? 0) > 0

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Company</h2>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-100">{company.name}</p>
          <div className="flex items-center gap-3 shrink-0">
            {company.website_url && (
              <a
                href={company.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Website →
              </a>
            )}
            <a
              href={glassdoorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Glassdoor →
            </a>
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              LinkedIn →
            </a>
          </div>
        </div>

        {/* Intelligence body */}
        {enriching && !hasContent ? (
          <div className="px-4 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5 text-zinc-600 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-xs text-zinc-600">Gathering company intelligence…</span>
            </div>
            <div className="space-y-2">
              {[80, 65, 90].map((w, i) => (
                <div key={i} className={`h-3 rounded bg-zinc-800/70 animate-pulse`} style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ) : hasContent ? (
          <div className="px-4 py-3 space-y-3">
            {/* Mission */}
            {company.mission && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-zinc-500">Mission</p>
                <p className="text-xs text-zinc-300 leading-relaxed italic">&ldquo;{company.mission}&rdquo;</p>
              </div>
            )}

            {/* Description */}
            {company.description && (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-zinc-500">About</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{company.description}</p>
              </div>
            )}

            {/* Notable products */}
            {company.notable_products && company.notable_products.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-zinc-500">What they&apos;re building</p>
                <div className="flex flex-wrap gap-1.5">
                  {company.notable_products.map(p => (
                    <span key={p} className="text-xs px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-xs text-zinc-600">No company data available yet.</p>
          </div>
        )}

        {/* Meta strip */}
        {(company.headcount_range || (company.funding_stage && company.funding_stage !== 'Unknown') || (company.tech_stack?.length ?? 0) > 0) && (
          <div className="px-4 py-3 space-y-2">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {company.headcount_range && (
                <span className="text-xs text-zinc-500">👥 {company.headcount_range} employees</span>
              )}
              {company.funding_stage && company.funding_stage !== 'Unknown' && (
                <span className="text-xs text-zinc-500">💼 {company.funding_stage}</span>
              )}
            </div>
            {company.tech_stack && company.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {company.tech_stack.map(t => (
                  <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
