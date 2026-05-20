'use client'

export interface StoryMatch {
  id: string
  title: string
  theme: string
  situation: string | null
  action: string | null
  result: string | null
}

export function StoryMatchChips({ stories }: { stories: StoryMatch[] }) {
  if (stories.length === 0) return null
  return (
    <div className="px-3 pb-2 border-t border-zinc-800/50 pt-2">
      <p className="text-xs text-zinc-600 mb-1">Story bank:</p>
      <div className="flex gap-1.5 flex-wrap">
        {stories.slice(0, 2).map(story => (
          <span key={story.id} className="text-xs bg-zinc-800/60 text-zinc-500 px-2 py-0.5 rounded border border-zinc-700/50">
            {story.title}
          </span>
        ))}
      </div>
    </div>
  )
}

