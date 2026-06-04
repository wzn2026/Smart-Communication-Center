import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BACKEND_URL is set to http://backend:8000 when running inside Docker Compose.
// Falls back to http://localhost:8000 for local development outside Docker.
const backendHttp = process.env.BACKEND_URL ?? 'http://localhost:8000'
const backendWs   = process.env.BACKEND_WS_URL ?? 'ws://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendHttp,
        changeOrigin: true,
      },
      '/ws': {
        target: backendWs,
        ws: true,
      },
    },
  },
})
