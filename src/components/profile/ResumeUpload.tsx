'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UploadResult {
  resume_url: string
  skills_extracted: string[]
  answers_generated: number
}

interface ResumeUploadProps {
  resumeUrl: string | null
  hasResumeText: boolean
  onUpload: (result: UploadResult) => void
}

export function ResumeUpload({ resumeUrl, hasResumeText, onUpload }: ResumeUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<UploadResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5 MB')
      return
    }
    setError(null)
    setLastResult(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('resume', file)
      const res = await fetch('/api/profile/resume', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json() as UploadResult
        setLastResult(data)
        onUpload(data)
      } else {
        const err = await res.json() as { error: string }
        setError(err.error ?? 'Upload failed')
      }
    } catch {
      setError('Upload failed — please try again')
    } finally {
      setUploading(false)
    }
  }

  const uploadLabel = (() => {
    if (uploading) return null
    if (resumeUrl) return 'Replace resume'
    return 'Upload resume'
  })()

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          dragging
            ? 'border-zinc-500 bg-zinc-800/50'
            : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-zinc-400">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Uploading and analyzing resume…</span>
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <div className="text-center">
              <p className="text-sm text-zinc-300">{uploadLabel}</p>
              <p className="text-xs text-zinc-600 mt-0.5">PDF · max 5 MB · drag & drop or click</p>
            </div>
          </>
        )}
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}
        {lastResult && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 space-y-1"
          >
            <p className="text-xs text-emerald-400 font-medium">Resume analyzed successfully</p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {lastResult.skills_extracted.length > 0 && (
                <p className="text-xs text-zinc-400">
                  +{lastResult.skills_extracted.length} skills added to your profile
                </p>
              )}
              {lastResult.answers_generated > 0 && (
                <p className="text-xs text-zinc-400">
                  {lastResult.answers_generated} answers saved below
                </p>
              )}
              {lastResult.skills_extracted.length === 0 && lastResult.answers_generated === 0 && (
                <p className="text-xs text-zinc-400">File stored · scroll down to review your profile</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {resumeUrl && !uploading && (
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-zinc-200 underline transition-colors truncate"
          >
            View current resume
          </a>
          {hasResumeText && (
            <span className="text-xs text-emerald-600 shrink-0">· text extracted</span>
          )}
        </div>
      )}
    </div>
  )
}
