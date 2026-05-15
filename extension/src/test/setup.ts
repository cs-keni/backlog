// Global test setup for extension unit tests
// Provides chrome API stubs required by jsdom environment

import { vi } from 'vitest'

// Stub chrome extension APIs not available in jsdom
const chromeMock = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: { addListener: vi.fn() },
  },
  tabs: {
    sendMessage: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
  },
}

Object.defineProperty(globalThis, 'chrome', { value: chromeMock, writable: true })

// jsdom 29 does not expose a global CSS object (window.CSS), so CSS.escape throws
// inside fill.ts which swallows it in the try/catch, silently dropping fields.
// This polyfill matches the spec algorithm for ASCII-safe identifiers.
function cssEscapePolyfill(str: string): string {
  return str.replace(/[^\w-]/g, (c) => `\\${c}`)
}
const CSSGlobal = (globalThis as Record<string, unknown>)['CSS'] as Record<string, unknown> | undefined
if (CSSGlobal == null) {
  Object.defineProperty(globalThis, 'CSS', {
    value: { escape: cssEscapePolyfill },
    writable: true,
    configurable: true,
  })
} else if (typeof CSSGlobal['escape'] !== 'function') {
  CSSGlobal['escape'] = cssEscapePolyfill
}
