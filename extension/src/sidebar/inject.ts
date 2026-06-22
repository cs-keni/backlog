import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { Sidebar } from './Sidebar'
import type { PageInfo } from '../shared/types'
import sidebarCSS from './sidebar.css?inline'

const HOST_ID = 'backlog-sidebar-host'
let sidebarRoot: ReturnType<typeof createRoot> | null = null

export function injectSidebar(pageInfo: PageInfo): void {
  if (document.getElementById(HOST_ID)) {
    // Already exists — update page info by re-rendering
    updateSidebarPage(pageInfo)
    return
  }

  const host = document.createElement('div')
  host.id = HOST_ID
  // The host sits outside the layout flow; the inner panel handles its own positioning
  // Full-viewport transparent overlay — FAB and panel position themselves inside
  host.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 2147483647',
    'pointer-events: none',
  ].join('; ')

  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = sidebarCSS
  shadow.appendChild(style)

  const mount = document.createElement('div')
  mount.id = 'backlog-sidebar-inner'
  mount.style.cssText = 'width: 100%; height: 100%;'
  shadow.appendChild(mount)

  document.documentElement.appendChild(host)

  sidebarRoot = createRoot(mount)
  sidebarRoot.render(createElement(Sidebar, { initialPage: pageInfo }))
}

export function toggleSidebar(): void {
  const host = document.getElementById(HOST_ID)
  if (!host?.shadowRoot) return
  const mount = host.shadowRoot.getElementById('backlog-sidebar-inner')
  if (!mount) return
  const isHidden = mount.style.display === 'none'
  mount.style.display = isHidden ? '' : 'none'
  // Host is always pointer-events:none; inner panel handles its own pointer-events
}

export function updateSidebarPage(pageInfo: PageInfo): void {
  // Dispatch a custom event into the shadow root so Sidebar can react
  const host = document.getElementById(HOST_ID)
  if (!host?.shadowRoot) return
  host.shadowRoot.dispatchEvent(
    new CustomEvent('backlog:page-update', { detail: pageInfo, bubbles: false })
  )
}
