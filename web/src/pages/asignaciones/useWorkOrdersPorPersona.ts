// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import type { Persona } from '../../types'
import type { WoPersona } from './tipos'

/**
 * WOs de soporte para la vista "Por Personas": carga al montar (y al reintentar,
 * si falló) y cruce con `personas` por nombre en minúsculas. Expone `errorWo`
 * para avisar en pantalla en vez de mostrar "0 WO".
 */
export function useWorkOrdersPorPersona(personas: Persona[]) {
  // WOs de soporte para vista por personas
  const [woPorPersona, setWoPorPersona] = useState<WoPersona[]>([])

  const [error, setError] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    setError('')
    client
      .get<WoPersona[]>('/soporte/solicitudes-fabrica/wo-por-persona')
      .then((r) => setWoPorPersona(Array.isArray(r.data) ? r.data : []))
      .catch(() => setError('No fue posible cargar las solicitudes de soporte (WO)'))
  }, [intento])

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])

  // Mapa de WOs por persona (matching por nombre)
  const wosPorPersonaMap = useMemo(() => {
    const map = new Map<string, WoPersona[]>()
    if (!personas.length || !woPorPersona.length) return map
    const personaPorNombre = new Map<string, Persona>()
    for (const p of personas) personaPorNombre.set(p.nombre.toLowerCase().trim(), p)
    for (const wo of woPorPersona) {
      const nombreWo = (wo.assigned_to ?? '').toLowerCase().trim()
      const persona = personaPorNombre.get(nombreWo)
      if (persona) {
        if (!map.has(persona.id)) map.set(persona.id, [])
        map.get(persona.id)!.push(wo)
      }
    }
    return map
  }, [personas, woPorPersona])

  return { wosPorPersonaMap, errorWo: error, reintentarWo: reintentar }
}
