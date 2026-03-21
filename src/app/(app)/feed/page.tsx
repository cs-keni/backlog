import { JobFeed } from '@/components/feed/JobFeed'
import RefreshButton from '@/components/feed/RefreshButton'

export default function FeedPage() {
  return (
    <div className="relative h-full overflow-hidden">
      <JobFeed />
      <RefreshButton />
    </div>
  )
}
