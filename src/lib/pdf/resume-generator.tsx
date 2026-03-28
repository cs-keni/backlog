import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Link,
} from '@react-pdf/renderer'
import type { TailoredResume } from '@/lib/llm/resume-tailor'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },
  // Header
  header: {
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#111827',
    paddingBottom: 10,
  },
  name: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  contactItem: {
    fontSize: 9,
    color: '#374151',
    marginRight: 10,
  },
  contactLink: {
    fontSize: 9,
    color: '#1d4ed8',
    marginRight: 10,
    textDecoration: 'none',
  },
  // Section
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#111827',
    borderBottomWidth: 0.75,
    borderBottomColor: '#d1d5db',
    paddingBottom: 2,
    marginBottom: 8,
  },
  // Summary
  summary: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },
  // Work entry
  workEntry: {
    marginBottom: 10,
  },
  workHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  workTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  workCompany: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 3,
  },
  workDates: {
    fontSize: 9,
    color: '#6b7280',
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    fontSize: 10,
    color: '#374151',
    marginRight: 4,
    marginTop: 0,
    width: 8,
  },
  bulletText: {
    fontSize: 9.5,
    color: '#374151',
    flex: 1,
    lineHeight: 1.45,
  },
  // Education entry
  eduEntry: {
    marginBottom: 6,
  },
  eduHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eduSchool: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  eduYear: {
    fontSize: 9,
    color: '#6b7280',
  },
  eduDegree: {
    fontSize: 9.5,
    color: '#374151',
  },
  // Skills
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  skillChip: {
    fontSize: 9,
    color: '#374151',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 4,
    marginBottom: 4,
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null, isCurrent: boolean): string {
  if (isCurrent) return 'Present'
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EducationEntry {
  school: string
  degree: string | null
  field_of_study: string | null
  gpa: number | null
  graduation_year: number | null
}

interface ResumeData {
  full_name: string
  email: string | null
  phone: string | null
  address: string | null
  linkedin_url: string | null
  github_url: string | null
  skills: string[]
  education: EducationEntry[]
  tailored: TailoredResume
}

// ─── PDF Document Component ───────────────────────────────────────────────────

function ResumePDF({ data }: { data: ResumeData }) {
  const { full_name, email, phone, address, linkedin_url, github_url, skills, education, tailored } = data

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.name}>{full_name}</Text>
          <View style={styles.contactRow}>
            {email && <Text style={styles.contactItem}>{email}</Text>}
            {phone && <Text style={styles.contactItem}>{phone}</Text>}
            {address && <Text style={styles.contactItem}>{address}</Text>}
            {linkedin_url && (
              <Link src={linkedin_url} style={styles.contactLink}>
                {linkedin_url.replace(/^https?:\/\/(www\.)?/, '')}
              </Link>
            )}
            {github_url && (
              <Link src={github_url} style={styles.contactLink}>
                {github_url.replace(/^https?:\/\/(www\.)?/, '')}
              </Link>
            )}
          </View>
        </View>

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        {tailored.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summary}>{tailored.summary}</Text>
          </View>
        )}

        {/* ── Work Experience ──────────────────────────────────────────────── */}
        {tailored.work_experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {tailored.work_experience.map((entry, i) => (
              <View key={i} style={styles.workEntry}>
                <View style={styles.workHeader}>
                  <Text style={styles.workTitle}>{entry.title}</Text>
                  <Text style={styles.workDates}>
                    {formatDate(entry.start_date, false)} – {formatDate(entry.end_date, entry.is_current)}
                  </Text>
                </View>
                <Text style={styles.workCompany}>{entry.company}</Text>
                {entry.bullets.map((bullet, j) => (
                  <View key={j} style={styles.bullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── Education ────────────────────────────────────────────────────── */}
        {education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((entry, i) => (
              <View key={i} style={styles.eduEntry}>
                <View style={styles.eduHeader}>
                  <Text style={styles.eduSchool}>{entry.school}</Text>
                  {entry.graduation_year && (
                    <Text style={styles.eduYear}>{entry.graduation_year}</Text>
                  )}
                </View>
                {(entry.degree || entry.field_of_study) && (
                  <Text style={styles.eduDegree}>
                    {[entry.degree, entry.field_of_study].filter(Boolean).join(', ')}
                    {entry.gpa ? `  ·  GPA: ${entry.gpa}` : ''}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Skills ───────────────────────────────────────────────────────── */}
        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsRow}>
              {skills.map((skill, i) => (
                <Text key={i} style={styles.skillChip}>{skill}</Text>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function generateResumePDF(data: ResumeData): Promise<Buffer> {
  const buffer = await renderToBuffer(<ResumePDF data={data} />)
  return Buffer.from(buffer)
}
