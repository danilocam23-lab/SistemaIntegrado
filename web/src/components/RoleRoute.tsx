import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Protege rutas que solo pueden ver los roles de administración. */
export default function RoleRoute({ children, soloSuperadmin }: { children: ReactNode; soloSuperadmin?: boolean }) {
  const { usuario, esAdmin } = useAuth()
  if (!usuario) return <Navigate to="/login" replace />
  if (soloSuperadmin && usuario.rol !== 'superadmin') return <Navigate to="/dashboard" replace />
  if (!soloSuperadmin && !esAdmin) return <Navigate to="/requerimientos" replace />
  return <>{children}</>
}
