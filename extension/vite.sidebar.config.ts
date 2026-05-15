import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/sidebar/main.ts'),
      output: {
        format: 'iife',
        name: 'BacklogSidebar',
        entryFileNames: 'sidebar.js',
        inlineDynamicImports: true,
      },
    },
  },
})
