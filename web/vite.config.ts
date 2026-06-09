import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El backend FastAPI corre en :8000. En desarrollo, Vite hace proxy de /api.
// En producción (IIS), VITE_APP_BASE define el sub-path (p.ej. /SistemaIntegrado/).
export default defineConfig({
  base: process.env.VITE_APP_BASE ?? '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
