// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useMemo } from 'react'
import type { Capacidad, Categoria, Configuracion, Persona, Requerimiento } from '../../types'
import { ESTADO_ACTIVO, ROLES_EXCLUIDOS } from './tipos'
import type {
  AsignacionItem,
  BacklogPorPersonaMap,
  GrupoPersona,
  GrupoReq,
  HorasAzureGrupo,
  OpcionReq,
  WoPersona,
} from './tipos'
import type { HorasAzureFeatureEntry } from './useHorasAzurePorFeature'

interface ParametrosDerivados {
  asignaciones: AsignacionItem[]
  personas: Persona[]
  categorias: Categoria[]
  requerimientos: Requerimiento[]
  configuraciones: Configuracion[]
  capacidades: Capacidad[]
  wosPorPersonaMap: Map<string, WoPersona[]>
  backlogPorPersonaMap: BacklogPorPersonaMap
  horasAzurePorFeature: Map<number, HorasAzureFeatureEntry[]>
  filtroEstado: string
  filtroPersona: string
  busquedaPersona: string
}

const horasAzureVacio = (): HorasAzureGrupo => ({ originalEstimate: 0, completedWork: 0, remainingWork: 0 })

/**
 * Todos los datos derivados de la pantalla de Asignaciones: mapas de apoyo,
 * opciones de requerimiento, cálculo de capacidad/porcentaje sugerido y el
 * agrupado por acta (`gruposReq` -> `gruposFiltrados`) y por persona
 * (`gruposPorPersona`, que deriva de `gruposFiltrados` y además incorpora WO y
 * backlog futuro informativo).
 */
