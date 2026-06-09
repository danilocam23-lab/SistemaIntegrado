import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Item {
  to: string
  label: string
  soloAdmin?: boolean
  soloSuperadmin?: boolean
}
interface Grupo {
  titulo: string
  items: Item[]
}

const GRUPOS: Grupo[] = [
  {
    titulo: 'General',
    items: [
      { to: '/dashboard', label: 'Dashboard', soloAdmin: false },
      { to: '/cifras', label: 'Cifras y ANS' },
    ],
  },
  {
    titulo: 'Liquidación',
    items: [
      { to: '/requerimientos', label: 'Requerimientos' },
      { to: '/entregas-actas', label: 'Entregas de Actas' },
    ],
  },
  {
    titulo: 'Carga de trabajo',
    items: [
      { to: '/personas', label: 'Personas' },
      { to: '/asignaciones', label: 'Asignaciones' },
      { to: '/capacidades', label: 'Capacidades' },
      { to: '/azure-devops', label: 'Azure DevOps' },
      { to: '/roadmap', label: 'Roadmap y equipo' },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { to: '/admin/aplicaciones', label: 'Squads', soloSuperadmin: true },
      { to: '/admin/usuarios', label: 'Usuarios', soloAdmin: true },
      { to: '/configuracion', label: 'Configuración', soloSuperadmin: true },
    ],
  },
]

export default function Sidebar() {
  const { esAdmin, usuario } = useAuth()
  const esSuperadmin = usuario?.rol === 'superadmin'
  return (
    <aside className="w-60 shrink-0 bg-marca-osc p-4 text-slate-100">
      <div className="text-lg font-bold">Sistema Integrado</div>
      <div className="mb-6 text-xs text-slate-300">HITSS</div>
      {GRUPOS.map((grupo) => {
        const items = grupo.items.filter((i) => {
          if (i.soloSuperadmin && !esSuperadmin) return false
          if (i.soloAdmin && !esAdmin) return false
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
