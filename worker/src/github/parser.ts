export interface RawJobEntry {
  company: string
  title: string
  location: string
  url: string
  rawDate: string // e.g. "0d", "3d" — days ago; year/month format is legacy
}

// Parses the SimplifyJobs HTML table format:
//
//   <table>
//     <thead><tr><th>Company</th><th>Role</th><th>Location</th><th>Application</th><th>Age</th></tr></thead>
//     <tbody>
//       <tr>
//         <td><strong><a href="...">Acme</a></strong></td>
//         <td>Software Engineer</td>
//         <td>San Francisco, CA</td>
//         <td><div align="center"><a href="job-url"><img alt="Apply"></a></div></td>
//         <td>0d</td>
//       </tr>
//       <tr>
//         <td>↳</td>
//         <td>Backend Engineer</td>
//         ...
//       </tr>
//     </tbody>
//   </table>
//
// Rules:
//  - "↳" in the company cell inherits the last seen company name
//  - Rows with 🔒 in the link cell are skipped (application closed)
//  - Rows without a parseable application URL are skipped
//  - Leading emoji/symbols are stripped from company names
export function parseJobsTable(markdown: string): RawJobEntry[] {
  const jobs: RawJobEntry[] = []
  let lastCompany = ''

  // Match every <tr>...</tr> block, including multi-line rows
  const trRegex = /<tr>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null

  while ((trMatch = trRegex.exec(markdown)) !== null) {
    const rowContent = trMatch[1]

    // Skip header rows (contain <th>)
    if (/<th/i.test(rowContent)) continue

    // Extract all <td> contents in order
    const cells: string[] = []
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      cells.push(tdMatch[1].trim())
    }

    if (cells.length < 4) continue

    const [companyCell, roleCell, locationCell, linkCell, ageCell = ''] = cells

    // Skip locked/closed applications
    if (linkCell.includes('🔒')) continue

    const url = extractUrl(linkCell)
    if (!url) continue

    // Resolve company name — strip leading emoji/symbols, handle ↳ sub-roles
    const companyRaw = stripLeadingEmoji(extractText(companyCell)).trim()
    if (companyRaw === '↳') {
      if (!lastCompany) continue // orphan sub-role, skip
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
      rawDate: ageCell.trim(),
    })
  }

  return jobs
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Strips leading emoji, symbols, and whitespace from a string.
// Keeps ↳ intact since it's a structural marker.
function stripLeadingEmoji(text: string): string {
  if (text.startsWith('↳')) return '↳'
  // Remove any leading non-letter, non-digit, non-↳ characters (emoji, symbols, spaces)
  return text.replace(/^[^\p{L}\p{N}↳]+/u, '').trim()
}

// Extracts visible text from a markdown link [text](url), an HTML <a> tag,
// or returns the raw cell content if neither is present.
export function extractText(cell: string): string {
  // Markdown link: [text](url)
  const mdLink = cell.match(/\[([^\]]+)\]\([^)]+\)/)
  if (mdLink) return mdLink[1]

  // HTML anchor: <a ...>text</a> — may be nested inside <strong> etc.
  const htmlLink = cell.match(/<a[^>]*>([^<]+)<\/a>/i)
  if (htmlLink) return htmlLink[1]

  // Strip all remaining HTML tags and return plain text
  return cell.replace(/<[^>]+>/g, '').trim()
}

// Extracts the application URL from a link cell.
// Prefers the first <a href> found — in the HTML format this is the direct
// employer link; the second link (if present) is the Simplify link.
export function extractUrl(cell: string): string | null {
  // HTML href="url"
  const htmlLink = cell.match(/href="([^"]+)"/)
  if (htmlLink) return htmlLink[1].trim()

  // Markdown link: [text](url)
  const mdLink = cell.match(/\[[^\]]*\]\(([^)]+)\)/)
  if (mdLink) return mdLink[1].trim()

  return null
}

// Normalizes location strings: replaces <br> variants with ", " and cleans HTML entities.
export function cleanLocation(location: string): string {
  return location
    .replace(/<\/?\s*br\s*\/?>/gi, ', ') // handles <br>, <br/>, <br />, </br>
    .replace(/<[^>]+>/g, '')             // strip any remaining HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
}
