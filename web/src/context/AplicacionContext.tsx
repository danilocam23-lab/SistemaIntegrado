// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import client, { APP_KEY, CONSOLIDADO } from '../api/client'
import type { Aplicacion } from '../types'
import { vaciarRegistroUso } from '../analitica'
import { useAuth } from './AuthContext'

interface AplicacionContextValue {
  aplicaciones: Aplicacion[]
  activa: string
  modoConsolidado: boolean
  /** true cuando la carga de squads activos devolvió una lista vacía. */
  sinSquads: boolean
  setActiva: (codigo: string) => void
  recargar: () => Promise<void>
}

const AplicacionContext = createContext<AplicacionContextValue | null>(null)

export function AplicacionProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [activa, setActivaState] = useState<string>(() => localStorage.getItem(APP_KEY) ?? '')
  const [sinSquads, setSinSquads] = useState(false)

  function setActiva(codigo: string): void {
    // Los eventos pendientes quedan atribuidos a la aplicación anterior y salen ya.
    if (localStorage.getItem(APP_KEY) !== codigo) vaciarRegistroUso()
    localStorage.setItem(APP_KEY, codigo)
    setActivaState(codigo)
  }

  async function recargar(): Promise<void> {
    // Solo squads activos: nunca se ofrece ni se deja activo uno inactivo.
    const { data: respuesta } = await client.get<Aplicacion[]>('/aplicaciones?incluir_inactivas=false')
    const data = respuesta.filter((a) => a.activa !== false)
    setAplicaciones(data)
    setSinSquads(data.length === 0)
    const guardada = localStorage.getItem(APP_KEY)
    if (data.length === 0) {
      // Sin squads (admin sin asignaciones o todos inactivos): no queda ninguno activo.
      // Se limpia también la clave guardada para no enviar un X-Aplicacion obsoleto.
      if (guardada) {
        vaciarRegistroUso()
        localStorage.removeItem(APP_KEY)
      }
      setActivaState('')
      return
    }
    // El modo consolidado solo se ofrece con más de un squad activo.
    const puedeVerConsolidado = data.length > 1
    const valida = (guardada === CONSOLIDADO && puedeVerConsolidado) || data.some((a) => a.codigo === guardada)
    if (!valida) setActiva(data[0].codigo)
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
        sinSquads,
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
