'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { motion, AnimatePresence } from 'framer-motion'
import { ApplicationCard } from './ApplicationCard'
import { ApplicationDetail } from './ApplicationDetail'
import type { ApplicationWithJob, ApplicationStatus } from '@/lib/jobs/types'

interface TrackerBoardProps {
  initialApplications: ApplicationWithJob[]
}

const COLUMNS: { id: ApplicationStatus; label: string; color: string; dot: string }[] = [
  { id: 'saved',        label: 'Saved',        color: 'text-zinc-400',   dot: 'bg-zinc-500' },
  { id: 'applied',      label: 'Applied',      color: 'text-blue-400',   dot: 'bg-blue-500' },
  { id: 'phone_screen', label: 'Phone Screen', color: 'text-yellow-400', dot: 'bg-yellow-500' },
  { id: 'technical',    label: 'Technical',    color: 'text-purple-400', dot: 'bg-purple-500' },
  { id: 'final',        label: 'Final Round',  color: 'text-orange-400', dot: 'bg-orange-500' },
  { id: 'offer',        label: 'Offer',        color: 'text-emerald-400',dot: 'bg-emerald-500' },
  { id: 'rejected',     label: 'Rejected',     color: 'text-red-400',    dot: 'bg-red-500' },
]

export function TrackerBoard({ initialApplications }: TrackerBoardProps) {
  const [applications, setApplications] = useState<ApplicationWithJob[]>(initialApplications)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const activeApp = activeId ? applications.find((a) => a.id === activeId) ?? null : null
  const selectedApp = selectedId ? applications.find((a) => a.id === selectedId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
    setSelectedId(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const appId = active.id as string
    const newStatus = over.id as ApplicationStatus
    const app = applications.find((a) => a.id === appId)
    if (!app || app.status === newStatus) return

    const oldStatus = app.status

    // Optimistic update
    setApplications((prev) =>
      prev.map((a) => a.id === appId ? { ...a, status: newStatus, last_updated: new Date().toISOString() } : a)
    )

    // Persist with rollback on failure
    fetch(`/api/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {
      setApplications((prev) =>
        prev.map((a) => a.id === appId ? { ...a, status: oldStatus } : a)
      )
    }).then((res) => {
      if (res && !res.ok) {
        setApplications((prev) =>
          prev.map((a) => a.id === appId ? { ...a, status: oldStatus } : a)
        )
      }
    })
  }

  const handleStatusChange = useCallback((appId: string, newStatus: ApplicationStatus) => {
    const app = applications.find((a) => a.id === appId)
    if (!app || app.status === newStatus) return
    const oldStatus = app.status

    setApplications((prev) =>
      prev.map((a) => a.id === appId ? { ...a, status: newStatus, last_updated: new Date().toISOString() } : a)
    )

    fetch(`/api/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {
      setApplications((prev) =>
        prev.map((a) => a.id === appId ? { ...a, status: oldStatus } : a)
      )
    })
  }, [applications])

  const handleUpdate = useCallback((appId: string, patch: Partial<ApplicationWithJob>) => {
    setApplications((prev) =>
      prev.map((a) => a.id === appId ? { ...a, ...patch } : a)
    )
  }, [])

  const handleDelete = useCallback((appId: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== appId))
    setSelectedId(null)
  }, [])

  const appsByStatus = COLUMNS.reduce<Record<string, ApplicationWithJob[]>>((acc, col) => {
    acc[col.id] = applications.filter((a) => a.status === col.id)
    return acc
  }, {})

  return (
    <div className="flex h-full overflow-hidden">
      {/* Kanban */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 p-5 h-full min-w-max">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                apps={appsByStatus[col.id] ?? []}
                selectedId={selectedId}
                onCardClick={setSelectedId}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
            {activeApp && (
              <ApplicationCard
                app={activeApp}
                index={0}
                isSelected={false}
                isDragOverlay
                onClick={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Desktop detail panel */}
      <AnimatePresence>
        {selectedApp && (
          <motion.div
            key="detail-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="shrink-0 hidden lg:block border-l border-zinc-800 overflow-hidden"
          >
            <ApplicationDetail
              app={selectedApp}
              onClose={() => setSelectedId(null)}
              onStatusChange={handleStatusChange}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile detail (full-screen overlay via ApplicationDetail's own AnimatePresence) */}
      <div className="lg:hidden">
        <ApplicationDetail
          app={selectedApp}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: typeof COLUMNS[number]
  apps: ApplicationWithJob[]
  selectedId: string | null
  onCardClick: (id: string) => void
}

function KanbanColumn({ column, apps, selectedId, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })

  return (
    <div className="flex flex-col w-[240px] shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full shrink-0 ${column.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${column.color}`}>
          {column.label}
        </span>
        <span className="ml-auto text-xs text-zinc-600 font-medium tabular-nums">
          {apps.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 rounded-xl min-h-[120px] p-2 transition-colors space-y-2
          ${isOver ? 'bg-zinc-800/60 ring-1 ring-zinc-700' : 'bg-zinc-900/40'}
        `}
      >
        <AnimatePresence initial={false}>
          {apps.map((app, i) => (
            <motion.div
              key={app.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <ApplicationCard
                app={app}
                index={i}
                isSelected={selectedId === app.id}
                onClick={() => onCardClick(selectedId === app.id ? '' : app.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {apps.length === 0 && (
          <div className={`h-full min-h-[80px] flex items-center justify-center rounded-lg border border-dashed transition-colors ${
            isOver ? 'border-zinc-600' : 'border-zinc-800'
          }`}>
            <span className="text-[11px] text-zinc-700">Drop here</span>
          </div>
        )}
      </div>
    </div>
  )
}
