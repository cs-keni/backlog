import { useState, useEffect } from 'react'
import {
  generateCoverLetter, suggestProjects, summarizeJob,
  downloadCoverLetterPdf, downloadTailoredResumePdf,
  type JobSummary,
} from '../shared/api'
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
  const [jobData, setJobData]               = useState<HandshakeJobData | null>(null)
  const [summary, setSummary]               = useState<JobSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [scrapeTimedOut, setScrapeTimedOut] = useState(false)
  const [step, setStep]                     = useState<PanelStep>('idle')
  const [coverLetter, setCoverLetter]       = useState<string | null>(null)
  const [projects, setProjects]             = useState<ProjectSuggestion[]>([])
  const [error, setError]                   = useState<string | null>(null)
  const [specialInstructions, setSpecialInstructions] = useState<string[]>([])
  const [copied, setCopied]                 = useState(false)
  const [downloadingCl, setDownloadingCl]   = useState(false)
  const [downloadingResume, setDownloadingResume] = useState(false)

  // Poll GET_HANDSHAKE_JOB_DATA every 2s until data arrives
  useEffect(() => {
    if (!tabId || jobData) return
    let cancelled = false
    const poll = () => {
      if (cancelled) return
      chrome.runtime.sendMessage({ type: 'GET_HANDSHAKE_JOB_DATA' }, (res) => {
        if (cancelled || chrome.runtime.lastError) return
        const data = (res as { handshakeContext?: HandshakeJobData | null } | undefined)?.handshakeContext
        if (data) setJobData(data)
        else setTimeout(poll, 2000)
      })
    }
    poll()
    return () => { cancelled = true }
  }, [tabId, jobData])

  // Auto-summarize once job data + description arrive
  useEffect(() => {
    if (!jobData?.description || summary || summaryLoading) return
    setSummaryLoading(true)
    summarizeJob({
      jobTitle:       jobData.jobTitle ?? 'Unknown',
      company:        jobData.company ?? 'Unknown',
      jobDescription: jobData.description,
    }).then((s) => {
      setSummary(s)
      setSummaryLoading(false)
    })
  }, [jobData, summary, summaryLoading])

  // 20s timeout if no job data arrives
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
    a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  async function handleDownloadCoverLetter() {
    if (!jobData || !coverLetter) return
    setDownloadingCl(true); setError(null)
    try {
      const buf = await downloadCoverLetterPdf({
        jobTitle:        jobData.jobTitle ?? 'Unknown role',
        company:         jobData.company ?? 'Unknown company',
        coverLetterBody: coverLetter,
      })
      triggerPdfDownload(buf, `Cover_Letter_${(jobData.company ?? 'Company').replace(/\s+/g, '_')}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally { setDownloadingCl(false) }
  }

  async function handleDownloadResume() {
    if (!jobData || !projects.length) return
    setDownloadingResume(true); setError(null)
    try {
      const buf = await downloadTailoredResumePdf({
        jobTitle:       jobData.jobTitle ?? 'Unknown role',
        company:        jobData.company ?? 'Unknown company',
        jobDescription: jobData.description ?? '',
        suggestions:    projects,
      })
      triggerPdfDownload(buf, `Resume_${(jobData.company ?? 'Company').replace(/\s+/g, '_')}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally { setDownloadingResume(false) }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '2px 0' }}>
      {/* Header badge */}
      <HandshakeBadge />

      {/* Job card */}
      {jobData ? (
        <JobCard jobData={jobData} summary={summary} summaryLoading={summaryLoading} />
      ) : (
        <EmptyJobCard timedOut={scrapeTimedOut} />
      )}

      {/* Easter egg banner */}
      {specialInstructions.length > 0 && (
        <EasterEggBanner instructions={specialInstructions} />
      )}

      {/* Error */}
      {error && <ErrorBubble message={error} />}

      {/* Actions */}
      {step !== 'projects-ready' && (
        <ActionButton
          onClick={handleGenerateCoverLetter}
          disabled={!jobData || isLoading}
          loading={step === 'generating-cl'}
          loadingLabel="Generating cover letter…"
          icon={<PenIcon />}
          label="Generate cover letter"
          variant="primary"
        />
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

      {step !== 'cl-ready' && (
        <ActionButton
          onClick={handleSuggestProjects}
          disabled={!jobData || isLoading}
          loading={step === 'suggesting-projects'}
          loadingLabel="Picking projects…"
          icon={<GridIcon />}
          label="Suggest resume projects"
          variant="secondary"
        />
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
          color: '#3f3f46',
          textDecoration: 'none',
          textAlign: 'center',
          paddingTop: '2px',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#71717a' }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#3f3f46' }}
      >
        Manage cover letter style & projects →
      </a>
    </div>
  )
}

// ─── Header badge ─────────────────────────────────────────────────────────────

function HandshakeBadge() {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      alignSelf: 'flex-start',
      padding: '5px 12px 5px 9px',
      borderRadius: '99px',
      background: 'linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(251,191,36,0.07) 100%)',
      border: '1px solid rgba(251,191,36,0.28)',
      boxShadow: '0 0 12px rgba(251,191,36,0.08)',
    }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
        <path d="M6 1l1.2 3.8H11L8 7l1.2 3.8L6 8.8 2.8 10.8 4 7 1 4.8h3.8z" fill="#fbbf24" />
      </svg>
      <span style={{ fontSize: '10.5px', color: '#fcd34d', fontWeight: 600, letterSpacing: '0.01em' }}>
        Handshake
      </span>
    </div>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ jobData, summary, summaryLoading }: {
  jobData: HandshakeJobData
  summary: JobSummary | null
  summaryLoading: boolean
}) {
  const hasDesc = jobData.description && jobData.description.length > 10

  return (
    <div style={{
      background: 'linear-gradient(160deg, #141420 0%, #0e0e18 100%)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '18px',
      padding: '14px 14px 12px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      {/* Role + company */}
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5', margin: '0 0 3px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {jobData.jobTitle ?? '—'}
      </p>
      <p style={{ fontSize: '11px', color: '#71717a', margin: '0 0 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {jobData.company ?? '—'}
      </p>

      {/* Summary chips */}
      {summaryLoading && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {[48, 60, 56, 44].map((w, i) => (
            <SkeletonChip key={i} width={w} />
          ))}
        </div>
      )}

      {summary && !summaryLoading && (
        <SummaryChips summary={summary} />
      )}

      {!summaryLoading && !summary && !hasDesc && (
        <p style={{ fontSize: '10px', color: '#3f3f46', margin: 0 }}>No description detected</p>
      )}

      {!summaryLoading && !summary && hasDesc && (
        <p style={{ fontSize: '10px', color: '#52525b', margin: 0, lineHeight: 1.5 }}>
          {jobData.description!.slice(0, 100).trim()}…
        </p>
      )}
    </div>
  )
}

function SummaryChips({ summary }: { summary: JobSummary }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Row 1: pay + location */}
      {(summary.pay || summary.location) && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {summary.pay && <Chip label={summary.pay} color="green" />}
          {summary.location && <Chip label={summary.location} color="blue" />}
          {summary.highlights.map((h, i) => <Chip key={i} label={h} color="amber" />)}
        </div>
      )}
      {/* Row 2: tech stack */}
      {summary.techStack.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {summary.techStack.map((t, i) => <Chip key={i} label={t} color="teal" />)}
        </div>
      )}
      {/* Row 3: requirements */}
      {summary.requirements.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {summary.requirements.map((r, i) => <Chip key={i} label={r} color="purple" />)}
        </div>
      )}
    </div>
  )
}

