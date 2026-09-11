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

  async function toggleExpandReq(reqId: string): Promise<void> {
    if (expandedReqs.has(reqId)) {
      setExpandedReqs((prev) => { const n = new Set(prev); n.delete(reqId); return n })
      return
    }
    setExpandedReqs((prev) => new Set(prev).add(reqId))
    // INVARIANTE 5: estimacionesMap es una caché que nunca se invalida. Tras reemplazar
    // una estimación, la sub-fila expandida sigue mostrando la versión anterior hasta
    // recargar la página. Bug latente vigente: se congela, no se arregla en el troceo.
    if (estimacionesMap[reqId]) return
    setLoadingReqEst((prev) => new Set(prev).add(reqId))
    try {
      const r = await client.get<EstimacionConResumen>(`/estimaciones/por-requerimiento/${reqId}`)
      if (r.data.exists && r.data.estimacion) {
        setEstimacionesMap((prev) => ({ ...prev, [reqId]: r.data.estimacion! }))
      }
    } catch { /* sin estimación */ }
    // INVARIANTE 6: esta rama lee `expandedReqs` del closure (arriba, en el `if`) en vez de
    // la forma funcional que sí usan las dos líneas de `setExpandedReqs`/`setLoadingReqEst`
    // de este mismo bloque. Dos clics muy rápidos en filas distintas pueden perder uno.
    // Copiado tal cual, sin "corregirlo" a forma funcional consistente.
    finally { setLoadingReqEst((prev) => { const n = new Set(prev); n.delete(reqId); return n }) }
  }

  return {
    estimacionIds,
    estimacionesMap,
    expandedReqs,
    loadingReqEst,
    refreshEstimacionIds,
    toggleExpandReq,
  }
}
