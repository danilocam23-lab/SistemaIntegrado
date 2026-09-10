import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// El backend FastAPI corre en :8000. En desarrollo, Vite hace proxy de /api.
// En producción (IIS), VITE_APP_BASE define el sub-path (p.ej. /SistemaIntegrado/).
//
// VITE_API_PROXY (solo dev): destino de la proxy de /api. Por defecto
// http://localhost:8000. Útil para apuntar el dev server a una API remota
// (p.ej. una sub-aplicación IIS) desde web/.env.local sin tocar código.
// Nota: http-proxy antepone el pathname del target, así que con
// VITE_API_PROXY=https://host/SistemaIntegrado una petición /api/auth/login
// sale como https://host/SistemaIntegrado/api/auth/login (no hace falta rewrite).
export default defineConfig(({ mode }) => {
  // process.env en vite.config.ts NO ve los .env*; hay que cargarlos a mano.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // La env var de shell (la usa deploy/publicar-iis.bat) tiene prioridad;
    // si no, se admite VITE_APP_BASE desde un archivo .env.
    base: process.env.VITE_APP_BASE || env.VITE_APP_BASE || '/',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
