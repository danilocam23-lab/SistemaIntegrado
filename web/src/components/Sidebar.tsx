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
      { to: '/cifras', label: 'Cifras y ANS', permiso: 'cifras.ver' },
      { to: '/dashboard-estados', label: 'Estados', permiso: 'dashboard.estados.ver' },
      { to: '/dashboard-squad', label: 'Squad', permiso: 'dashboard.squad.ver' },
    ],
  },
  {
    titulo: 'Liquidación',
    items: [
      { to: '/requerimientos', label: 'Requerimientos' },
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
    ],
  },
  {
    titulo: 'Soporte',
    items: [
      { to: '/soporte/solicitudes-fabrica', label: 'Solicitudes Fábrica', permiso: 'soporte.solicitudes_fabrica.ver' },
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
    <aside className="w-60 shrink-0 bg-marca-osc p-4 text-slate-100">
      <div className="text-lg font-bold">Sistema Integrado</div>
      <div className="mb-6 text-xs text-slate-300">HITSS</div>
      {GRUPOS.map((grupo) => {
        const items = grupo.items.filter((i) => {
          if (i.permiso && !tienePermiso(i.permiso)) return false
          return true
        })
        if (items.length === 0) return null
        return (
          <div key={grupo.titulo} className="mb-4">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">
              {grupo.titulo}
            </div>
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded px-2 py-1.5 text-sm ${
                    isActive ? 'bg-white/15 text-white' : 'text-slate-200 hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )
      })}
    </aside>
  )
}
