// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import client, { TOKEN_KEY, USUARIO_KEY, APP_KEY } from '../api/client'
import type { TokenResponse, Usuario } from '../types'
import { analitica, establecerIdentidadAnalitica, vaciarRegistroUso } from '../analitica'

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
      const tokenAlSolicitar = localStorage.getItem(TOKEN_KEY)
      if (!tokenAlSolicitar) return
      client.get<Usuario>('/auth/me')
        .then((r) => {
          // No resucitar sesión/identidad por una respuesta anterior al logout/login.
          if (localStorage.getItem(TOKEN_KEY) !== tokenAlSolicitar) return
          localStorage.setItem(USUARIO_KEY, JSON.stringify(r.data))
          setUsuario(r.data)
          establecerIdentidadAnalitica({ id_analitico: r.data.id_analitico, rol: r.data.rol })
          // Restauración de sesión tras recargar; idempotente si ya estaba iniciada.
          analitica.sesion('session_start')
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
    let data: TokenResponse
    try {
      data = (await client.post<TokenResponse>('/auth/login', { email, password })).data
    } catch (error) {
      analitica.sesion('login_failed')
      throw error
    }
    // Lo pendiente de la sesión/aplicación anterior sale con SUS credenciales, antes del cambio.
    vaciarRegistroUso()
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USUARIO_KEY, JSON.stringify(data.usuario))
    setUsuario(data.usuario)
    establecerIdentidadAnalitica({ id_analitico: data.usuario.id_analitico, rol: data.usuario.rol })
    analitica.sesion('session_start')
  }

  function logout(): void {
    // Antes de borrar el token: el envío con keepalive necesita credenciales vigentes.
    analitica.sesion('session_end')
    vaciarRegistroUso()
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USUARIO_KEY)
    localStorage.removeItem(APP_KEY)
    setUsuario(null)
    establecerIdentidadAnalitica(null)
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
