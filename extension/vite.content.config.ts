import { defineConfig } from 'vite'
import { resolve } from 'path'

// Standalone build for content.ts — intentionally single-entry so Rollup
// never extracts shared chunks. Without this, api.ts gets split into a
// chunks/api-*.js file that sandboxed iframes (Workday, Greenhouse embeds)
// block via CSP, causing "Cannot use import statement outside a module" errors.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/index.ts'),
      output: {
        format: 'es',
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
  },
})
