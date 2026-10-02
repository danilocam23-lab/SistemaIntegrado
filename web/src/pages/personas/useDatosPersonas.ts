// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react'
import client from '../../api/client'
import { useLista } from '../../api/hooks'
import { useAplicacion } from '../../context/AplicacionContext'
import type { Aplicacion, Persona } from '../../types'
import { ROLES_DEFAULT } from './roles'
import type { GrupoDuplicados } from './tipos'

/** Datos base de la pantalla: personas, squads, catálogos configurables y duplicados. */
export function useDatosPersonas(puedeDeduplicar: boolean) {
  const { activa } = useAplicacion()
  const lista = useLista<Persona>('/personas')
  const { datos: aplicaciones } = useLista<Aplicacion>('/aplicaciones')
  const [roles, setRoles] = useState<string[]>(ROLES_DEFAULT)
  const [tiposContratacion, setTiposContratacion] = useState<string[]>([])
  const [duplicados, setDuplicados] = useState<GrupoDuplicados[]>([])

  const cargarDuplicados = useCallback(async (): Promise<void> => {
    if (!puedeDeduplicar) return
    try {
      const { data } = await client.get<GrupoDuplicados[]>('/personas/duplicados')
      setDuplicados(data)
    } catch {
      // El banner es informativo: si falla, simplemente no se muestra.
      setDuplicados([])
    }
  }, [puedeDeduplicar])

  const { recargar } = lista

  // Recargar cuando cambia la aplicación activa.
  useEffect(() => {
    recargar()
    void cargarDuplicados()
  }, [activa, recargar, cargarDuplicados])

  useEffect(() => {
    client
      .get<string[]>('/personas/roles')
      .then((r) => {
        if (r.data.length > 0) setRoles(r.data)
      })
      .catch(() => {})
    client
      .get<string[]>('/personas/tipos-contratacion')
      .then((r) => {
        if (r.data.length > 0) setTiposContratacion(r.data)
      })
      .catch(() => {})
  }, [])

  const recargarTodo = useCallback(() => {
    recargar()
    void cargarDuplicados()
  }, [recargar, cargarDuplicados])

  return {
    personas: lista.datos,
    cargando: lista.cargando,
    error: lista.error,
    recargar,
    recargarTodo,
    aplicaciones,
    roles,
    tiposContratacion,
    duplicados,
    setDuplicados,
  }
}
