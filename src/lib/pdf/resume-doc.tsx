import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ParsedResume } from './resume-utils'

const FONT      = 'Times-Roman'
const FONT_BOLD = 'Times-Bold'
const BLACK     = '#111827'
const MUTED     = '#6b7280'
const RULE      = '#374151'

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    color: BLACK,
    paddingTop: 36,
    paddingBottom: 32,
    paddingLeft: 44,
    paddingRight: 44,
    lineHeight: 1.3,
  },

  // ── Header ──
  name: {
    fontFamily: FONT_BOLD,
    fontSize: 17,
    marginBottom: 7,
  },
  contacts: {
    fontSize: 8,
    color: MUTED,
    marginBottom: 8,
  },

  // ── Section ──
  section: {
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 8.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingBottom: 2,
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    marginBottom: 4,
  },

  // ── Entry ──
  entry: {
    marginBottom: 4,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  entryTitle: {
    fontFamily: FONT_BOLD,
    fontSize: 9,
    flex: 1,
    marginRight: 4,
  },
  entryDate: {
    fontSize: 8,
    color: MUTED,
    flexShrink: 0,
  },

  // ── Bullets ──
  bullet: {
    flexDirection: 'row',
    marginBottom: 1,
    paddingLeft: 7,
  },
  bulletDot: {
    width: 7,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
  },

  // ── Skills ──
  skillLine: {
    marginBottom: 1.5,
  },
  skillLabel: {
    fontFamily: FONT_BOLD,
  },
})

interface ResumeDocProps {
  resume: ParsedResume
  compact?: boolean
}

export function ResumeDoc({ resume, compact = false }: ResumeDocProps) {
  const { header, sections } = resume

  // Tighter spacing applied only when page overflow is detected on first render
  const compactOverrides = compact ? {
    lineHeight: 1.22,
    fontSize: 8.5,
  } : {}

  const compactSection   = compact ? { marginBottom: 4 }  : {}
  const compactEntry     = compact ? { marginBottom: 2 }  : {}
  const compactBullet    = compact ? { marginBottom: 0.5 } : {}
  const compactSecTitle  = compact ? { marginBottom: 3 }  : {}

  return (
    <Document
      title={`${header.name} — Resume`}
      author={header.name}
      creator="Backlog"
    >
      <Page size="LETTER" style={[s.page, compactOverrides]}>
        {/* Name */}
        <Text style={s.name}>{header.name}</Text>

        {/* Contact line */}
        <Text style={s.contacts}>{header.contacts.join('  ·  ')}</Text>

        {/* Sections */}
        {sections.map((section) => (
          <View key={section.title} style={[s.section, compactSection]}>
            <Text style={[s.sectionTitle, compactSecTitle]}>{section.title}</Text>

            {/* Entry-based sections (Experience, Projects, Education) */}
            {section.entries.map((entry, ei) => (
              <View key={ei} style={[s.entry, compactEntry]}>
                <View style={s.entryHeader}>
                  <Text style={s.entryTitle}>{entry.heading}</Text>
                  {entry.date && <Text style={s.entryDate}>{entry.date}</Text>}
                </View>
                {entry.bullets.map((b, bi) => (
                  <View key={bi} style={[s.bullet, compactBullet]}>
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
