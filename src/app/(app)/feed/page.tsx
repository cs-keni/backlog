import { JobFeed } from '@/components/feed/JobFeed'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>
}) {
  const { job } = await searchParams
  return (
    <div className="relative h-full overflow-hidden">
      <JobFeed initialJobId={job} />
    </div>
  )
}
