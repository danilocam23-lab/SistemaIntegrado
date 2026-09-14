import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import SelectorAplicacion from './SelectorAplicacion'
import { Boton } from './ui'

// Rutas donde el selector de squad no aplica (datos globales)
const RUTAS_SIN_SELECTOR = ['/configuracion']

export default function Layout() {
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const mostrarSelector = !RUTAS_SIN_SELECTOR.some((r) => pathname.startsWith(r))

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:px-6">
          {/* Menú móvil */}
          <Boton
            variante="secundario"
            onClick={() => setMenuAbierto(true)}
            title="Abrir menú"
            className="btn-icono md:hidden"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M2.5 5.75A.75.75 0 0 1 3.25 5h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75Zm0 4.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 0 1.5H3.25a.75.75 0 0 1-.75-.75Zm.75 3.5a.75.75 0 0 0 0 1.5h13.5a.75.75 0 0 0 0-1.5H3.25Z" clipRule="evenodd" />
            </svg>
          </Boton>

          <div className="min-w-0 flex-1">
            {mostrarSelector ? (
              <SelectorAplicacion />
            ) : (
              <span className="text-sm italic text-slate-400">Datos globales del proyecto</span>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
