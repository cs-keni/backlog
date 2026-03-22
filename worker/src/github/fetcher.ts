const GITHUB_API = 'https://api.github.com'
const FILE_PATH = 'README.md'

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'backlog-worker/1.0',
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

// Returns the latest commit SHA that touched README.md.
// Storing and comparing this SHA lets us skip runs where nothing changed.
export async function fetchLatestCommitSha(owner: string, repo: string): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits?path=${FILE_PATH}&per_page=1`,
    { headers: buildHeaders() }
  )
  if (!res.ok) {
    throw new Error(`GitHub commits API returned ${res.status}: ${await res.text()}`)
  }
  const commits = (await res.json()) as Array<{ sha: string }>
  if (!commits.length) throw new Error('No commits found for README.md')
  return commits[0].sha
}

// Returns the full decoded content of README.md.
export async function fetchReadmeContent(owner: string, repo: string): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${FILE_PATH}`,
    { headers: buildHeaders() }
  )
  if (!res.ok) {
    throw new Error(`GitHub contents API returned ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { content: string; encoding: string }
  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected encoding from GitHub contents API: ${data.encoding}`)
  }
  return Buffer.from(data.content, 'base64').toString('utf-8')
}
