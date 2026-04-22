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
import { ApplicationList } from './ApplicationList'
import { LogApplicationModal } from '@/components/shared/LogApplicationModal'
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
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [showArchived, setShowArchived] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)

  const archivedCount = applications.filter(a => a.is_archived).length
  const visibleApps = showArchived ? applications : applications.filter(a => !a.is_archived)

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

  const handleArchive = useCallback((appId: string, archived: boolean) => {
    setApplications((prev) =>
      prev.map((a) => a.id === appId ? { ...a, is_archived: archived } : a)
    )
    // Close detail panel when archiving (card leaves active view)
    if (archived && !showArchived) setSelectedId(null)
  }, [showArchived])

  const handleApplicationLogged = useCallback((application: ApplicationWithJob) => {
    setApplications((prev) => [application, ...prev])
    setShowLogModal(false)
    setSelectedId(application.id)
  }, [])

  const appsByStatus = COLUMNS.reduce<Record<string, ApplicationWithJob[]>>((acc, col) => {
    acc[col.id] = visibleApps.filter((a) => a.status === col.id)
    return acc
  }, {})

  return (
    <>
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
        {/* View toggle */}
        <div className="flex items-center rounded-md border border-zinc-800 p-0.5 bg-zinc-900">
          <button
            onClick={() => setView('kanban')}
            className={`p-1.5 rounded transition-colors ${view === 'kanban' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="Kanban view"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4a1 1 0 001-1V5a1 1 0 00-1-1zm10 0h-4a1 1 0 00-1 1v6a1 1 0 001 1h4a1 1 0 001-1V5a1 1 0 00-1-1z" />
            </svg>
          </button>
          <button
            onClick={() => setView('list')}
            className={`p-1.5 rounded transition-colors ${view === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="List view"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Archive toggle */}
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived(s => !s)}
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
              showArchived
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            {showArchived ? 'Hide archived' : `Show archived (${archivedCount})`}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-600 tabular-nums">
            {applications.length} application{applications.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Log Application
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Kanban / List */}
        <div className="flex-1 overflow-x-auto">
          {view === 'kanban' ? (
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
          ) : (
            <ApplicationList
              applications={visibleApps}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
            />
          )}
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
                onArchive={handleArchive}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile detail */}
        <div className="lg:hidden">
          <ApplicationDetail
            app={selectedApp}
            onClose={() => setSelectedId(null)}
            onStatusChange={handleStatusChange}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onArchive={handleArchive}
          />
        </div>
      </div>

      {/* Empty state */}
      {applications.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-zinc-300">No applications yet</p>
            <p className="text-xs text-zinc-600 max-w-[260px] leading-relaxed">
              Save or apply to jobs from the feed, or log an application you already sent.
            </p>
            <button
              onClick={() => setShowLogModal(true)}
              className="pointer-events-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Log your first application
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Log Application modal */}
    <AnimatePresence>
      {showLogModal && (
        <LogApplicationModal
          onSuccess={handleApplicationLogged}
          onClose={() => setShowLogModal(false)}
        />
      )}
    </AnimatePresence>
    </>
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
