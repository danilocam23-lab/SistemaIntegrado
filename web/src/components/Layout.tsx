import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import SelectorAplicacion from './SelectorAplicacion'
import { useAuth } from '../context/AuthContext'

// Rutas donde el selector de squad no aplica (datos globales)
const RUTAS_SIN_SELECTOR = ['/configuracion']

export default function Layout() {
  const { usuario, logout } = useAuth()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const mostrarSelector = !RUTAS_SIN_SELECTOR.some((r) => pathname.startsWith(r))

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:px-6">
          {/* Menú móvil */}
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            title="Abrir menú"
            className="btn btn-secundario btn-icono md:hidden"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2.5 5.75A.75.75 0 0 1 3.25 5h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75Zm0 4.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75Zm.75 3.5a.75.75 0 0 0 0 1.5h13.5a.75.75 0 0 0 0-1.5H3.25Z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            {mostrarSelector ? (
              <SelectorAplicacion />
            ) : (
              <span className="text-sm italic text-slate-400">Datos globales del proyecto</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="hidden min-w-0 max-w-[220px] truncate text-slate-600 sm:inline">
              {usuario?.nombre} · <b className="text-marca-osc">{usuario?.rol_nombre ?? usuario?.rol}</b>
            </span>
            <button type="button" onClick={logout} className="btn btn-secundario btn-sm">
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
