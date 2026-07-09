import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Protege rutas que solo pueden ver los roles de administración. */
export default function RoleRoute({
  children,
  permiso,
  soloSuperadmin,
}: {
  children: ReactNode
  permiso?: string
  soloSuperadmin?: boolean
}) {
  const { usuario, esAdmin, tienePermiso } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  if (soloSuperadmin && usuario.rol !== 'superadmin') return <Navigate to="/dashboard" replace />
  if (permiso && !tienePermiso(permiso)) return <Navigate to="/dashboard" replace />
  if (!soloSuperadmin && !permiso && !esAdmin) return <Navigate to="/requerimientos" replace />
  return <>{children}</>
}
