export interface RawJobEntry {
  company: string
  title: string
  location: string
  url: string
  rawDate: string // e.g. "Sep 5" — year is inferred later
}

// Parses the SimplifyJobs markdown table format:
//
//   | Company | Role | Location | Application/Link | Date Posted |
//   | ------- | ---- | -------- | ---------------- | ----------- |
//   | [Acme](url) | Software Engineer | San Francisco, CA | [Apply](job-url) | Sep 5 |
//   | ↳ | Backend Engineer | Remote | [Apply](job-url) 🔒 | Sep 4 |
//
// Rules:
//  - "↳" in the company cell inherits the last seen company name
//  - Rows with 🔒 in the link cell are skipped (application closed)
//  - Rows without a parseable application URL are skipped
export function parseJobsTable(markdown: string): RawJobEntry[] {
  const jobs: RawJobEntry[] = []
  const lines = markdown.split('\n')

  let inTable = false
  let headerSeen = false
  let lastCompany = ''

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect the jobs table header row
    if (!inTable && isJobsTableHeader(trimmed)) {
      inTable = true
      headerSeen = false
      continue
    }

    // Skip the separator row (| --- | --- | ...)
    if (inTable && !headerSeen && /^\|\s*-/.test(trimmed)) {
      headerSeen = true
      continue
    }

    // End of table — any non-pipe line after header
    if (inTable && headerSeen && !trimmed.startsWith('|')) {
      inTable = false
      lastCompany = ''
      continue
    }

    if (!inTable || !headerSeen) continue
    if (!trimmed.startsWith('|')) continue

    const cells = splitTableRow(trimmed)
    if (cells.length < 4) continue

    const [companyCell, roleCell, locationCell, linkCell, dateCell = ''] = cells

    // Skip closed/locked applications
    if (linkCell.includes('🔒')) continue

    const url = extractUrl(linkCell)
    if (!url) continue

    // Resolve company name — ↳ inherits the last seen parent company
    const companyRaw = extractText(companyCell).trim()
    if (companyRaw === '↳') {
      if (!lastCompany) continue // no parent yet, skip orphan
    } else {
      if (!companyRaw) continue
      lastCompany = companyRaw
    }

    const title = extractText(roleCell).trim()
    if (!title) continue

    jobs.push({
      company: lastCompany,
      title,
      location: cleanLocation(locationCell),
      url,
      rawDate: dateCell.trim(),
    })
  }

  return jobs
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isJobsTableHeader(line: string): boolean {
  const lower = line.toLowerCase()
  return (
    lower.startsWith('|') &&
    lower.includes('company') &&
    lower.includes('role') &&
    lower.includes('location')
  )
}

// Splits "| foo | bar | baz |" → ["foo", "bar", "baz"]
function splitTableRow(line: string): string[] {
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
}

// Extracts visible text from a markdown link [text](url) or HTML <a> tag,
// or returns the raw cell content if neither is present.
export function extractText(cell: string): string {
  const mdLink = cell.match(/\[([^\]]+)\]\([^)]+\)/)
  if (mdLink) return mdLink[1]

  const htmlLink = cell.match(/<a[^>]*>([^<]+)<\/a>/i)
  if (htmlLink) return htmlLink[1]

  return cell
}

// Extracts the href/url from a markdown link or HTML <a> tag.
export function extractUrl(cell: string): string | null {
  // [text](url) — capture everything up to the closing paren
  const mdLink = cell.match(/\[[^\]]*\]\(([^)]+)\)/)
  if (mdLink) return mdLink[1].trim()

  // href="url"
  const htmlLink = cell.match(/href="([^"]+)"/)
  if (htmlLink) return htmlLink[1].trim()

  return null
}

// Normalizes location strings: replaces <br> variants with ", " and cleans HTML entities.
export function cleanLocation(location: string): string {
  return location
    .replace(/<\/?\s*br\s*\/?>/gi, ', ') // handles <br>, <br/>, <br />, </br>
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
}
