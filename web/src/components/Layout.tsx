import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import SelectorAplicacion from './SelectorAplicacion'
import { useAuth } from '../context/AuthContext'

// Rutas donde el selector de squad no aplica (datos globales)
const RUTAS_SIN_SELECTOR = ['/configuracion']

export default function Layout() {
  const { usuario, logout } = useAuth()
  const { pathname } = useLocation()
  const mostrarSelector = !RUTAS_SIN_SELECTOR.some((r) => pathname.startsWith(r))

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-col gap-3 border-b bg-white/95 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="min-w-0">
            {mostrarSelector ? (
              <SelectorAplicacion />
            ) : (
              <span className="text-sm italic text-slate-400">Datos globales del proyecto</span>
            )}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3 text-sm sm:justify-end">
            <span className="min-w-0 truncate text-slate-600">
              {usuario?.nombre} · <b className="text-marca-osc">{usuario?.rol_nombre ?? usuario?.rol}</b>
            </span>
            <button onClick={logout} className="shrink-0 text-marca hover:underline">
              Salir
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
