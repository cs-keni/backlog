import { useState, useEffect } from 'react'
import { generateCoverLetter, suggestProjects, downloadCoverLetterPdf, downloadTailoredResumePdf } from '../shared/api'
import type { HandshakeJobData } from '../shared/types'
import { BACKLOG_URL } from '../shared/config'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectSuggestion {
  projectId:  string
  name:       string
  rank:       number
  relevance:  string
  swapReason: string
}

type PanelStep =
  | 'idle'
  | 'generating-cl'
  | 'cl-ready'
  | 'suggesting-projects'
  | 'projects-ready'

// ─── Component ────────────────────────────────────────────────────────────────

export function HandshakePanel({ tabId }: { tabId: number }) {
  const [jobData, setJobData] = useState<HandshakeJobData | null>(null)
  const [scrapeTimedOut, setScrapeTimedOut] = useState(false)
  const [step, setStep] = useState<PanelStep>('idle')
  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [specialInstructions, setSpecialInstructions] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [downloadingCl, setDownloadingCl] = useState(false)
  const [downloadingResume, setDownloadingResume] = useState(false)

  // Poll GET_HANDSHAKE_JOB_DATA every 2s until data arrives.
  // More reliable than onChanged which can silently miss events in sidebar context.
  useEffect(() => {
    if (!tabId || jobData) return
    let cancelled = false

    const poll = () => {
      if (cancelled) return
      chrome.runtime.sendMessage({ type: 'GET_HANDSHAKE_JOB_DATA' }, (res) => {
        if (cancelled || chrome.runtime.lastError) return
        const data = (res as { handshakeContext?: HandshakeJobData | null } | undefined)?.handshakeContext
        if (data) {
          setJobData(data)
        } else {
          setTimeout(poll, 2000)
        }
      })
    }

    // Immediate check, then every 2s
    poll()
    return () => { cancelled = true }
  }, [tabId, jobData])

  // If no job data arrives within 20s show a hint instead of spinning forever
  useEffect(() => {
    if (jobData) return
    const t = setTimeout(() => setScrapeTimedOut(true), 20000)
    return () => clearTimeout(t)
  }, [jobData])

  async function handleGenerateCoverLetter() {
    if (!jobData) return
    setStep('generating-cl')
    setError(null)
    setCoverLetter(null)

    const res = await generateCoverLetter({
      jobTitle:       jobData.jobTitle ?? 'Unknown role',
      company:        jobData.company ?? 'Unknown company',
      jobDescription: jobData.description ?? '',
    })

    if ('error' in res) {
      setError(res.error)
      setStep('idle')
    } else {
      setCoverLetter(res.coverLetterBody)
      setSpecialInstructions(res.specialInstructions ?? [])
      setStep('cl-ready')
    }
  }

  async function handleSuggestProjects() {
    if (!jobData) return
    setStep('suggesting-projects')
    setError(null)
    setProjects([])

    const res = await suggestProjects({
      jobTitle:       jobData.jobTitle ?? 'Unknown role',
      company:        jobData.company ?? 'Unknown company',
      jobDescription: jobData.description ?? '',
      maxProjects:    3,
    })

    if ('error' in res) {
      setError(res.error)
      setStep('idle')
    } else {
      setProjects(res.suggestions)
      setStep('projects-ready')
    }
  }

  function triggerPdfDownload(buffer: ArrayBuffer, filename: string) {
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function handleDownloadCoverLetter() {
    if (!jobData || !coverLetter) return
    setDownloadingCl(true)
    setError(null)
    try {
      const buffer = await downloadCoverLetterPdf({
        jobTitle:        jobData.jobTitle ?? 'Unknown role',
        company:         jobData.company ?? 'Unknown company',
        coverLetterBody: coverLetter,
      })
      triggerPdfDownload(buffer, `Cover_Letter_${(jobData.company ?? 'Company').replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloadingCl(false)
    }
  }

  async function handleDownloadResume() {
    if (!jobData || !projects.length) return
    setDownloadingResume(true)
    setError(null)
    try {
      const buffer = await downloadTailoredResumePdf({
        jobTitle:       jobData.jobTitle ?? 'Unknown role',
        company:        jobData.company ?? 'Unknown company',
        jobDescription: jobData.description ?? '',
        suggestions:    projects,
      })
      triggerPdfDownload(buffer, `Resume_${(jobData.company ?? 'Company').replace(/\s+/g, '_')}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloadingResume(false)
    }
  }

  function copyToClipboard() {
    if (!coverLetter) return
    navigator.clipboard.writeText(coverLetter).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const isLoading = step === 'generating-cl' || step === 'suggesting-projects'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Handshake header badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '8px',
        border: '1px solid rgba(251, 191, 36, 0.25)',
        background: 'rgba(251, 191, 36, 0.06)',
        padding: '8px 10px',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M2 8.5L5.5 5 7 6.5 9 4.5 12 7.5" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7" cy="3" r="1.5" fill="#fbbf24" />
        </svg>
        <span style={{ fontSize: '11px', color: '#fcd34d', fontWeight: 500 }}>
          Handshake job detected
        </span>
      </div>

      {/* Job info */}
      {jobData ? (
        <JobInfoCard jobData={jobData} />
      ) : (
        <div style={{
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '12px',
          color: '#71717a',
        }}>
          {scrapeTimedOut
            ? 'Refresh this tab to detect the job (the extension was reloaded).'
            : 'Scraping job details…'}
        </div>
      )}

      {/* Easter egg / special instructions banner */}
      {specialInstructions.length > 0 && (
        <SpecialInstructionsBanner instructions={specialInstructions} />
      )}

      {/* Error display */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          padding: '8px 10px',
          fontSize: '11px',
          color: '#f87171',
        }}>
          {error}
        </div>
      )}

      {/* Cover letter section */}
      {step !== 'projects-ready' && (
        <button
          onClick={handleGenerateCoverLetter}
          disabled={!jobData || isLoading}
          style={primaryButtonStyle(!jobData || isLoading)}
        >
          {step === 'generating-cl' ? (
            <><Spinner />Generating cover letter…</>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 2h8a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-8a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 4.5h5M4 6.5h5M4 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Generate cover letter
            </>
          )}
        </button>
      )}

      {step === 'cl-ready' && coverLetter && (
        <CoverLetterResult
          text={coverLetter}
          copied={copied}
          onCopy={copyToClipboard}
          onRegenerate={handleGenerateCoverLetter}
          onShowProjects={handleSuggestProjects}
          onDownloadCl={handleDownloadCoverLetter}
          downloadingCl={downloadingCl}
          isLoading={isLoading}
        />
      )}

      {/* Project suggestions section */}
      {step !== 'cl-ready' && (
        <button
          onClick={handleSuggestProjects}
          disabled={!jobData || isLoading}
          style={secondaryButtonStyle(!jobData || isLoading)}
        >
          {step === 'suggesting-projects' ? (
            <><Spinner />Picking projects…</>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="1.5" y="1.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
                <rect x="7.5" y="1.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
                <rect x="1.5" y="7.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" />
                <rect x="7.5" y="7.5" width="4" height="4" rx="0.75" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
              </svg>
              Suggest resume projects
            </>
          )}
        </button>
      )}

      {step === 'projects-ready' && projects.length > 0 && (
        <ProjectSuggestionsResult
          projects={projects}
          onRegenerate={handleSuggestProjects}
          onShowCL={handleGenerateCoverLetter}
          onDownloadResume={handleDownloadResume}
          downloadingResume={downloadingResume}
          isLoading={isLoading}
        />
      )}

      {/* Settings link */}
      <a
        href={`${BACKLOG_URL}/settings`}
        target="_blank"
        rel="noreferrer"
        style={{
          fontSize: '10px',
          color: '#52525b',
          textDecoration: 'none',
          textAlign: 'center',
          paddingTop: '4px',
        }}
      >
        Manage cover letter style & projects →
      </a>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function JobInfoCard({ jobData }: { jobData: HandshakeJobData }) {
  const hasDesc = jobData.description && jobData.description.length > 10
  return (
    <div style={{
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: '8px',
      padding: '10px 12px',
    }}>
      {jobData.jobTitle && (
        <p style={{ fontSize: '12px', fontWeight: 500, color: '#f4f4f5', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {jobData.jobTitle}
        </p>
      )}
      {jobData.company && (
        <p style={{ fontSize: '11px', color: '#71717a', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {jobData.company}
        </p>
      )}
      {hasDesc ? (
        <p style={{ fontSize: '10px', color: '#52525b', margin: 0 }}>
          {jobData.description!.slice(0, 80).trim()}…
        </p>
      ) : (
        <p style={{ fontSize: '10px', color: '#3f3f46', margin: 0 }}>
          No job description found
        </p>
      )}
    </div>
  )
}

function SpecialInstructionsBanner({ instructions }: { instructions: string[] }) {
  return (
    <div style={{
      background: 'rgba(251, 146, 60, 0.07)',
      border: '1px solid rgba(251, 146, 60, 0.35)',
      borderRadius: '8px',
      padding: '9px 11px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        {/* Warning triangle */}
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6.5 1.5L12 11.5H1L6.5 1.5Z" stroke="#fb923c" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M6.5 5.5v3" stroke="#fb923c" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="6.5" cy="9.5" r="0.6" fill="#fb923c" />
        </svg>
        <span style={{ fontSize: '10px', fontWeight: 600, color: '#fb923c', letterSpacing: '0.02em' }}>
          EASTER EGG DETECTED
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {instructions.map((inst, i) => (
          <div key={i} style={{
            display: 'flex', gap: '6px', alignItems: 'flex-start',
          }}>
            <span style={{ color: '#fb923c', fontSize: '10px', flexShrink: 0, marginTop: '1px' }}>→</span>
            <span style={{ fontSize: '11px', color: '#fdba74', lineHeight: 1.5 }}>{inst}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CoverLetterResult({
  text, copied, onCopy, onRegenerate, onShowProjects, onDownloadCl, downloadingCl, isLoading,
}: {
  text: string
  copied: boolean
  onCopy: () => void
  onRegenerate: () => void
  onShowProjects: () => void
  onDownloadCl: () => void
  downloadingCl: boolean
  isLoading: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #27272a' }}>
          <span style={{ fontSize: '10px', color: '#71717a', fontWeight: 500 }}>Cover letter body</span>
          <button
            onClick={onCopy}
            style={{
              background: copied ? 'rgba(52, 211, 153, 0.1)' : 'transparent',
              border: `1px solid ${copied ? 'rgba(52, 211, 153, 0.3)' : '#3f3f46'}`,
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '10px',
              color: copied ? '#34d399' : '#a1a1aa',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <textarea
          readOnly
          value={text}
          style={{
            width: '100%',
            height: '180px',
            background: 'transparent',
            border: 'none',
            padding: '10px',
            fontSize: '11px',
            color: '#d4d4d8',
            lineHeight: '1.6',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
      {/* Download PDF — full width, prominent */}
      <button
        onClick={onDownloadCl}
        disabled={downloadingCl || isLoading}
        style={primaryButtonStyle(downloadingCl || isLoading)}
      >
        {downloadingCl ? (
          <><Spinner />Building PDF…</>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 2v7M3.5 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Download cover letter PDF
          </>
        )}
      </button>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onRegenerate} disabled={isLoading} style={{ ...secondaryButtonStyle(isLoading), flex: 1, padding: '7px' }}>
          Regenerate
        </button>
        <button onClick={onShowProjects} disabled={isLoading} style={{ ...secondaryButtonStyle(isLoading), flex: 1, padding: '7px' }}>
          {isLoading ? <Spinner /> : null}
          Suggest projects
        </button>
      </div>
    </div>
  )
}

function ProjectSuggestionsResult({
  projects, onRegenerate, onShowCL, onDownloadResume, downloadingResume, isLoading,
}: {
  projects: ProjectSuggestion[]
  onRegenerate: () => void
  onShowCL: () => void
  onDownloadResume: () => void
  downloadingResume: boolean
  isLoading: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #27272a' }}>
          <span style={{ fontSize: '10px', color: '#71717a', fontWeight: 500 }}>Recommended resume projects</span>
        </div>
        <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {projects.map((p) => (
            <div key={p.projectId} style={{
              padding: '8px 10px',
              background: '#09090b',
              border: '1px solid #27272a',
              borderRadius: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: '#6366f1',
                  background: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '99px',
                  padding: '1px 5px',
                  flexShrink: 0,
                }}>
                  #{p.rank}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#f4f4f5' }}>{p.name}</span>
              </div>
              <p style={{ fontSize: '10px', color: '#a1a1aa', margin: '0 0 3px', lineHeight: 1.5 }}>
                {p.relevance}
              </p>
              <p style={{ fontSize: '10px', color: '#6366f1', margin: 0, lineHeight: 1.5 }}>
                ↳ {p.swapReason}
              </p>
            </div>
          ))}
        </div>
      </div>
      {/* Download tailored resume — full width, prominent */}
      <button
        onClick={onDownloadResume}
        disabled={downloadingResume || isLoading}
        style={primaryButtonStyle(downloadingResume || isLoading)}
      >
        {downloadingResume ? (
          <><Spinner />Building resume…</>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 2v7M3.5 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1.5 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Download tailored resume PDF
          </>
        )}
      </button>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onRegenerate} disabled={isLoading} style={{ ...secondaryButtonStyle(isLoading), flex: 1, padding: '7px' }}>
          Regenerate
        </button>
        <button onClick={onShowCL} disabled={isLoading} style={{ ...secondaryButtonStyle(isLoading), flex: 1, padding: '7px' }}>
          {isLoading ? <Spinner /> : null}
          Generate CL
        </button>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span className="bl-spin" style={{
      display: 'inline-block', width: '11px', height: '11px',
      border: '1.5px solid #3f3f46', borderTopColor: '#6366f1', borderRadius: '50%',
    }} />
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '10px',
    background: disabled ? '#18181b' : '#4f46e5',
    color: disabled ? '#52525b' : '#fff',
    border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  }
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '8px',
    background: 'transparent',
    color: disabled ? '#3f3f46' : '#a1a1aa',
    border: `1px solid ${disabled ? '#27272a' : '#3f3f46'}`,
    borderRadius: '8px',
    fontSize: '12px', fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
  }
}
