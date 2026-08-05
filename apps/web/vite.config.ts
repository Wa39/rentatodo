import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8081,
    strictPort: true,
  },
  esbuild: {
    // Strip console.* and debugger statements from the production bundle.
    // In dev mode (command === 'serve') they are kept so debugging still works.
    drop: command === 'build' ? ['console', 'debugger'] : [],
  },
}))
