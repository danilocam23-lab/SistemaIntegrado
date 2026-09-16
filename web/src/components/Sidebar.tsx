import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icono } from './ui'
import type { NombreIcono } from './ui'

const CLAVE_COLAPSADO = 'sidebar_colapsado'
const CLAVE_GRUPOS = 'sidebar_grupos_cerrados'

interface Item {
  to: string
  label: string
  icono: NombreIcono
  permiso?: string
}
interface Grupo {
  titulo: string
  icono: NombreIcono
  items: Item[]
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'Dashboard',
    icono: 'panel',
    items: [
      { to: '/dashboard', label: 'Dashboard', icono: 'panel', permiso: 'dashboard.ver' },
      { to: '/dashboard-estados', label: 'Estados', icono: 'marcador', permiso: 'dashboard.estados.ver' },
      { to: '/dashboard-backlog', label: 'Backlog', icono: 'portafolio', permiso: 'dashboard.squad.ver' },
    ],
  },
  {
    titulo: 'Desarrollos de fábrica',
    icono: 'fabrica',
    items: [
      { to: '/requerimientos', label: 'Requerimientos', icono: 'documento', permiso: 'requerimientos.ver' },
      { to: '/requerimientos/detalle-ans', label: 'Detalle ANS', icono: 'objetivo', permiso: 'requerimientos.ver' },
      { to: '/entregas-actas', label: 'Entregas de Actas', icono: 'caja', permiso: 'entregas_actas.ver' },
      { to: '/predictivos', label: 'Predictivos', icono: 'tendencia', permiso: 'predictivos.ver' },
      { to: '/backlog-futuro', label: 'Backlog futuro', icono: 'calendario', permiso: 'backlog_futuro.ver' },
    ],
  },
  {
    titulo: 'Carga de trabajo',
    icono: 'personas',
    items: [
      { to: '/personas', label: 'Personas', icono: 'personas', permiso: 'personas.ver' },
      { to: '/asignaciones', label: 'Asignaciones', icono: 'etiqueta', permiso: 'asignaciones.ver' },
      { to: '/capacidades', label: 'Capacidades', icono: 'grafico-barras', permiso: 'capacidades.ver' },
      { to: '/planes-accion', label: 'Planes de acción', icono: 'check-circulo', permiso: 'planes_accion.ver' },
      { to: '/control-horas-facturable', label: 'Control de Horas Facturable', icono: 'estimacion', permiso: 'control_horas_facturable.ver' },
      { to: '/azure-devops', label: 'Azure DevOps', icono: 'nube', permiso: 'azure_devops.ver' },
      { to: '/roadmap', label: 'Roadmap y equipo', icono: 'cohete', permiso: 'roadmap.ver' },
    ],
  },
  {
    titulo: 'Facturación',
    icono: 'facturacion',
    items: [
      { to: '/facturacion/general', label: 'General', icono: 'facturacion', permiso: 'facturacion.ver' },
      { to: '/facturacion/ans-descontados', label: 'Ans descontados', icono: 'objetivo', permiso: 'facturacion.ans_descontados.ver' },
      { to: '/facturacion/valores-proyecto', label: 'Valores de proyecto', icono: 'grafico-linea', permiso: 'facturacion.ver' },
    ],
  },
  {
    titulo: 'Soporte',
    icono: 'soporte',
    items: [
      { to: '/soporte/solicitudes-fabrica', label: 'Solicitudes Fábrica', icono: 'fabrica', permiso: 'soporte.solicitudes_fabrica.ver' },
      { to: '/soporte/detalle-ans', label: 'Detalle ANS', icono: 'objetivo', permiso: 'soporte.solicitudes_fabrica.ver' },
      { to: '/soporte/garantias-wo', label: 'Garantías WO', icono: 'alerta', permiso: 'soporte.solicitudes_fabrica.ver' },
    ],
  },
  {
    titulo: 'Administración',
    icono: 'administracion',
    items: [
      { to: '/admin/aplicaciones', label: 'Squads', icono: 'edificio', permiso: 'aplicaciones.ver' },
      { to: '/admin/usuarios', label: 'Usuarios', icono: 'personas', permiso: 'admin.usuarios.ver' },
      { to: '/admin/importacion', label: 'Importar / Exportar datos', icono: 'recargar', permiso: 'admin.importacion.ver' },
      { to: '/admin/endpoints', label: 'Endpoints', icono: 'globo', permiso: 'admin.endpoints.ver' },
      { to: '/admin/esquema-azure', label: 'Esquema de Azure', icono: 'nube', permiso: 'azure_devops.ver' },
      { to: '/configuracion', label: 'Configuración', icono: 'administracion', permiso: 'admin.configuracion.ver' },
    ],
  },
]

