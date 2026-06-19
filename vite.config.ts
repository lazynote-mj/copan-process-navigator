import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { processDataApiPlugin } from './vite-plugin-process-data'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), processDataApiPlugin()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
