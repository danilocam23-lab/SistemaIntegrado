import { useMemo } from 'react'
import type { BacklogFuturo } from '../../types'
import type { BacklogPorPersonaMap } from './tipos'

/**
 * Agrupa el backlog futuro por `responsable_id` para reutilizarlo en la vista
 * "Por Personas" sin mezclarlo con las asignaciones reales.
 */
export function useBacklogFuturoPorPersona(backlogFuturo: BacklogFuturo[]) {
  const backlogPorPersonaMap = useMemo<BacklogPorPersonaMap>(() => {
    const map = new Map<string, BacklogFuturo[]>()

    for (const item of backlogFuturo) {
      if (!item.responsable_id) continue
      if (!map.has(item.responsable_id)) map.set(item.responsable_id, [])
      map.get(item.responsable_id)!.push(item)
    }

    return map
  }, [backlogFuturo])

  return { backlogPorPersonaMap }
}
