// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import type { MetaMembresia } from '../../types'
import type { VigenciaMes } from './vigenciaCapacidad'

type RespuestaVigencias = Record<string, Record<string, string[]>>

const MAX_MESES_POR_PETICION = 60

function mesesEntre(desde: string, hasta: string): number {
  const [a1, m1] = desde.split('-').map(Number)
  const [a2, m2] = hasta.split('-').map(Number)
  return (a2 - a1) * 12 + (m2 - m1) + 1
}

/**
 * Vigencia mensual de membresías (`/membresias/vigencias`) y días hábiles por membresía
 * (`/membresias/metas`) para los periodos seleccionados. Cachea por aplicación activa y mes;
 * los meses se piden en paralelo. Un mes cuyas vigencias fallan queda en `null` (el consumidor
 * usa el comportamiento legado) y no se reintenta en bucle; si solo falla /metas, el factor es 1.
 */
export function useVigenciaBacklog(periodos: string[], activa: string | null | undefined) {
  const [cache, setCache] = useState<Record<string, VigenciaMes | null>>({})

  const faltantes = useMemo(
    () => periodos.filter((mes) => !(`${activa ?? ''}|${mes}` in cache)).sort(),
    [periodos, cache, activa],
  )
  const faltantesKey = faltantes.join(',')

  useEffect(() => {
    if (faltantes.length === 0) return
    let cancelado = false
    const clave = (mes: string) => `${activa ?? ''}|${mes}`
    const desde = faltantes[0]
    const hasta = faltantes[faltantes.length - 1]
    const rangos: Array<[string, string]> =
      mesesEntre(desde, hasta) <= MAX_MESES_POR_PETICION ? [[desde, hasta]] : faltantes.map((m) => [m, m])

    async function cargar(): Promise<void> {
      const [respuestas, metasPorMes] = await Promise.all([
        Promise.all(
          rangos.map((r) =>
            client
              .get<RespuestaVigencias>('/membresias/vigencias', { params: { desde: r[0], hasta: r[1] } })
              .then((x) => x.data)
              .catch(() => null),
          ),
        ),
        Promise.all(
          faltantes.map((mes) => {
            const [anio, numero] = mes.split('-')
            return client
              .get<MetaMembresia[]>('/membresias/metas', { params: { anio: Number(anio), mes: Number(numero) } })
              .then((x) => x.data)
              .catch(() => null)
          }),
        ),
      ])
      if (cancelado) return
      const nuevo: Record<string, VigenciaMes | null> = {}
      faltantes.forEach((mes, i) => {
        const idx = rangos.findIndex((r) => mes >= r[0] && mes <= r[1])
        const datos = idx >= 0 ? respuestas[idx] : null
        if (!datos) {
          nuevo[clave(mes)] = null
          return
        }
        const porPersona: Record<string, string[]> = {}
        for (const [personaId, meses] of Object.entries(datos)) porPersona[personaId] = meses[mes] ?? []
        const metas = metasPorMes[i]
        let diasHabiles: Record<string, number> | null = null
        if (metas) {
          diasHabiles = {}
          for (const m of metas) {
            const k = `${m.persona_id}|${m.squad_id}`
            diasHabiles[k] = (diasHabiles[k] ?? 0) + m.dias_habiles
          }
        }
        nuevo[clave(mes)] = { porPersona, conMembresia: new Set(Object.keys(datos)), diasHabiles }
      })
      setCache((previo) => ({ ...previo, ...nuevo }))
    }
    void cargar()
    return () => {
      cancelado = true
    }
    // `faltantes` se deriva de faltantesKey; evita relanzar por cambios de identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faltantesKey, activa])

  const vigenciaPorMes = useMemo(() => {
    const mapa = new Map<string, VigenciaMes | null>()
    for (const mes of periodos) {
      const v = cache[`${activa ?? ''}|${mes}`]
      if (v !== undefined) mapa.set(mes, v)
    }
    return mapa
  }, [periodos, cache, activa])

  return { vigenciaPorMes, cargandoVigencia: faltantes.length > 0 }
}
