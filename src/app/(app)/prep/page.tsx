import { PrepClient } from '@/components/prep/PrepClient'

interface PrepPageProps {
  searchParams: Promise<{ job_id?: string }>
}

export default async function PrepPage({ searchParams }: PrepPageProps) {
  const { job_id } = await searchParams
  return <PrepClient jobId={job_id ?? null} />
}
