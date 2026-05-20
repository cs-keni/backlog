'use client'

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-900 border border-zinc-800" />
        ))}
      </div>
      <div className="h-44 rounded-xl bg-zinc-900 border border-zinc-800" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
      </div>
      <div className="h-36 rounded-xl bg-zinc-900 border border-zinc-800" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
        <div className="h-56 rounded-xl bg-zinc-900 border border-zinc-800" />
      </div>
    </div>
  )
}

