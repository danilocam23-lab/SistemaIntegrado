// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import { CLAVE_USUARIO_ESQUEMA } from '../../components/azure/useConfigPersonaAzure'
import type { Requerimiento } from '../../types'

export interface HorasAzureFeatureEntry {
  email: string | null
  original_estimate: number
  completed_work: number
  remaining_work: number
}

/**
 * Horas de Azure DevOps (Tasks de la Feature vinculada) para la pestaña "Por
 * Actas/Requerimientos": una sola llamada con los `id_azure_hitss` distintos
 * y no nulos presentes en `requerimientos`. Si ninguno tiene Feature
 * vinculada, no se hace fetch.
 */
export function useHorasAzurePorFeature(requerimientos: Requerimiento[]) {
  const idsUnicos = useMemo(() => {
    const set = new Set<number>()
    for (const req of requerimientos) {
      if (req.id_azure_hitss !== null) set.add(req.id_azure_hitss)
    }
    return Array.from(set)
  }, [requerimientos])

  const [horasAzurePorFeature, setHorasAzurePorFeature] = useState<Map<number, HorasAzureFeatureEntry[]>>(new Map())

  const clave = idsUnicos.join(',')

  useEffect(() => {
    if (!idsUnicos.length) {
      setHorasAzurePorFeature(new Map())
      return
    }
    const usuarioId = window.localStorage.getItem(CLAVE_USUARIO_ESQUEMA)
    const parametroUsuario = usuarioId ? `&usuario_id=${usuarioId}` : ''
    client
      .get<Record<string, HorasAzureFeatureEntry[]>>(
        `/azdo/esquema/horas-por-feature?ids=${clave}&target=hitss${parametroUsuario}`,
      )
      .then((r) => {
        const map = new Map<number, HorasAzureFeatureEntry[]>()
        for (const [id, entradas] of Object.entries(r.data ?? {})) {
          map.set(Number(id), Array.isArray(entradas) ? entradas : [])
        }
        setHorasAzurePorFeature(map)
      })
      .catch(() => setHorasAzurePorFeature(new Map()))
  }, [clave, idsUnicos.length])

  return { horasAzurePorFeature }
}
