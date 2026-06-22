'use client'

import { useState, useCallback, useRef } from 'react'

interface Props {
  initialResume: string | null
  initialStyleContext: string | null
}

export function HandshakeSettings({ initialResume, initialStyleContext }: Props) {
  const [styleContext, setStyleContext] = useState(initialStyleContext)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [resume, setResume] = useState(initialResume ?? '')
  const [savingResume, setSavingResume] = useState(false)
  const [resumeSaved, setResumeSaved] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.endsWith('.pdf')
    )
    if (pdfs.length === 0) {
      setUploadError('Please select PDF files only.')
      return
    }

    setUploading(true)
    setUploadError(null)

    const sampled = pdfs.length > 20 ? pdfs.slice(0, 20) : pdfs
    setUploadProgress(
      pdfs.length > 20
        ? `Analyzing 20 of ${pdfs.length} PDFs…`
        : `Analyzing ${pdfs.length} PDF${pdfs.length !== 1 ? 's' : ''}…`
    )

    try {
      const formData = new FormData()
      sampled.forEach((f) => formData.append('pdfs', f))

      const res = await fetch('/api/user/extract-cover-letter-style', {
        method: 'POST',
        body: formData,
      })

      const data = (await res.json()) as {
        styleContext?: string
        processedPdfs?: number
        error?: string
      }

      if (!res.ok || data.error) throw new Error(data.error ?? 'Upload failed')

      setStyleContext(data.styleContext ?? null)
      setUploadProgress(null)
    } catch (err) {
      setUploadError((err as Error).message)
      setUploadProgress(null)
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => setDragOver(false), [])

  async function saveResume() {
    setSavingResume(true)
    setResumeError(null)
    setResumeSaved(false)
    try {
      const res = await fetch('/api/user/upload-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: resume }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Save failed')
      setResumeSaved(true)
      setTimeout(() => setResumeSaved(false), 3000)
    } catch (err) {
      setResumeError((err as Error).message)
    } finally {
      setSavingResume(false)
    }
  }

  return (
    <>
      {/* Cover Letter Style */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Cover letter style</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Upload past cover letters so Handshake can write new ones in your voice.
          </p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            uploading
              ? 'border-zinc-700 cursor-default'
              : dragOver
                ? 'border-blue-500/60 bg-blue-500/5 cursor-pointer'
                : 'border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900/40 cursor-pointer'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              <p className="text-xs text-zinc-400">{uploadProgress}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-400">
                Drop PDF cover letters here or{' '}
                <span className="text-zinc-200 underline underline-offset-2">browse</span>
              </p>
              <p className="text-xs text-zinc-600 mt-1">Analyzes up to 20 PDFs per upload</p>
            </>
          )}
        </div>

        {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

        {styleContext ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2">
            <p className="text-xs font-medium text-emerald-400">Style context set</p>
            <p className="text-xs text-zinc-400 line-clamp-4 leading-relaxed">{styleContext}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Re-upload to update
            </button>
          </div>
        ) : (
          !uploading && (
            <p className="text-xs text-zinc-600">
              No style context yet — upload your past cover letters to enable personalized generation.
            </p>
          )
        )}
      </section>

      <div className="border-t border-zinc-800" />

      {/* Resume */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Resume</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Your resume in Markdown. Handshake uses this to suggest which projects to highlight for each job.
          </p>
        </div>

        <textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={12}
          placeholder="Paste your resume in Markdown format…"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-200 font-mono px-4 py-3 resize-y focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700 transition-colors"
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-600">{resume.length.toLocaleString()} chars</p>
          <div className="flex items-center gap-3">
            {resumeError && <p className="text-xs text-red-400">{resumeError}</p>}
            {resumeSaved && <p className="text-xs text-emerald-400">Saved</p>}
            <button
              onClick={saveResume}
              disabled={savingResume || resume.trim().length === 0}
              className="text-xs px-3 py-2 rounded-lg bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors disabled:opacity-40"
            >
              {savingResume ? 'Saving…' : 'Save resume'}
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
