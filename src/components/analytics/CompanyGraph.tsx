'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import type { CompanyGraphData, GraphNode } from '@/app/api/analytics/company-graph/route'

// Canvas-based force graph — must be client-only (no SSR)
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then((m) => m.default),
  { ssr: false, loading: () => <GraphSkeleton /> }
)

// ─── Colors ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  saved:        '#3b82f6',
  applied:      '#6366f1',
  phone_screen: '#8b5cf6',
  technical:    '#a855f7',
  final:        '#f59e0b',
  offer:        '#10b981',
  rejected:     '#ef4444',
}
const DEFAULT_NODE_COLOR = '#3f3f46'
const EDGE_COLOR = 'rgba(113, 113, 122, 0.25)'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: string | null) {
  const map: Record<string, string> = {
    saved: 'Saved', applied: 'Applied', phone_screen: 'Phone Screen',
    technical: 'Technical', final: 'Final Round', offer: 'Offer', rejected: 'Rejected',
  }
  return s ? (map[s] ?? s) : 'No application'
}

// ─── Graph skeleton ───────────────────────────────────────────────────────────

function GraphSkeleton() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <svg className="animate-spin h-5 w-5 text-zinc-600 mx-auto" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-xs text-zinc-600">Building graph…</p>
      </div>
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  node: GraphNode
  x: number
  y: number
}

function NodeTooltip({ state }: { state: TooltipState }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      style={{ left: state.x + 14, top: state.y - 10 }}
      className="pointer-events-none absolute z-50 rounded-xl border border-zinc-700/60 bg-zinc-900 px-3 py-2.5 shadow-xl shadow-black/40 min-w-[140px]"
    >
      <p className="text-sm font-semibold text-zinc-100 leading-tight">{state.node.name}</p>
      <p className="text-xs text-zinc-500 mt-0.5">
        {state.node.roleCount} open role{state.node.roleCount !== 1 ? 's' : ''}
      </p>
      {state.node.applicationStatus && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: STATUS_COLOR[state.node.applicationStatus] ?? DEFAULT_NODE_COLOR }}
          />
          <span className="text-xs text-zinc-400">{statusLabel(state.node.applicationStatus)}</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Legend ──────────────────────────────────────────────────────────────────

const LEGEND = [
  { color: DEFAULT_NODE_COLOR, label: 'No application' },
  { color: STATUS_COLOR.saved!, label: 'Saved' },
  { color: STATUS_COLOR.applied!, label: 'Applied' },
  { color: STATUS_COLOR.phone_screen!, label: 'Interviewing' },
  { color: STATUS_COLOR.offer!, label: 'Offer' },
  { color: STATUS_COLOR.rejected!, label: 'Rejected' },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface CompanyGraphProps {
  initialData?: CompanyGraphData
}

interface ForceNode extends GraphNode {
  x?: number
  y?: number
}

export function CompanyGraph({ initialData }: CompanyGraphProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 })
  const [graphData, setGraphData] = useState<CompanyGraphData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // Fetch if not pre-loaded
  useEffect(() => {
    if (initialData) return
    fetch('/api/analytics/company-graph')
      .then((r) => r.json())
      .then((d) => { setGraphData(d as CompanyGraphData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [initialData])

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(400, entry.contentRect.height),
        })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Custom node painter
  const paintNode = useCallback((node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const radius = Math.max(10, Math.min(22, 10 + node.roleCount * 1.2))
    const color = node.applicationStatus
      ? (STATUS_COLOR[node.applicationStatus] ?? DEFAULT_NODE_COLOR)
      : DEFAULT_NODE_COLOR

    // Glow for applications
    if (node.applicationStatus && node.applicationStatus !== 'rejected') {
      ctx.shadowColor = color
      ctx.shadowBlur = 8
    }

    ctx.beginPath()
    ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    ctx.shadowBlur = 0

    // Ring for applied+
    if (node.applicationStatus && node.applicationStatus !== 'saved') {
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, radius + 2.5, 0, 2 * Math.PI)
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.4
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Initials (only when zoomed in enough)
    if (globalScale > 0.6) {
      const fontSize = Math.max(8, radius * 0.65)
      ctx.font = `600 ${fontSize}px system-ui`
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(node.initials, node.x ?? 0, node.y ?? 0)
    }
  }, [])

  const handleNodeHover = useCallback((node: ForceNode | null, _prev: ForceNode | null, event?: MouseEvent) => {
    if (!node || !event) {
      setTooltip(null)
      return
    }
    const container = containerRef.current?.getBoundingClientRect()
    setTooltip({
      node,
      x: event.clientX - (container?.left ?? 0),
      y: event.clientY - (container?.top ?? 0),
    })
  }, [])

  const handleNodeClick = useCallback((node: ForceNode) => {
    router.push(`/feed?search=${encodeURIComponent(node.name)}`)
  }, [router])

  if (loading) return <GraphSkeleton />

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2 max-w-[280px]">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
            <svg className="h-5 w-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304-.001a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.789M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-400">No companies yet</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Companies with open roles will appear here once jobs have been aggregated.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full h-full"
      >
        <ForceGraph2D
          graphData={{
            nodes: graphData.nodes as ForceNode[],
            links: graphData.edges.map((e) => ({
              source: e.source,
              target: e.target,
              weight: e.weight,
            })),
          }}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="transparent"
          nodeCanvasObject={paintNode as (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => void}
          nodeCanvasObjectMode={() => 'replace'}
          linkColor={() => EDGE_COLOR}
          linkWidth={(link) => ((link as { weight?: number }).weight ?? 0.3) * 2}
          linkDirectionalParticles={0}
          onNodeHover={handleNodeHover as (node: object | null, prev: object | null, event?: MouseEvent) => void}
          onNodeClick={handleNodeClick as (node: object, event: MouseEvent) => void}
          nodePointerAreaPaint={(rawNode, color, ctx) => {
            const node = rawNode as ForceNode
            const radius = Math.max(10, Math.min(22, 10 + node.roleCount * 1.2))
            ctx.beginPath()
            ctx.arc(node.x ?? 0, node.y ?? 0, radius + 4, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.fill()
          }}
          cooldownTicks={120}
          nodeLabel=""
        />
      </motion.div>

      {/* Tooltip */}
      {tooltip && <NodeTooltip state={tooltip} />}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 bg-zinc-950/80 backdrop-blur-sm rounded-xl border border-zinc-800 px-3 py-2.5">
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <p className="absolute top-3 right-4 text-[11px] text-zinc-700">
        Click a node to search that company in the feed
      </p>
    </div>
  )
}