type ChipColor = 'green' | 'blue' | 'teal' | 'purple' | 'amber'

const CHIP_COLORS: Record<ChipColor, { bg: string; border: string; text: string }> = {
  green:  { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)',  text: '#34d399' },
  blue:   { bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  text: '#60a5fa' },
  teal:   { bg: 'rgba(45,212,191,0.1)',  border: 'rgba(45,212,191,0.25)',  text: '#2dd4bf' },
  purple: { bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)', text: '#a78bfa' },
  amber:  { bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  text: '#fbbf24' },
}

function Chip({ label, color }: { label: string; color: ChipColor }) {
  const c = CHIP_COLORS[color]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '99px',
      fontSize: '10px',
      fontWeight: 500,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      whiteSpace: 'nowrap',
      maxWidth: '140px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}>
      {label}
    </span>
  )
}

function SkeletonChip({ width }: { width: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: `${width}px`,
      height: '20px',
      borderRadius: '99px',
      background: 'rgba(255,255,255,0.05)',
      animation: 'bl-pulse 1.4s ease-in-out infinite',
    }} />
  )
}

function EmptyJobCard({ timedOut }: { timedOut: boolean }) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, #141420 0%, #0e0e18 100%)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '18px',
      padding: '14px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
    }}>
      <p style={{ fontSize: '11px', color: '#52525b', margin: 0, lineHeight: 1.6 }}>
        {timedOut
          ? 'Reload the tab to detect this job (extension was reloaded).'
          : 'Detecting job…'}
      </p>
      {!timedOut && (
        <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
          {[80, 60, 72, 52].map((w, i) => <SkeletonChip key={i} width={w} />)}
        </div>
      )}
    </div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButton({ onClick, disabled, loading, loadingLabel, icon, label, variant }: {
  onClick: () => void
  disabled: boolean
  loading: boolean
  loadingLabel: string
  icon: React.ReactNode
  label: string
  variant: 'primary' | 'secondary'
}) {
  const isPrimary = variant === 'primary'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '11px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '7px',
        borderRadius: '40px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        transition: 'all 0.18s ease',
        ...(disabled
          ? {
            background: '#1a1a1f',
            color: '#3f3f46',
            boxShadow: 'none',
          }
          : isPrimary
          ? {
            background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(79,70,229,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
          }
          : {
            background: 'linear-gradient(135deg, #1e1e2e 0%, #161622 100%)',
            color: '#a1a1aa',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }),
      }}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
  )
}

