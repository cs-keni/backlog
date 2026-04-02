import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

// Plugin to copy manifest.json and flatten popup.html to dist root
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    closeBundle() {
      mkdirSync('dist', { recursive: true })
      // Flatten popup HTML from dist/src/popup/ to dist/
      try { copyFileSync('dist/src/popup/index.html', 'dist/popup.html') } catch { /* already flat */ }
      // Copy manifest
      copyFileSync('public/manifest.json', 'dist/manifest.json')
    },
  }
}

export default defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk) => `${chunk.name}.js`,
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
})
