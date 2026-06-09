import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import client, { TOKEN_KEY, USUARIO_KEY, APP_KEY } from '../api/client'
import { ROLES_ADMIN } from '../types'
import type { TokenResponse, Usuario } from '../types'

interface AuthContextValue {
  usuario: Usuario | null
  esAdmin: boolean
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

  const esAdmin = usuario ? ROLES_ADMIN.includes(usuario.rol) : false

  return (
    <AuthContext.Provider value={{ usuario, esAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
