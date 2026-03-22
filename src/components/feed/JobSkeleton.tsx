'use client'

export function JobCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-2/3 rounded bg-zinc-800" />
          <div className="h-3 w-1/3 rounded bg-zinc-800" />
        </div>
        <div className="h-6 w-16 rounded-full bg-zinc-800" />
      </div>
      <div className="flex gap-2">
        <div className="h-3 w-20 rounded bg-zinc-800" />
        <div className="h-3 w-24 rounded bg-zinc-800" />
      </div>
    </div>
  )
}

export function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  )
}
