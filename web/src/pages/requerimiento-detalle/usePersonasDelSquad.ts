import { useEffect, useState } from 'react'
import client from '../../api/client'
import type { Aplicacion, Persona, Squad } from '../../types'

interface Parametros {
  squadId: string
  personas: Persona[]
  squads: Aplicacion[]
  scrumId: string
  analistaId: string
}

/**
 * Resolución del squad seleccionado y de las personas que dependen de él
 * (Líder técnico Hitss/EPM, Scrum y Analista de requerimientos).
 *
 * - `ltHitss` / `ltEpm` se derivan de la lista `personas` (squad "ambiente").
 * - `scrums` / `analistas` se derivan de `personasSquad` (personas del squad
 *   elegido en el formulario), con opción de respaldo por id.
 * - `resolverNombreSquad` / `squadNombre` resuelven el nombre tanto si
 *   `squad_id` es el id de un documento `Squad` (importado) como si es el
 *   código de una `Aplicacion` (creado a mano). `codigoAppSquad` es el código
 *   que usan las escrituras en modo consolidado.
 */
export function usePersonasDelSquad({ squadId, personas, squads, scrumId, analistaId }: Parametros) {
  // Squads reales (colección squads) cargados en modo __todas__ para resolver
  // squad_id importados (que son id del Squad document, no código de aplicación)
  const [squadsDoc, setSquadsDoc] = useState<Squad[]>([])
  useEffect(() => {
    client.get<Squad[]>('/squads', { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setSquadsDoc(r.data))
      .catch(() => {
        client.get<Squad[]>('/squads').then((r) => setSquadsDoc(r.data)).catch(() => {})
      })
  }, [])

  const ltHitss = personas.filter((p) => p.activo && p.rol_operativo === 'LT_HITSS')
  const ltEpm = personas.filter((p) => p.activo && p.rol_operativo === 'LT_EPM')

  // Resuelve nombre del squad desde ambas fuentes:
  // - Aplicaciones (para registros creados manualmente: squad_id = codigo de app)
  // - Squad documents (para registros importados: squad_id = id del Squad)
  function resolverNombreSquad(id: string): string {
    if (!id) return '—'
    const porApp = squads.find((s) => s.codigo === id)
    if (porApp) return porApp.nombre
    const porDoc = squadsDoc.find((s) => String(s.id) === String(id))
    if (porDoc) return porDoc.nombre
    return id
  }

  const squadNombre = resolverNombreSquad(squadId)

  // El squadId puede ser el código de una Aplicación (registros creados a mano) o el id
  // de un documento Squad (registros importados). Para pedir personas del squad
  // correcto siempre se resuelve al código real de Aplicación a partir del nombre.
  const codigoAppSquad = squads.find((s) => s.codigo === squadId)?.codigo
    ?? squads.find((s) => s.nombre === squadNombre)?.codigo
    ?? ''

  // Las personas (`useLista('/personas')`) solo traen quienes pertenecen al squad
  // "ambiente" (el que se está navegando), no al squad seleccionado en este formulario.
  // Por eso, para el listado de Scrum se consulta explícitamente el squad elegido
  // (codigoAppSquad), así aparecen personas con varios squads aunque el squad del
  // requerimiento sea distinto al squad ambiente actual.
  const [personasSquad, setPersonasSquad] = useState<Persona[]>([])
  useEffect(() => {
    if (!codigoAppSquad) {
      setPersonasSquad([])
      return
    }
    client.get<Persona[]>('/personas', { headers: { 'X-Aplicacion': codigoAppSquad } })
      .then((r) => setPersonasSquad(r.data))
      .catch(() => setPersonasSquad([]))
  }, [codigoAppSquad])

  // Cuando ya se cargaron las personas del squad correcto (server-side ya filtra por
  // aplicacion_id o squads), no hace falta repetir el filtro por nombre de squad; solo
  // se re-aplica como respaldo si el fetch específico falló y se usa la lista ambiente.
  const scrums = (personasSquad.length > 0 ? personasSquad : personas).filter(
    (p) => p.activo && p.rol_operativo === 'SCRUM' && (
      personasSquad.length > 0 || !squadNombre || squadNombre === '—' || (p.squads ?? []).includes(squadNombre)
    ),
  )

  // Analistas de requerimientos: personas activas con rol Scrum o AR/QA del squad seleccionado.
  const analistas = (personasSquad.length > 0 ? personasSquad : personas).filter(
    (p) => p.activo && (p.rol_operativo === 'SCRUM' || p.rol_operativo === 'AR/QA') && (
      personasSquad.length > 0 || !squadNombre || squadNombre === '—' || (p.squads ?? []).includes(squadNombre)
    ),
  )

  // Respaldo: si el scrum ya asignado no aparece en ninguna de las listas anteriores
  // (por ejemplo, mientras el fetch por squad todavía no responde), se busca
  // puntualmente por id para no perder su nombre en el select.
  const [scrumAsignado, setScrumAsignado] = useState<Persona | null>(null)
  useEffect(() => {
    if (!scrumId) {
      setScrumAsignado(null)
      return
    }
    if (personas.some((p) => p.id === scrumId) || personasSquad.some((p) => p.id === scrumId)) {
      setScrumAsignado(null)
      return
    }
    client.get<Persona>(`/personas/${scrumId}`, { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setScrumAsignado(r.data))
      .catch(() => setScrumAsignado(null))
  }, [scrumId, personas, personasSquad])

  // Respaldo equivalente para el analista de requerimientos asignado.
  const [analistaAsignado, setAnalistaAsignado] = useState<Persona | null>(null)
  useEffect(() => {
    if (!analistaId) {
      setAnalistaAsignado(null)
      return
    }
    if (personas.some((p) => p.id === analistaId) || personasSquad.some((p) => p.id === analistaId)) {
      setAnalistaAsignado(null)
      return
    }
    client.get<Persona>(`/personas/${analistaId}`, { headers: { 'X-Aplicacion': '__todas__' } })
      .then((r) => setAnalistaAsignado(r.data))
      .catch(() => setAnalistaAsignado(null))
  }, [analistaId, personas, personasSquad])

  return {
    squadNombre,
    resolverNombreSquad,
    codigoAppSquad,
    personasSquad,
    ltHitss,
    ltEpm,
    scrums,
    analistas,
    scrumAsignado,
    analistaAsignado,
  }
}
