import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: '#111827',
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 64,
    lineHeight: 1.6,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 28,
    gap: 4,
  },
  contactItem: {
    fontSize: 9,
    color: '#6b7280',
    marginRight: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 24,
  },
  body: {
    fontSize: 10.5,
    color: '#1f2937',
    lineHeight: 1.75,
    whiteSpace: 'pre-wrap',
  },
})

interface CoverLetterPDFData {
  full_name: string
  email: string | null
  phone: string | null
  content: string
}

function CoverLetterPDF({ data }: { data: CoverLetterPDFData }) {
  const { full_name, email, phone, content } = data
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{full_name}</Text>
        <View style={styles.contactRow}>
          {email && <Text style={styles.contactItem}>{email}</Text>}
          {phone && <Text style={styles.contactItem}>{phone}</Text>}
        </View>
        <View style={styles.divider} />
        <Text style={styles.body}>{content}</Text>
      </Page>
    </Document>
  )
}

export async function generateCoverLetterPDF(data: CoverLetterPDFData): Promise<Buffer> {
  const buffer = await renderToBuffer(<CoverLetterPDF data={data} />)
  return Buffer.from(buffer)
}
