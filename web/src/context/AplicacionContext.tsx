import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import client, { APP_KEY, CONSOLIDADO } from '../api/client'
import type { Aplicacion } from '../types'
import { useAuth } from './AuthContext'

interface AplicacionContextValue {
  aplicaciones: Aplicacion[]
  activa: string
  modoConsolidado: boolean
  setActiva: (codigo: string) => void
  recargar: () => Promise<void>
}

const AplicacionContext = createContext<AplicacionContextValue | null>(null)

export function AplicacionProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [activa, setActivaState] = useState<string>(() => localStorage.getItem(APP_KEY) ?? '')

  function setActiva(codigo: string): void {
    localStorage.setItem(APP_KEY, codigo)
    setActivaState(codigo)
  }

  async function recargar(): Promise<void> {
    const { data } = await client.get<Aplicacion[]>('/aplicaciones')
    setAplicaciones(data)
    const guardada = localStorage.getItem(APP_KEY)
    const valida = guardada === CONSOLIDADO || data.some((a) => a.codigo === guardada)
    if (!valida && data[0]) setActiva(data[0].codigo)
  }

  useEffect(() => {
    if (usuario) void recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  return (
    <AplicacionContext.Provider
      value={{
        aplicaciones,
        activa,
        modoConsolidado: activa === CONSOLIDADO,
        setActiva,
        recargar,
      }}
    >
      {children}
    </AplicacionContext.Provider>
  )
}

export function useAplicacion(): AplicacionContextValue {
  const ctx = useContext(AplicacionContext)
  if (!ctx) throw new Error('useAplicacion debe usarse dentro de AplicacionProvider')
  return ctx
}
