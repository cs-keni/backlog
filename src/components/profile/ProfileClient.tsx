'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { UserProfile, WorkHistory, Education, SavedAnswer } from '@/lib/jobs/types'
import { WorkHistorySection } from './WorkHistorySection'
import { EducationSection } from './EducationSection'
import { SavedAnswersSection } from './SavedAnswersSection'
import { SkillsInput } from './SkillsInput'
import { ResumeUpload } from './ResumeUpload'

interface ProfileClientProps {
  initialProfile: UserProfile
  initialWorkHistory: WorkHistory[]
  initialEducation: Education[]
  initialSavedAnswers: SavedAnswer[]
}

// ─── Completeness ─────────────────────────────────────────────────────────────

function computeCompleteness(profile: UserProfile, work: WorkHistory[], edu: Education[]): {
  percent: number
  missing: string[]
} {
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: 'Full name', ok: !!profile.full_name },
    { label: 'Phone', ok: !!profile.phone },
    { label: 'LinkedIn URL', ok: !!profile.linkedin_url },
    { label: 'Skills', ok: !!(profile.skills && profile.skills.length > 0) },
    { label: 'Experience level', ok: !!profile.experience_level },
    { label: 'Resume upload', ok: !!profile.resume_url },
    { label: 'Work history', ok: work.length > 0 },
    { label: 'Education', ok: edu.length > 0 },
    { label: 'Work authorization', ok: !!profile.citizenship_status },
    { label: 'Job preferences', ok: !!(profile.remote_preference) },
  ]
  const done = checks.filter(c => c.ok)
  const missing = checks.filter(c => !c.ok).map(c => c.label)
  return { percent: Math.round((done.length / checks.length) * 100), missing }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-zinc-400">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-600 transition-colors"
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 outline-none focus:border-zinc-600 transition-colors"
    >
      {props.children}
    </select>
  )
}

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onClick}
        disabled={saving}
        className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 transition-colors disabled:opacity-50 min-w-[70px]"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  )
}

