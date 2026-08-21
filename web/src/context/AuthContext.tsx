import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import client, { TOKEN_KEY, USUARIO_KEY, APP_KEY } from '../api/client'
import type { TokenResponse, Usuario } from '../types'

interface AuthContextValue {
  usuario: Usuario | null
  esAdmin: boolean
  tienePermiso: (permiso: string) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function leerUsuario(): Usuario | null {
  const raw = localStorage.getItem(USUARIO_KEY)
  return raw ? (JSON.parse(raw) as Usuario) : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(leerUsuario)

  // Los permisos del usuario se guardan en localStorage al iniciar sesión, pero
  // pueden cambiar si un administrador edita el rol después (por ejemplo, al
  // agregar un nuevo permiso). Se refrescan automáticamente contra /auth/me al
  // cargar la app y al volver a la pestaña, sin exigir un nuevo login.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return
    const refrescar = () => {
      client.get<Usuario>('/auth/me')
        .then((r) => {
          localStorage.setItem(USUARIO_KEY, JSON.stringify(r.data))
          setUsuario(r.data)
        })
        .catch(() => {})
    }
    refrescar()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refrescar()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  async function login(email: string, password: string): Promise<void> {
    const { data } = await client.post<TokenResponse>('/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USUARIO_KEY, JSON.stringify(data.usuario))
    setUsuario(data.usuario)
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USUARIO_KEY)
    localStorage.removeItem(APP_KEY)
    setUsuario(null)
  }

  function tienePermiso(permiso: string): boolean {
    if (!usuario) return false
    return usuario.permisos.includes('*') || usuario.permisos.includes(permiso)
  }

  const esAdmin = !!usuario && (tienePermiso('admin.acceso') || usuario.rol === 'superadmin')

  return (
    <AuthContext.Provider value={{ usuario, esAdmin, tienePermiso, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