/** Iniciales (1-2 letras) a partir del nombre completo del usuario, para el avatar del pie. */
function iniciales(nombre: string | undefined | null): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

interface Props {
  /** Abre el menú como panel deslizante en móvil */
  abierto: boolean
  onCerrar: () => void
}

export default function Sidebar({ abierto, onCerrar }: Props) {
  const { usuario, tienePermiso, logout } = useAuth()
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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-gradient-to-b from-marca-800 via-marca-900 to-slate-950 text-slate-100 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:max-h-screen md:translate-x-0 md:transition-[width] ${ancho} ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brillo radial decorativo, esquina superior izquierda */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-12 -top-12 z-0 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(77,142,211,0.35)_0%,rgba(44,114,189,0.10)_45%,transparent_70%)] blur-2xl"
        />

        <div className="relative z-10 flex h-full min-h-0 flex-col">
          {/* Cabecera */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-3 md:p-4">
            <div className={`flex min-w-0 items-center gap-2.5 ${colapsado ? 'md:hidden' : ''}`}>
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-marca-400 to-marca-600 text-sm font-bold tracking-tight text-white shadow-md shadow-marca-900/40">
                <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/30 to-transparent" />
                <span className="relative">SI</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight text-white">Sistema Integrado</div>
                <div className="text-2xs font-semibold uppercase tracking-widest text-marca-200/80">HITSS</div>
              </div>
            </div>
            {/* Colapsar (escritorio) */}
            <button
              type="button"
              onClick={() => setColapsado((v) => !v)}
              title={colapsado ? 'Expandir menú' : 'Colapsar menú'}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition-colors hover:border-marca-400/50 hover:bg-marca-500/20 hover:text-white md:flex"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:border-marca-400/50 hover:bg-marca-500/20 hover:text-white md:hidden"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden px-3 pb-6 pt-3 md:px-2.5">
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
                        ? 'border-marca-400/60 bg-marca-500/20 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icono nombre={grupo.icono} className="h-5 w-5" />
                  </button>
                )
              }

              return (
                <div key={grupo.titulo}>
                  <button
                    type="button"
                    onClick={() => alternarGrupo(grupo.titulo)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-2xs font-bold uppercase tracking-widest transition-colors hover:bg-white/5 hover:text-white ${
                      activoGrupo ? 'text-marca-200' : 'text-slate-400'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icono nombre={grupo.icono} className="h-4 w-4" />
                      <span className="truncate">{grupo.titulo}</span>
                    </span>
                    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3 w-3 shrink-0 transition-transform duration-200 ${abiertoGrupo ? 'rotate-180' : ''}`}>
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {abiertoGrupo && (
                    <div className="mb-3 mt-1 flex flex-col gap-0.5 pl-2">
                      {items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/dashboard'}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-2.5 text-sm transition-colors ${
                              isActive
                                ? 'bg-marca-500 font-semibold text-white shadow-md shadow-marca-600/40'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${
                                  isActive ? 'bg-white/20' : 'bg-white/[0.08]'
                                }`}
                              >
                                <Icono nombre={item.icono} className="h-3.5 w-3.5" />
                              </span>
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Pie: sesión del usuario */}
          <div className="shrink-0 border-t border-white/10 p-3">
            <div className={`flex items-center gap-2.5 rounded-lg bg-white/5 p-2 ${colapsado ? 'md:justify-center' : ''}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marca-300 to-marca-500 text-sm font-bold text-marca-900 shadow-sm">
                {iniciales(usuario?.nombre)}
              </div>
              <div className={`min-w-0 flex-1 ${colapsado ? 'md:hidden' : ''}`}>
                <div className="truncate text-sm font-semibold text-white">{usuario?.nombre}</div>
                <div className="truncate text-2xs text-slate-400">{usuario?.rol_nombre ?? usuario?.rol}</div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Cerrar sesión"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
                  colapsado ? 'md:hidden' : ''
                }`}
              >
                <Icono nombre="salir" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