// ─── Cover letter result ──────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        background: 'linear-gradient(160deg, #141420 0%, #0e0e18 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span style={{ fontSize: '10px', color: '#52525b', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Cover letter
          </span>
          <button
            onClick={onCopy}
            style={{
              background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '99px',
              padding: '3px 10px',
              fontSize: '10px',
              color: copied ? '#34d399' : '#71717a',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontWeight: 500,
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
            padding: '12px',
            fontSize: '11px',
            color: '#d4d4d8',
            lineHeight: '1.65',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <ActionButton
        onClick={onDownloadCl}
        disabled={downloadingCl || isLoading}
        loading={downloadingCl}
        loadingLabel="Building PDF…"
        icon={<DownloadIcon />}
        label="Download cover letter PDF"
        variant="primary"
      />

      <div style={{ display: 'flex', gap: '7px' }}>
        <PillButton onClick={onRegenerate} disabled={isLoading}>Regenerate</PillButton>
        <PillButton onClick={onShowProjects} disabled={isLoading}>
          {isLoading ? <><Spinner />Thinking…</> : 'Suggest projects'}
        </PillButton>
      </div>
    </div>
  )
}

// ─── Project suggestions result ───────────────────────────────────────────────

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        background: 'linear-gradient(160deg, #141420 0%, #0e0e18 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: '10px', color: '#52525b', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Recommended projects
          </span>
        </div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {projects.map((p) => (
            <div key={p.projectId} style={{
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px' }}>
                <span style={{
                  fontSize: '9px', fontWeight: 700,
                  color: '#818cf8',
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '99px', padding: '1px 6px', flexShrink: 0,
                }}>
                  #{p.rank}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5' }}>{p.name}</span>
              </div>
              <p style={{ fontSize: '10.5px', color: '#a1a1aa', margin: '0 0 4px', lineHeight: 1.55 }}>{p.relevance}</p>
              <p style={{ fontSize: '10.5px', color: '#818cf8', margin: 0, lineHeight: 1.55 }}>↳ {p.swapReason}</p>
            </div>
          ))}
        </div>
      </div>

      <ActionButton
        onClick={onDownloadResume}
        disabled={downloadingResume || isLoading}
        loading={downloadingResume}
        loadingLabel="Building resume…"
        icon={<DownloadIcon />}
        label="Download tailored resume PDF"
        variant="primary"
      />

      <div style={{ display: 'flex', gap: '7px' }}>
        <PillButton onClick={onRegenerate} disabled={isLoading}>Regenerate</PillButton>
        <PillButton onClick={onShowCL} disabled={isLoading}>Generate CL</PillButton>
      </div>
    </div>
  )
}

// ─── Easter egg banner ────────────────────────────────────────────────────────

function EasterEggBanner({ instructions }: { instructions: string[] }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(251,146,60,0.1) 0%, rgba(251,146,60,0.05) 100%)',
      border: '1px solid rgba(251,146,60,0.3)',
      borderRadius: '14px',
      padding: '10px 12px',
      boxShadow: '0 0 16px rgba(251,146,60,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L11 10H1L6 1Z" stroke="#fb923c" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M6 4.5v3" stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="6" cy="8.8" r="0.5" fill="#fb923c" />
        </svg>
        <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#fb923c', letterSpacing: '0.06em' }}>
          HIDDEN INSTRUCTION
        </span>
      </div>
      {instructions.map((inst, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginTop: i > 0 ? '4px' : 0 }}>
          <span style={{ color: '#fb923c', fontSize: '10px', flexShrink: 0, marginTop: '1px' }}>›</span>
          <span style={{ fontSize: '11px', color: '#fdba74', lineHeight: 1.55 }}>{inst}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Error bubble ─────────────────────────────────────────────────────────────

function ErrorBubble({ message }: { message: string }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.07)',
      border: '1px solid rgba(239,68,68,0.18)',
      borderRadius: '12px',
      padding: '9px 12px',
      fontSize: '11px',
      color: '#f87171',
      lineHeight: 1.5,
    }}>
      {message}
    </div>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function PillButton({ onClick, disabled, children }: {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '40px',
        color: disabled ? '#3f3f46' : '#71717a',
        fontSize: '11.5px', fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
      }}
    >
      {children}
    </button>
  )
}

function Spinner() {
  return (
    <span className="bl-spin" style={{
      display: 'inline-block', width: '11px', height: '11px',
      border: '1.5px solid rgba(255,255,255,0.1)',
      borderTopColor: '#6366f1',
      borderRadius: '50%',
      flexShrink: 0,
    }} />
  )
}

function PenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <path d="M9 2L11 4 4.5 10.5H2.5v-2L9 2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.5" y="1.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="1.5" y="7.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <rect x="7.5" y="7.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" opacity="0.4" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6.5 2v7M3.5 6.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
