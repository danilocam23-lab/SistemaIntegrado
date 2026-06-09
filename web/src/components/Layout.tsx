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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-white px-6 py-3">
          {mostrarSelector ? (
            <SelectorAplicacion />
          ) : (
            <span className="text-sm text-slate-400 italic">Datos globales del proyecto</span>
          )}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">
              {usuario?.nombre} · <b className="text-marca-osc">{usuario?.rol}</b>
            </span>
            <button onClick={logout} className="text-marca hover:underline">
              Salir
            </button>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
