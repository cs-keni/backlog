'use client'

import { useState, useEffect } from 'react'

interface MaterialsSectionProps {
  jobId: string
}

interface ResumeVersion {
  id: string
  pdf_url: string
  created_at: string
}

interface CoverLetter {
  id: string
  template_type: string
  created_at: string
}

export function MaterialsSection({ jobId }: MaterialsSectionProps) {
  const [resume, setResume] = useState<ResumeVersion | null>(null)
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/resume/tailor?job_id=${jobId}`).then(r => r.json()),
      fetch(`/api/cover-letter?job_id=${jobId}`).then(r => r.json()),
    ])
      .then(([rv, cl]) => {
        setResume(rv?.pdf_url ? rv as ResumeVersion : null)
        setCoverLetter(cl?.id ? cl as CoverLetter : null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [jobId])

  if (loading) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Materials</h2>
        <div className="flex gap-3">
          {[0, 1].map(i => (
            <div key={i} className="flex-1 h-16 rounded-lg bg-zinc-800/50 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Materials</h2>
      <div className="flex gap-3">
        {/* Resume card */}
        <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="text-xs font-medium text-zinc-300">Tailored Resume</span>
          </div>
          {resume ? (
            <a
              href={resume.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Download PDF →
            </a>
          ) : (
            <p className="text-xs text-zinc-600">Not generated yet</p>
          )}
        </div>

        {/* Cover letter card */}
        <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span className="text-xs font-medium text-zinc-300">Cover Letter</span>
          </div>
          {coverLetter ? (
            <a
              href={`/api/cover-letter/${coverLetter.id}/pdf`}
              download="cover-letter.pdf"
              className="block text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Download PDF →
            </a>
          ) : (
            <p className="text-xs text-zinc-600">Not generated yet</p>
          )}
        </div>
      </div>
      {!resume && !coverLetter && (
        <p className="text-xs text-zinc-600">
          Generate a tailored resume and cover letter from the job detail panel first.
        </p>
      )}
    </section>
  )
}