// ─── Phone formatting ─────────────────────────────────────────────────────────

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Strip leading country code if 11 digits starting with 1
  const d = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (d.length === 10) return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return raw // Return as-is if we can't format
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProfileClient({
  initialProfile,
  initialWorkHistory,
  initialEducation,
  initialSavedAnswers,
}: ProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile)
  const [work, setWork] = useState(initialWorkHistory)
  const [edu, setEdu] = useState(initialEducation)
  const [answers, setAnswers] = useState(initialSavedAnswers)

  // Per-section dirty / saving / saved state
  const [sections, setSections] = useState<Record<string, { saving: boolean; saved: boolean }>>({})

  function setSectionState(key: string, state: { saving: boolean; saved: boolean }) {
    setSections(s => ({ ...s, [key]: state }))
  }

  async function saveSection(key: string, updates: Record<string, unknown>) {
    setSectionState(key, { saving: true, saved: false })
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json() as UserProfile
        setProfile(updated)
        setSectionState(key, { saving: false, saved: true })
        setTimeout(() => setSectionState(key, { saving: false, saved: false }), 2500)
      } else {
        setSectionState(key, { saving: false, saved: false })
      }
    } catch {
      setSectionState(key, { saving: false, saved: false })
    }
  }

  const { percent, missing } = computeCompleteness(profile, work, edu)

  const completenessColor = percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Profile</h1>
        <p className="text-xs text-zinc-500 mt-1">
          This information powers auto-fill, match scores, and AI-generated content.
        </p>
      </div>

      {/* Completeness indicator */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 space-y-2"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">Profile completeness</span>
          <span className="text-xs text-zinc-400">{percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={`h-full rounded-full ${completenessColor}`}
          />
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-zinc-600">
            Missing: {missing.slice(0, 4).join(', ')}{missing.length > 4 ? ` +${missing.length - 4} more` : ''}
          </p>
        )}
      </motion.div>

      {/* Resume */}
      <Section title="Resume">
        <ResumeUpload
          resumeUrl={profile.resume_url}
          hasResumeText={!!(profile.resume_text && profile.resume_text.length > 0)}
          onAnalyze={() => {
            // Re-fetch all profile sections that may have been updated
            Promise.all([
              fetch('/api/profile').then(r => r.json()),
              fetch('/api/profile/saved-answers').then(r => r.json()),
              fetch('/api/profile/work-history').then(r => r.json()),
              fetch('/api/profile/education').then(r => r.json()),
            ]).then(([profileData, answersData, workData, eduData]) => {
              if (profileData && !profileData.error) setProfile(profileData as UserProfile)
              if (Array.isArray(answersData)) setAnswers(answersData)
              if (Array.isArray(workData)) setWork(workData)
              if (Array.isArray(eduData)) setEdu(eduData)
            }).catch(() => {})
          }}
          onUpload={({ resume_url }) => {
            setProfile(p => ({ ...p, resume_url, resume_text: 'extracted' }))
            // Re-fetch all profile sections that may have been updated by AI analysis
            Promise.all([
              fetch('/api/profile').then(r => r.json()),
              fetch('/api/profile/saved-answers').then(r => r.json()),
              fetch('/api/profile/work-history').then(r => r.json()),
              fetch('/api/profile/education').then(r => r.json()),
            ]).then(([profileData, answersData, workData, eduData]) => {
              if (profileData && !profileData.error) setProfile(p => ({ ...profileData as UserProfile, resume_url: p.resume_url ?? resume_url }))
              if (Array.isArray(answersData)) setAnswers(answersData)
              if (Array.isArray(workData)) setWork(workData)
              if (Array.isArray(eduData)) setEdu(eduData)
            }).catch(() => {})
          }}
        />
      </Section>

      {/* Personal Info */}
      <Section title="Personal Info">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name">
            <Input
              value={profile.full_name ?? ''}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
              placeholder="Alex Johnson"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={profile.phone ?? ''}
              onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
              onBlur={e => {
                const formatted = formatPhone(e.target.value)
                if (formatted !== e.target.value) setProfile(p => ({ ...p, phone: formatted }))
              }}
              placeholder="(555) 000-0000"
            />
          </Field>
        </div>
        <Field label="Address">
          <Input
            value={profile.address ?? ''}
            onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
            placeholder="Portland, OR"
          />
        </Field>
        <SaveButton
          saving={sections['personal']?.saving ?? false}
          saved={sections['personal']?.saved ?? false}
          onClick={() => saveSection('personal', {
            full_name: profile.full_name,
            phone: profile.phone,
            address: profile.address,
          })}
        />
      </Section>

      {/* Links */}
      <Section title="Links">
        <Field label="LinkedIn URL">
          <Input
            value={profile.linkedin_url ?? ''}
            onChange={e => setProfile(p => ({ ...p, linkedin_url: e.target.value }))}
            placeholder="https://linkedin.com/in/yourname"
          />
        </Field>
        <Field label="GitHub URL">
          <Input
            value={profile.github_url ?? ''}
            onChange={e => setProfile(p => ({ ...p, github_url: e.target.value }))}
            placeholder="https://github.com/yourname"
          />
        </Field>
        <Field label="Portfolio URL">
          <Input
            value={profile.portfolio_url ?? ''}
            onChange={e => setProfile(p => ({ ...p, portfolio_url: e.target.value }))}
            placeholder="https://yoursite.dev"
          />
        </Field>
        <SaveButton
          saving={sections['links']?.saving ?? false}
          saved={sections['links']?.saved ?? false}
          onClick={() => saveSection('links', {
            linkedin_url: profile.linkedin_url,
            github_url: profile.github_url,
            portfolio_url: profile.portfolio_url,
          })}
        />
      </Section>

      {/* Experience */}
      <Section title="Experience">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Experience Level">
            <Select
              value={profile.experience_level ?? ''}
              onChange={e => setProfile(p => ({ ...p, experience_level: e.target.value || null }))}
            >
              <option value="">Select…</option>
              <option value="entry">Entry (0–2 yrs)</option>
              <option value="mid">Mid (2–5 yrs)</option>
              <option value="senior">Senior (5–8 yrs)</option>
              <option value="staff">Staff / Lead (8+ yrs)</option>
              <option value="principal">Principal / Architect</option>
            </Select>
          </Field>
          <Field label="Years of Experience">
            <Input
              type="number"
              min={0}
              max={50}
              value={profile.years_of_experience ?? ''}
              onChange={e => setProfile(p => ({ ...p, years_of_experience: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="3"
            />
          </Field>
        </div>
        <Field label="Skills">
          <SkillsInput
            skills={profile.skills ?? []}
            onChange={skills => setProfile(p => ({ ...p, skills }))}
          />
          <p className="text-xs text-zinc-600 mt-1">Press Enter or comma to add. Used for match scoring.</p>
        </Field>
        <SaveButton
          saving={sections['experience']?.saving ?? false}
          saved={sections['experience']?.saved ?? false}
          onClick={() => saveSection('experience', {
            experience_level: profile.experience_level,
            years_of_experience: profile.years_of_experience,
            skills: profile.skills,
          })}
        />
      </Section>

      {/* Work Authorization */}
      <Section title="Work Authorization">
        <Field label="Citizenship / Visa Status">
          <Select
            value={profile.citizenship_status ?? ''}
            onChange={e => setProfile(p => ({ ...p, citizenship_status: e.target.value || null }))}
          >
            <option value="">Select…</option>
            <option value="US Citizen">US Citizen</option>
            <option value="Permanent Resident">Permanent Resident (Green Card)</option>
            <option value="H-1B">H-1B Visa</option>
            <option value="F-1 OPT">F-1 OPT / STEM OPT</option>
            <option value="Other Visa">Other Visa</option>
            <option value="Not Authorized">Not Authorized to Work in US</option>
          </Select>
        </Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.visa_sponsorship_required}
              onChange={e => setProfile(p => ({ ...p, visa_sponsorship_required: e.target.checked }))}
              className="accent-emerald-500"
            />
            <span className="text-sm text-zinc-300">Require visa sponsorship</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.willing_to_relocate}
              onChange={e => setProfile(p => ({ ...p, willing_to_relocate: e.target.checked }))}
              className="accent-emerald-500"
            />
            <span className="text-sm text-zinc-300">Willing to relocate</span>
          </label>
        </div>
        <SaveButton
          saving={sections['auth']?.saving ?? false}
          saved={sections['auth']?.saved ?? false}
          onClick={() => saveSection('auth', {
            citizenship_status: profile.citizenship_status,
            visa_sponsorship_required: profile.visa_sponsorship_required,
            willing_to_relocate: profile.willing_to_relocate,
          })}
        />
      </Section>

      {/* Job Preferences */}
      <Section title="Job Preferences">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Remote Preference">
            <Select
              value={profile.remote_preference ?? ''}
              onChange={e => setProfile(p => ({ ...p, remote_preference: (e.target.value || null) as UserProfile['remote_preference'] }))}
            >
              <option value="">No preference</option>
              <option value="remote">Remote only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site only</option>
              <option value="any">Any</option>
            </Select>
          </Field>
          <Field label="Min Salary (USD/yr)">
            <Input
              type="number"
              min={0}
              step={5000}
              value={profile.preferred_salary_min ?? ''}
              onChange={e => setProfile(p => ({ ...p, preferred_salary_min: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="80000"
            />
          </Field>
        </div>
        <Field label="Preferred Locations">
          <SkillsInput
            skills={profile.preferred_locations ?? []}
            onChange={locs => setProfile(p => ({ ...p, preferred_locations: locs }))}
            enterOnly
            placeholder="Type a city or region and press Enter…"
          />
          <p className="text-xs text-zinc-600 mt-1">Press Enter to add cities or regions (e.g. Portland, OR).</p>
        </Field>
        <Field label="Role Types">
          <div className="flex flex-wrap gap-2">
            {(['full_time', 'internship', 'contract', 'part_time'] as const).map(type => {
              const label = { full_time: 'Full-time', internship: 'Internship', contract: 'Contract', part_time: 'Part-time' }[type]
              const selected = (profile.preferred_role_types ?? []).includes(type)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const current = profile.preferred_role_types ?? []
                    const updated = selected ? current.filter(t => t !== type) : [...current, type]
                    setProfile(p => ({ ...p, preferred_role_types: updated }))
                  }}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    selected
                      ? 'bg-zinc-700 text-zinc-100 border border-zinc-600'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Field>
        <SaveButton
          saving={sections['prefs']?.saving ?? false}
          saved={sections['prefs']?.saved ?? false}
          onClick={() => saveSection('prefs', {
            remote_preference: profile.remote_preference,
            preferred_salary_min: profile.preferred_salary_min,
            preferred_locations: profile.preferred_locations,
            preferred_role_types: profile.preferred_role_types,
          })}
        />
      </Section>

      {/* Work History */}
      <Section title="Work History">
        <WorkHistorySection entries={work} onChange={setWork} />
      </Section>

      {/* Education */}
      <Section title="Education">
        <EducationSection entries={edu} onChange={setEdu} />
      </Section>

      {/* Saved Answers */}
      <Section title="Saved Answers">
        <SavedAnswersSection answers={answers} onChange={setAnswers} />
      </Section>
    </div>
  )
}
