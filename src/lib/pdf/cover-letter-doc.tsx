import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const FONT = 'Times-Roman'
const FONT_BOLD = 'Times-Bold'
const BLACK = '#111827'
const MUTED = '#6b7280'
const RULE  = '#d1d5db'

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 10.5,
    color: BLACK,
    paddingTop: 56,
    paddingBottom: 56,
    paddingLeft: 64,
    paddingRight: 64,
    lineHeight: 1.5,
  },
  name: {
    fontFamily: FONT_BOLD,
    fontSize: 17,
    marginBottom: 8,
  },
  contact: {
    fontSize: 9,
    color: MUTED,
    marginBottom: 10,
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    marginBottom: 14,
  },
  date: {
    marginBottom: 12,
  },
  reLabel: {
    fontFamily: FONT_BOLD,
    marginBottom: 14,
  },
  salutation: {
    marginBottom: 12,
  },
  paragraph: {
    marginBottom: 10,
    textAlign: 'justify',
  },
  closing: {
    marginTop: 14,
    marginBottom: 12,
  },
  signatureName: {
    fontFamily: FONT_BOLD,
  },
})

interface CoverLetterDocProps {
  name:       string
  contacts:   string[]   // ["email", "phone", "website", "github"]
  date:       string     // "June 22, 2026"
  jobTitle:   string
  company:    string
  body:       string     // multi-paragraph body text
}

export function CoverLetterDoc({ name, contacts, date, jobTitle, company, body }: CoverLetterDocProps) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(p => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)

  return (
    <Document
      title={`Cover Letter — ${jobTitle} at ${company}`}
      author={name}
      creator="Backlog"
    >
      <Page size="LETTER" style={s.page}>
        {/* Name */}
        <Text style={s.name}>{name}</Text>

        {/* Contact line */}
        <Text style={s.contact}>{contacts.join('  ·  ')}</Text>

        {/* Divider */}
        <View style={s.rule} />

        {/* Date */}
        <Text style={s.date}>{date}</Text>

        {/* Salutation */}
        <Text style={s.salutation}>Dear Hiring Manager,</Text>

        {/* Body paragraphs */}
        {paragraphs.map((p, i) => (
          <Text key={i} style={s.paragraph}>{p}</Text>
        ))}

        {/* Closing */}
        <Text style={s.closing}>Sincerely,</Text>
        <Text style={s.signatureName}>{name}</Text>
      </Page>
    </Document>
  )
}