export function useDerivadosAsignaciones({
  asignaciones,
  personas,
  categorias,
  requerimientos,
  configuraciones,
  capacidades,
  wosPorPersonaMap,
  backlogPorPersonaMap,
  horasAzurePorFeature,
  filtroEstado,
  filtroPersona,
  busquedaPersona,
}: ParametrosDerivados) {
  const personasDisponibles = useMemo(
    () => personas
      .filter((p) => p.rol_operativo && !ROLES_EXCLUIDOS.includes(p.rol_operativo))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [personas],
  )

  const personaPorId = useMemo(() => {
    const map = new Map<string, Persona>()
    for (const persona of personas) map.set(persona.id, persona)
    return map
  }, [personas])

  // Emails conocidos del sistema (para separar horas de Azure "sin persona"
  // de las que sí corresponden a alguien registrado, aunque no esté asignado
  // a este requerimiento).
  const emailsPersonasConocidas = useMemo(() => {
    const set = new Set<string>()
    for (const persona of personas) {
      if (persona.email) set.add(persona.email.trim().toLowerCase())
    }
    return set
  }, [personas])

  const categoriaPorId = useMemo(() => {
    const map = new Map<string, Categoria>()
    for (const categoria of categorias) map.set(categoria.id, categoria)
    return map
  }, [categorias])

  const reqPorId = useMemo(() => {
    const map = new Map<string, { sc: string; codigoReq: string; nombre: string }>()
    for (const req of requerimientos) {
      map.set(req.id, {
        sc: req.solicitud?.codigo_sc ?? '',
        codigoReq: req.codigo_req,
        nombre: req.nombre ?? '',
      })
    }
    return map
  }, [requerimientos])

  const reqIdsActivos = useMemo(() => {
    const ids = new Set<string>()
    for (const req of requerimientos) {
      if (req.estado === ESTADO_ACTIVO) ids.add(req.id)
    }
    return ids
  }, [requerimientos])

  const opcionesReq = useMemo<OpcionReq[]>(() => {
    return requerimientos
      .map((r) => ({
        id: r.id,
        label: [r.solicitud?.codigo_sc, r.codigo_req, r.nombre].filter(Boolean).join(' - '),
        aplicacionId: r.aplicacion_id,
        estado: r.estado,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [requerimientos])

  const horasMesDefault = useMemo(() => {
    const config = configuraciones.find((item) => item.clave === 'horas_mes_default')
    return config ? Number(config.valor) : 180
  }, [configuraciones])

  const capPorPersonaId = useMemo(() => {
    const map = new Map<string, number>()
    for (const capacidad of capacidades) {
      if (capacidad.persona_id && capacidad.scope === 'persona') {
        map.set(capacidad.persona_id, capacidad.horas_disponibles)
      }
    }
    return map
  }, [capacidades])

  const etiquetaReq = useCallback((reqId: string | null) => {
    if (!reqId) return 'Sin requerimiento'
    const req = reqPorId.get(reqId)
    if (!req) return reqId
    return [req.sc, req.codigoReq, req.nombre].filter(Boolean).join(' - ')
  }, [reqPorId])

  const capacidadUsada = useCallback((paraPersonaId: string, excluyendoId?: string) => {
    return asignaciones
      .filter((a) => a.persona_id === paraPersonaId && a.id !== excluyendoId)
      .filter((a) => a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)))
      .reduce((sum, a) => sum + a.total_porcentaje, 0)
  }, [asignaciones, reqIdsActivos])

  const calcularPctSugerido = useCallback((pid: string) => {
    const activas = asignaciones.filter((a) =>
      a.persona_id === pid &&
      a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)),
    ).length
    return String(Math.round(100 / (activas + 1)))
  }, [asignaciones, reqIdsActivos])

  const gruposReq = useMemo<GrupoReq[]>(() => {
    const map = new Map<string | null, GrupoReq>()

    for (const asig of asignaciones) {
      const reqId = asig.proyectos[0]?.requerimiento_id ?? null
      if (!map.has(reqId)) {
        const req = reqId ? requerimientos.find((item) => item.id === reqId) : null
        const info = reqId ? reqPorId.get(reqId) : null
        map.set(reqId, {
          reqId,
          reqLabel: info
            ? [info.sc, info.codigoReq, info.nombre].filter(Boolean).join(' - ')
            : (reqId ?? 'Sin requerimiento'),
          reqEstado: req?.estado ?? null,
          horasEstimadas: req?.total_horas_estimadas ?? null,
          idAzureHitss: req?.id_azure_hitss ?? null,
          horasAzureSinPersona: null,
          items: [],
        })
      }

      const grupo = map.get(reqId)!
      const horasBase = capPorPersonaId.get(asig.persona_id) ?? horasMesDefault
      const entradasAzure = grupo.idAzureHitss !== null
        ? horasAzurePorFeature.get(grupo.idAzureHitss) ?? []
        : null

      let horasAzure: HorasAzureGrupo | null = null
      if (entradasAzure !== null) {
        const emailPersona = personaPorId.get(asig.persona_id)?.email?.trim().toLowerCase()
        const entrada = emailPersona
          ? entradasAzure.find((e) => e.email?.trim().toLowerCase() === emailPersona)
          : undefined
        horasAzure = entrada
          ? {
            originalEstimate: entrada.original_estimate,
            completedWork: entrada.completed_work,
            remainingWork: entrada.remaining_work,
          }
          : horasAzureVacio()
      }

      grupo.items.push({
        asig,
        horasCarga: horasBase * (asig.total_porcentaje / 100),
        horasAzure,
      })
    }

    // Agregado "sin persona" por grupo: entradas de Azure cuyo email no
    // coincide con ningún `Persona.email` del sistema (incluye `email: null`).
    for (const grupo of map.values()) {
      if (grupo.idAzureHitss === null) continue
      const entradas = horasAzurePorFeature.get(grupo.idAzureHitss) ?? []
      const sinPersona = entradas.filter((e) => {
        const email = e.email?.trim().toLowerCase()
        return !email || !emailsPersonasConocidas.has(email)
      })
      grupo.horasAzureSinPersona = sinPersona.reduce(
        (acc, e) => ({
          originalEstimate: acc.originalEstimate + e.original_estimate,
          completedWork: acc.completedWork + e.completed_work,
          remainingWork: acc.remainingWork + e.remaining_work,
        }),
        horasAzureVacio(),
      )
    }

    return Array.from(map.values())
      .map((grupo) => ({
        ...grupo,
        items: [...grupo.items].sort((a, b) => {
          const nombreA = personaPorId.get(a.asig.persona_id)?.nombre ?? a.asig.persona_id
          const nombreB = personaPorId.get(b.asig.persona_id)?.nombre ?? b.asig.persona_id
          return nombreA.localeCompare(nombreB, 'es')
        }),
      }))
      .sort((a, b) => {
        if (!a.reqId && b.reqId) return 1
        if (a.reqId && !b.reqId) return -1
        return a.reqLabel.localeCompare(b.reqLabel, 'es')
      })
  }, [
    asignaciones,
    requerimientos,
    reqPorId,
    capPorPersonaId,
    horasMesDefault,
    personaPorId,
    horasAzurePorFeature,
    emailsPersonasConocidas,
  ])

  const estadosUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const grupo of gruposReq) {
      if (grupo.reqEstado) set.add(grupo.reqEstado)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [gruposReq])

  const gruposFiltrados = useMemo(() => {
    let resultado = gruposReq

    // Filtrar por estado
    if (filtroEstado === '__todos__') {
      // Mantener todos
    } else if (filtroEstado === '__sin_estado__') {
      resultado = resultado.filter((g) => !g.reqEstado)
    } else {
      resultado = resultado.filter((g) => g.reqEstado === filtroEstado)
    }

    // Filtrar por persona (dropdown)
    if (filtroPersona !== '__todos__') {
      resultado = resultado.map((g) => ({
        ...g,
        items: g.items.filter((item) => item.asig.persona_id === filtroPersona),
      }))
      resultado = resultado.filter((g) => g.items.length > 0)
    }

    // Filtrar por búsqueda de persona (texto)
    if (busquedaPersona.trim()) {
      const q = busquedaPersona.toLowerCase().trim()
      resultado = resultado.map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          const persona = personaPorId.get(item.asig.persona_id)
          return persona?.nombre.toLowerCase().includes(q)
        }),
      }))
      resultado = resultado.filter((g) => g.items.length > 0)
    }

    return resultado
  }, [gruposReq, filtroEstado, filtroPersona, busquedaPersona, personaPorId])

  // ─── Vista por personas: agrupa asignaciones por persona_id ───
  // INVARIANTE: `gruposPorPersona` reagrupa `gruposFiltrados` (no `gruposReq`),
  // así que ya hereda los filtros de estado y de persona (dropdown) aplicados
  // ahí. `busquedaPersona` se filtra en 2 niveles: aquí dentro de
  // `gruposFiltrados` (a nivel de `item`, arriba) y otra vez aquí a nivel de
  // `persona.nombre` (abajo) para excluir personas sin ninguna asignación que
  // matchee pero que sí tienen WO o backlog futuro (agregados por sus mapas).
  const gruposPorPersona = useMemo(() => {
    const map = new Map<string, GrupoPersona>()
    for (const grupo of gruposFiltrados) {
      for (const item of grupo.items) {
        const pid = item.asig.persona_id
        if (!map.has(pid)) {
          const persona = personaPorId.get(pid)
          if (!persona) continue
          map.set(pid, { persona, reqs: [] })
        }
        map.get(pid)!.reqs.push({ reqId: grupo.reqId, reqLabel: grupo.reqLabel, reqEstado: grupo.reqEstado, ...item })
      }
    }
    // Incluir personas que tienen WOs pero no asignaciones
    for (const [pid] of wosPorPersonaMap) {
      if (!map.has(pid)) {
        const persona = personaPorId.get(pid)
        if (persona) map.set(pid, { persona, reqs: [] })
      }
    }
    // Incluir personas que tienen backlog futuro pero no asignaciones reales
    for (const [pid] of backlogPorPersonaMap) {
      if (!map.has(pid)) {
        const persona = personaPorId.get(pid)
        if (persona) map.set(pid, { persona, reqs: [] })
      }
    }
    let resultado = Array.from(map.values()).sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre, 'es'))
    if (busquedaPersona.trim()) {
      const q = busquedaPersona.toLowerCase().trim()
      resultado = resultado.filter((g) => g.persona.nombre.toLowerCase().includes(q))
    }
    return resultado
  }, [gruposFiltrados, personaPorId, busquedaPersona, wosPorPersonaMap, backlogPorPersonaMap])

  return {
    personasDisponibles,
    personaPorId,
    categoriaPorId,
    reqPorId,
    reqIdsActivos,
    opcionesReq,
    horasMesDefault,
    capPorPersonaId,
    etiquetaReq,
    capacidadUsada,
    calcularPctSugerido,
    gruposReq,
    estadosUnicos,
    gruposFiltrados,
    gruposPorPersona,
  }
}
