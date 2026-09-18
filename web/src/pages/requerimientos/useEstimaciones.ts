// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import client from '../../api/client'
import type { Estimacion, EstimacionConResumen, Requerimiento } from '../../types'

/** Estimaciones cargadas por requerimiento: qué filas tienen estimación (`estimacionIds`)
 *  y el detalle de las expandidas en la tabla (`estimacionesMap`). Se invoca sin condición
 *  en el shell (regla de oro del ADR 0005); el JSX de la fila y de la sub-fila expandida
 *  vive en `FilaRequerimiento.tsx`/`SubfilaEstimacionHU.tsx` (fase 8). */
export function useEstimaciones(datos: Requerimiento[]) {
  const [estimacionIds, setEstimacionIds] = useState<Set<string>>(new Set())
  const [estimacionesMap, setEstimacionesMap] = useState<Record<string, Estimacion>>({})
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set())
  const [loadingReqEst, setLoadingReqEst] = useState<Set<string>>(new Set())

  async function refreshEstimacionIds(): Promise<void> {
    const r = await client.get<Estimacion[]>('/estimaciones')
    const ids = new Set(r.data.filter((e) => e.requerimiento_id).map((e) => e.requerimiento_id!))
    setEstimacionIds(ids)
  }

  // INVARIANTE 4: este efecto re-dispara GET /estimaciones cada vez que `datos` cambia
  // (useLista devuelve un array nuevo en cada `recargar()`), es decir tras cada guardado
  // de celda y cada borrado. Comportamiento vigente: conservar deps: [datos] tal cual, sin
  // cambiarlo a [] ni a [datos.length].
  useEffect(() => {
    refreshEstimacionIds().catch(() => {})
  }, [datos])

  // Fix ex-INVARIANTE 6 (ADR 0005, ticket 6): la decisión de colapsar/expandir se toma
  // dentro de la propia actualización funcional de `setExpandedReqs` (bandera capturada
  // por referencia), en vez de leer `expandedReqs` del closure. Dos clics rápidos en
  // filas distintas ya no pueden perder una actualización.
  async function toggleExpandReq(reqId: string): Promise<void> {
    let estabaExpandido = false
    setExpandedReqs((prev) => {
      const next = new Set(prev)
      if (next.has(reqId)) { next.delete(reqId); estabaExpandido = true }
      else next.add(reqId)
      return next
    })
    if (estabaExpandido) return
    // Fix ex-INVARIANTE 5 (ADR 0005, ticket 1): estimacionesMap ya se invalida vía
    // `invalidarEstimacion`, llamada desde useCargaEstimacion.handleFileSelected (tras
    // reemplazar) y useModalEstimacion.deleteEstimation (tras borrar). Este guard de
    // caché ahora es seguro: si hay una entrada es porque sigue vigente.
    if (estimacionesMap[reqId]) return
    setLoadingReqEst((prev) => new Set(prev).add(reqId))
    try {
      const r = await client.get<EstimacionConResumen>(`/estimaciones/por-requerimiento/${reqId}`)
      if (r.data.exists && r.data.estimacion) {
        setEstimacionesMap((prev) => ({ ...prev, [reqId]: r.data.estimacion! }))
      }
    } catch { /* sin estimación */ }
    finally { setLoadingReqEst((prev) => { const n = new Set(prev); n.delete(reqId); return n }) }
  }

  /** Invalida la caché de una estimación puntual: la saca de `estimacionesMap` y colapsa
   *  su sub-fila si estaba expandida, para que el próximo `toggleExpandReq` dispare un
   *  fetch fresco. Conectar en todo flujo que reemplace o borre una estimación. */
  function invalidarEstimacion(reqId: string): void {
    setEstimacionesMap((prev) => {
      if (!(reqId in prev)) return prev
      const { [reqId]: _omitido, ...resto } = prev
      return resto
    })
    setExpandedReqs((prev) => {
      if (!prev.has(reqId)) return prev
      const next = new Set(prev)
      next.delete(reqId)
      return next
    })
  }

  return {
    estimacionIds,
    estimacionesMap,
    expandedReqs,
    loadingReqEst,
    refreshEstimacionIds,
    toggleExpandReq,
    invalidarEstimacion,
  }
}
