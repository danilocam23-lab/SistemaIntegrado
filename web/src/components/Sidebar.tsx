import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Item {
  to: string
  label: string
  permiso?: string
}
interface Grupo {
  titulo: string
  items: Item[]
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'Dashboard',
    items: [
      { to: '/dashboard', label: 'Dashboard', permiso: 'dashboard.ver' },
      { to: '/dashboard-estados', label: 'Estados', permiso: 'dashboard.estados.ver' },
      { to: '/dashboard-backlog', label: 'Backlog', permiso: 'dashboard.squad.ver' },
    ],
  },
  {
    titulo: 'Requerimientos y entregas',
    items: [
      { to: '/requerimientos', label: 'Requerimientos', permiso: 'requerimientos.ver' },
      { to: '/requerimientos/detalle-ans', label: 'Detalle ANS', permiso: 'requerimientos.ver' },
      { to: '/entregas-actas', label: 'Entregas de Actas', permiso: 'entregas_actas.ver' },
    ],
  },
  {
    titulo: 'Carga de trabajo',
    items: [
      { to: '/personas', label: 'Personas', permiso: 'personas.ver' },
      { to: '/asignaciones', label: 'Asignaciones', permiso: 'asignaciones.ver' },
      { to: '/capacidades', label: 'Capacidades', permiso: 'capacidades.ver' },
      { to: '/azure-devops', label: 'Azure DevOps', permiso: 'azure_devops.ver' },
      { to: '/roadmap', label: 'Roadmap y equipo', permiso: 'roadmap.ver' },
    ],
  },
  {
    titulo: 'Facturación',
    items: [
      { to: '/facturacion/general', label: 'General', permiso: 'facturacion.ver' },
      { to: '/facturacion/valores-proyecto', label: 'Valores de proyecto', permiso: 'facturacion.ver' },
    ],
  },
  {
    titulo: 'Soporte',
    items: [
      { to: '/soporte/solicitudes-fabrica', label: 'Solicitudes Fábrica', permiso: 'soporte.solicitudes_fabrica.ver' },
      { to: '/soporte/detalle-ans', label: 'Detalle ANS', permiso: 'soporte.solicitudes_fabrica.ver' },
      { to: '/soporte/garantias-wo', label: 'Garantías WO', permiso: 'soporte.solicitudes_fabrica.ver' },
    ],
  },
  {
    titulo: 'Administración',
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
  return (
    <aside className="w-full shrink-0 bg-marca-osc p-3 text-slate-100 md:sticky md:top-0 md:max-h-screen md:w-60 md:overflow-y-auto md:p-4">
      <div className="flex items-baseline justify-between gap-3 md:block">
        <div className="text-base font-bold md:text-lg">Sistema Integrado</div>
        <div className="text-xs text-slate-300 md:mb-6">HITSS</div>
      </div>
      <nav className="mt-3 flex gap-3 overflow-x-auto pb-1 md:mt-0 md:block md:space-y-4 md:overflow-visible md:pb-0">
        {GRUPOS.map((grupo) => {
          const items = grupo.items.filter((i) => {
            if (i.permiso && !tienePermiso(i.permiso)) return false
            return true
          })
          if (items.length === 0) return null
          return (
            <div key={grupo.titulo} className="min-w-max md:min-w-0">
              <div className="mb-1 whitespace-nowrap text-[10px] uppercase tracking-wide text-slate-400 md:text-[11px]">
                {grupo.titulo}
              </div>
              <div className="flex gap-1 md:block">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `block whitespace-nowrap rounded px-2 py-1.5 text-xs md:text-sm ${
                        isActive ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/10'
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
