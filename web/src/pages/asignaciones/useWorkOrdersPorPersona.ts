import { useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import type { Persona } from '../../types'
import type { WoPersona } from './tipos'

/**
 * WOs de soporte para la vista "Por Personas": carga única al montar (el array
 * de dependencias vacío del efecto es el comportamiento vigente, no se toca) y
 * cruce con `personas` por nombre en minúsculas.
 */
export function useWorkOrdersPorPersona(personas: Persona[]) {
  // WOs de soporte para vista por personas
  const [woPorPersona, setWoPorPersona] = useState<WoPersona[]>([])

  useEffect(() => {
    client
      .get<WoPersona[]>('/soporte/solicitudes-fabrica/wo-por-persona')
      .then((r) => setWoPorPersona(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  // Mapa de WOs por persona (matching por nombre)
  const wosPorPersonaMap = useMemo(() => {
    const map = new Map<string, WoPersona[]>()
    if (!personas.length || !woPorPersona.length) return map
    for (const wo of woPorPersona) {
      const nombreWo = wo.assigned_to.toLowerCase().trim()
      const persona = personas.find((p) => p.nombre.toLowerCase().trim() === nombreWo)
      if (persona) {
        if (!map.has(persona.id)) map.set(persona.id, [])
        map.get(persona.id)!.push(wo)
      }
    }
    return map
  }, [personas, woPorPersona])

  return { wosPorPersonaMap }
}
