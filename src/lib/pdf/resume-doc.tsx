import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ParsedResume } from './resume-utils'

const FONT      = 'Helvetica'
const FONT_BOLD = 'Helvetica-Bold'
const BLACK     = '#111827'
const MUTED     = '#6b7280'
const RULE      = '#374151'

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9.5,
    color: BLACK,
    paddingTop: 44,
    paddingBottom: 40,
    paddingLeft: 48,
    paddingRight: 48,
    lineHeight: 1.4,
  },

  // ── Header ──
  name: {
    fontFamily: FONT_BOLD,
    fontSize: 19,
    marginBottom: 3,
  },
  contacts: {
    fontSize: 8.5,
    color: MUTED,
    marginBottom: 12,
  },

  // ── Section ──
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    marginBottom: 5,
  },

  // ── Entry ──
  entry: {
    marginBottom: 5,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  entryTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 9.5,
    flex: 1,
    marginRight: 4,
  },
  entryDate: {
    fontSize: 8.5,
    color: MUTED,
    flexShrink: 0,
  },

  // ── Bullets ──
  bullet: {
    flexDirection: 'row',
    marginBottom: 1.5,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 8,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
  },

  // ── Skills ──
  skillLine: {
    marginBottom: 2,
  },
  skillLabel: {
    fontFamily: FONT_BOLD,
  },
})

interface ResumeDocProps {
  resume: ParsedResume
}

export function ResumeDoc({ resume }: ResumeDocProps) {
  const { header, sections } = resume

  return (
    <Document
      title={`${header.name} — Resume`}
      author={header.name}
      creator="Backlog"
    >
      <Page size="LETTER" style={s.page}>
        {/* Name */}
        <Text style={s.name}>{header.name}</Text>

        {/* Contact line */}
        <Text style={s.contacts}>{header.contacts.join('  ·  ')}</Text>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>

            {/* Entry-based sections (Experience, Projects, Education) */}
            {section.entries.map((entry, ei) => (
              <View key={ei} style={s.entry}>
                <View style={s.entryHeader}>
                  <Text style={s.entryTitle}>{entry.heading}</Text>
                  {entry.date && <Text style={s.entryDate}>{entry.date}</Text>}
                </View>
                {entry.bullets.map((b, bi) => (
                  <View key={bi} style={s.bullet}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}

            {/* Plain-line sections (Technical Skills) */}
            {section.lines.map((line, li) => {
              const pipeIdx = line.indexOf(' | ')
              if (pipeIdx !== -1) {
                const label = line.slice(0, pipeIdx)
                const value = line.slice(pipeIdx + 3)
                return (
                  <Text key={li} style={s.skillLine}>
                    <Text style={s.skillLabel}>{label}:</Text>
                    {'  '}{value}
                  </Text>
                )
              }
              return <Text key={li} style={s.skillLine}>{line}</Text>
            })}
          </View>
        ))}
      </Page>
    </Document>
  )
}
