import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CLAVE_COLAPSADO = 'sidebar_colapsado'

interface Item {
  to: string
  label: string
  permiso?: string
}
interface Grupo {
  titulo: string
  icono: string
  items: Item[]
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'Dashboard',
    icono: '📊',
    items: [
      { to: '/dashboard', label: 'Dashboard', permiso: 'dashboard.ver' },
      { to: '/dashboard-estados', label: 'Estados', permiso: 'dashboard.estados.ver' },
      { to: '/dashboard-backlog', label: 'Backlog', permiso: 'dashboard.squad.ver' },
    ],
  },
  {
    titulo: 'Desarrollos de fábrica',
    icono: '📋',
    items: [
      { to: '/requerimientos', label: 'Requerimientos', permiso: 'requerimientos.ver' },
      { to: '/requerimientos/detalle-ans', label: 'Detalle ANS', permiso: 'requerimientos.ver' },
      { to: '/entregas-actas', label: 'Entregas de Actas', permiso: 'entregas_actas.ver' },
      { to: '/predictivos', label: 'Predictivos', permiso: 'predictivos.ver' },
    ],
  },
  {
    titulo: 'Carga de trabajo',
    icono: '👥',
    items: [
      { to: '/personas', label: 'Personas', permiso: 'personas.ver' },
      { to: '/asignaciones', label: 'Asignaciones', permiso: 'asignaciones.ver' },
      { to: '/capacidades', label: 'Capacidades', permiso: 'capacidades.ver' },
      { to: '/planes-accion', label: 'Planes de acción', permiso: 'planes_accion.ver' },
      { to: '/control-horas-facturable', label: 'Control de Horas Facturable', permiso: 'control_horas_facturable.ver' },
      { to: '/azure-devops', label: 'Azure DevOps', permiso: 'azure_devops.ver' },
      { to: '/roadmap', label: 'Roadmap y equipo', permiso: 'roadmap.ver' },
    ],
  },
  {
    titulo: 'Facturación',
    icono: '💰',
    items: [
      { to: '/facturacion/general', label: 'General', permiso: 'facturacion.ver' },
      { to: '/facturacion/valores-proyecto', label: 'Valores de proyecto', permiso: 'facturacion.ver' },
    ],
  },
  {
    titulo: 'Soporte',
    icono: '🛠️',
    items: [
      { to: '/soporte/solicitudes-fabrica', label: 'Solicitudes Fábrica', permiso: 'soporte.solicitudes_fabrica.ver' },
      { to: '/soporte/detalle-ans', label: 'Detalle ANS', permiso: 'soporte.solicitudes_fabrica.ver' },
      { to: '/soporte/garantias-wo', label: 'Garantías WO', permiso: 'soporte.solicitudes_fabrica.ver' },
    ],
  },
  {
    titulo: 'Administración',
    icono: '⚙️',
    items: [
      { to: '/admin/aplicaciones', label: 'Squads', permiso: 'aplicaciones.ver' },
      { to: '/admin/usuarios', label: 'Usuarios', permiso: 'admin.usuarios.ver' },
      { to: '/admin/importacion', label: 'Importar / Exportar datos', permiso: 'admin.importacion.ver' },
      { to: '/admin/endpoints', label: 'Endpoints', permiso: 'admin.endpoints.ver' },
      { to: '/configuracion', label: 'Configuración', permiso: 'admin.configuracion.ver' },
    ],
  },
]

export default function Sidebar() {
  const { tienePermiso } = useAuth()
  const [colapsado, setColapsado] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLAVE_COLAPSADO) === '1'
    } catch {
      return false
    }
  })
  const [gruposCerrados, setGruposCerrados] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('sidebar_grupos_cerrados')
      return raw ? new Set(JSON.parse(raw)) : new Set(GRUPOS.map((g) => g.titulo))
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('sidebar_grupos_cerrados', JSON.stringify(Array.from(gruposCerrados)))
    } catch {
      /* ignorar */
    }
  }, [gruposCerrados])

  const alternarGrupo = (titulo: string) => {
    setGruposCerrados((prev) => {
      const next = new Set(prev)
      if (next.has(titulo)) next.delete(titulo)
      else next.add(titulo)
      return next
    })
  }

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COLAPSADO, colapsado ? '1' : '0')
    } catch {
      /* ignorar */
    }
  }, [colapsado])

  return (
    <aside
      className={`shrink-0 border-r border-white/5 bg-marca-osc text-slate-100 transition-[width] duration-200 md:sticky md:top-0 md:max-h-screen md:overflow-y-auto md:overflow-x-hidden ${
        colapsado ? 'w-full md:w-[72px]' : 'w-full md:w-64'
      }`}
    >
      <div className={`flex items-center ${colapsado ? 'justify-center md:justify-center' : 'justify-between'} gap-3 p-3 md:p-4`}>
        <div className={`min-w-0 ${colapsado ? 'hidden' : ''}`}>
          <div className="text-base font-bold leading-tight md:text-lg">Sistema Integrado</div>
          <div className="text-xs text-slate-300">HITSS</div>
        </div>
        <button
          type="button"
          onClick={() => setColapsado((v) => !v)}
          title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          className="hidden shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 p-1.5 text-slate-200 transition hover:bg-white/15 md:flex"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform duration-200 ${colapsado ? 'rotate-180' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <nav
        className={`px-2 pb-3 md:mt-0 md:pb-4 ${
          colapsado
            ? 'grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-2 md:px-2'
            : 'flex gap-3 overflow-x-auto md:block md:space-y-1.5 md:overflow-visible md:px-3'
        }`}
      >
        {GRUPOS.map((grupo) => {
          const items = grupo.items.filter((i) => {
            if (i.permiso && !tienePermiso(i.permiso)) return false
            return true
          })
          if (items.length === 0) return null
          const abierto = !colapsado && !gruposCerrados.has(grupo.titulo)

          if (colapsado) {
            return (
              <div key={grupo.titulo} className="min-w-0">
                <button
                  type="button"
                  title={grupo.titulo}
                  onClick={() => {
                    setGruposCerrados((prev) => {
                      const next = new Set(prev)
                      next.delete(grupo.titulo)
                      return next
                    })
                    setColapsado(false)
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl text-slate-300 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white hover:shadow-md"
                >
                  <span aria-hidden="true">{grupo.icono}</span>
                </button>
              </div>
            )
          }

          return (
            <div key={grupo.titulo} className="min-w-max md:min-w-0">
              <button
                type="button"
                onClick={() => alternarGrupo(grupo.titulo)}
                className="mb-1 hidden w-full items-center justify-between whitespace-nowrap rounded px-1 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-200 md:flex md:text-[11px]"
              >
                <span>{grupo.titulo}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`h-3 w-3 shrink-0 transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <div className="mb-1 whitespace-nowrap text-[10px] uppercase tracking-wide text-slate-400 md:hidden">
                {grupo.titulo}
              </div>
              <div
                className={`flex flex-col gap-1 transition-all duration-200 md:gap-0.5 ${
                  abierto ? 'md:block md:overflow-visible' : 'md:hidden md:overflow-hidden'
                } md:flex-col`}
              >
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs transition-colors md:text-sm ${
                        isActive ? 'bg-white/15 font-medium text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
