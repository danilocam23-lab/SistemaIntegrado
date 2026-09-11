import { useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { EstimacionConResumen } from '../../types'
import type { ClaveSeccionResumen } from './tipos'

/** Estado y acciones del modal de estimación: abrir/cerrar, los 3 resúmenes colapsables,
 *  el detalle por HU, crear tareas en Azure DevOps y borrar la estimación. Se invoca sin
 *  condición en el shell (regla de oro del ADR 0005); solo el JSX del modal depende de
 *  `estModalReqId`. */
export function useModalEstimacion(
  setAviso: (v: string) => void,
  refreshEstimacionIds: () => Promise<void>,
  puedeGestionarEstimaciones: boolean,
) {
  const [estModalReqId, setEstModalReqId] = useState<string | null>(null)
  const [estData, setEstData] = useState<EstimacionConResumen | null>(null)
  const [estLoading, setEstLoading] = useState(false)
  const [creatingTasks, setCreatingTasks] = useState<'hitss' | 'epm' | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<ClaveSeccionResumen, boolean>>({ type: true, sprint: false, complexity: false })
  // INVARIANTE 18 (ADR 0005): expandedSections SÍ se reinicia en cada openEstimationModal
  // (más abajo), pero expandedHUs NO se limpia nunca: al abrir el modal de otro
  // requerimiento, una HU con la misma clave aparece ya expandida. Rareza vigente, se
  // conserva tal cual, no se corrige en el troceo.
  const [expandedHUs, setExpandedHUs] = useState<Set<string>>(new Set())

  async function openEstimationModal(reqId: string): Promise<void> {
    setEstModalReqId(reqId)
    setEstLoading(true)
    setEstData(null)
    setExpandedSections({ type: true, sprint: false, complexity: false })
    try {
      const r = await client.get<EstimacionConResumen>(`/estimaciones/por-requerimiento/${reqId}`)
      setEstData(r.data)
    } catch {
      setEstData({ exists: false, estimacion: null, summary: null })
    } finally {
      setEstLoading(false)
    }
  }

  function toggleSection(key: ClaveSeccionResumen): void {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleHU(key: string): void {
    setExpandedHUs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleCreateTasks(org: 'hitss' | 'epm'): Promise<void> {
    if (!puedeGestionarEstimaciones) return
    if (!estData?.estimacion) return
    setAviso('')
    setCreatingTasks(org)
    try {
      const r = await client.post<EstimacionConResumen & { creadas: number; errores: string[] }>(
        `/estimaciones/${estData.estimacion.id}/crear-tareas-${org}`,
      )
      setEstData({ exists: true, estimacion: r.data.estimacion, summary: r.data.summary })
      const partes = [`${r.data.creadas} tareas creadas en ${org.toUpperCase()}`]
      if (r.data.errores?.length) partes.push(`${r.data.errores.length} con error`)
      setAviso(partes.join(' · '))
    } catch (err) {
      setAviso(mensajeError(err))
    } finally {
      setCreatingTasks(null)
    }
  }

  async function deleteEstimation(): Promise<void> {
    if (!puedeGestionarEstimaciones) return
    if (!estData?.estimacion) return
    setAviso('')
    try {
      await client.delete(`/estimaciones/${estData.estimacion.id}`)
      setEstModalReqId(null)
      setEstData(null)
      await refreshEstimacionIds()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }

  return {
    estModalReqId, setEstModalReqId,
    estData, estLoading, creatingTasks,
    expandedSections, expandedHUs,
    openEstimationModal, toggleSection, toggleHU, handleCreateTasks, deleteEstimation,
  }
}
