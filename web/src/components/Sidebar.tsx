import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CLAVE_COLAPSADO = 'sidebar_colapsado'
const CLAVE_GRUPOS = 'sidebar_grupos_cerrados'

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

interface Props {
  /** Abre el menú como panel deslizante en móvil */
  abierto: boolean
  onCerrar: () => void
}

export default function Sidebar({ abierto, onCerrar }: Props) {
  const { tienePermiso } = useAuth()
  const { pathname } = useLocation()

  const [colapsado, setColapsado] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLAVE_COLAPSADO) === '1'
    } catch {
      return false
    }
  })
  const [gruposCerrados, setGruposCerrados] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(CLAVE_GRUPOS)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set(GRUPOS.map((g) => g.titulo))
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_GRUPOS, JSON.stringify(Array.from(gruposCerrados)))
    } catch {
      /* ignorar */
    }
  }, [gruposCerrados])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_COLAPSADO, colapsado ? '1' : '0')
    } catch {
      /* ignorar */
    }
  }, [colapsado])

  // Al navegar se cierra el panel móvil
  useEffect(() => {
    onCerrar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Abre automáticamente el grupo de la ruta activa
  useEffect(() => {
    const grupo = GRUPOS.find((g) => g.items.some((i) => pathname.startsWith(i.to)))
    if (!grupo) return
    setGruposCerrados((prev) => {
      if (!prev.has(grupo.titulo)) return prev
      const n = new Set(prev)
      n.delete(grupo.titulo)
      return n
    })
  }, [pathname])

  const alternarGrupo = (titulo: string) =>
    setGruposCerrados((prev) => {
      const n = new Set(prev)
      if (n.has(titulo)) n.delete(titulo)
      else n.add(titulo)
      return n
    })

  const ancho = colapsado ? 'md:w-[72px]' : 'md:w-64'

  return (
    <>
      {/* Velo en móvil */}
      <div
        onClick={onCerrar}
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity md:hidden ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 shrink-0 overflow-y-auto overflow-x-hidden border-r border-white/5 bg-marca-osc text-slate-100 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:max-h-screen md:translate-x-0 md:transition-[width] ${ancho} ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 p-3 md:p-4">
          <div className={`min-w-0 ${colapsado ? 'md:hidden' : ''}`}>
            <div className="text-base font-bold leading-tight text-white">Sistema Integrado</div>
            <div className="text-xs text-slate-300">HITSS</div>
          </div>
          {/* Colapsar (escritorio) */}
          <button
            type="button"
            onClick={() => setColapsado((v) => !v)}
            title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition-colors hover:bg-white/15 hover:text-white md:flex"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition-transform duration-200 ${colapsado ? 'rotate-180' : ''}`}>
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </button>
          {/* Cerrar (móvil) */}
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar menú"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 hover:text-white md:hidden"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <nav className="space-y-1 px-3 pb-6 pt-3 md:px-2.5">
          {GRUPOS.map((grupo) => {
            const items = grupo.items.filter((i) => !i.permiso || tienePermiso(i.permiso))
            if (items.length === 0) return null
            const abiertoGrupo = !gruposCerrados.has(grupo.titulo)
            const activoGrupo = items.some((i) => pathname.startsWith(i.to))

            // Modo colapsado (solo escritorio): un icono por grupo
            if (colapsado) {
              return (
                <button
                  key={grupo.titulo}
                  type="button"
                  title={grupo.titulo}
                  onClick={() => {
                    setGruposCerrados((prev) => {
                      const n = new Set(prev)
                      n.delete(grupo.titulo)
                      return n
                    })
                    setColapsado(false)
                  }}
                  className={`hidden h-11 w-11 items-center justify-center rounded-lg border text-xl transition-colors md:flex ${
                    activoGrupo
                      ? 'border-white/20 bg-white/15 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span aria-hidden="true">{grupo.icono}</span>
                </button>
              )
            }

            return (
              <div key={grupo.titulo}>
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo.titulo)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-2xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true">{grupo.icono}</span>
                    <span className="truncate">{grupo.titulo}</span>
                  </span>
                  <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3 w-3 shrink-0 transition-transform duration-200 ${abiertoGrupo ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
                  </svg>
                </button>

                {abiertoGrupo && (
                  <div className="mb-2 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                    {items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/dashboard'}
                        className={({ isActive }) =>
                          `block rounded-lg px-2.5 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-white/15 font-semibold text-white'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
