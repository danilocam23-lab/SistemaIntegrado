// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useMemo } from 'react'
import type { Capacidad, Categoria, Configuracion, Persona, Requerimiento } from '../../types'
import { ESTADO_ACTIVO, ROLES_EXCLUIDOS } from './tipos'
import type {
  AsignacionItem,
  BacklogPorPersonaMap,
  FiltroMostrar,
  GrupoPersona,
  GrupoReq,
  HorasAzureGrupo,
  ItemGrupo,
  OpcionReq,
  OrdenPersonas,
  WoPersona,
} from './tipos'
import { cargaVacia, HORAS_MES_POR_DEFECTO, repartirIgual } from './carga'
import type { CargaPersona } from './carga'
import { reqIdDeAsignacion } from './resolverApp'
import type { HorasAzureFeatureEntry } from './useHorasAzurePorFeature'

interface ParametrosDerivados {
  /** Asignaciones vigentes (sin las que están pendientes de eliminar con "Deshacer"). */
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
  /** Texto de búsqueda por requerimiento (SC, código REQ o nombre). */
  busquedaReq: string
  mostrar: FiltroMostrar
  orden: OrdenPersonas
}

/** Una fila del reparto propuesto: % actual y % nuevo de una asignación activa. */
export interface FilaReparto {
  asig: AsignacionItem
  reqLabel: string
  pctActual: number
  pctNuevo: number
}

const sinTildes = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const horasAzureVacio = (): HorasAzureGrupo => ({ originalEstimate: 0, completedWork: 0, remainingWork: 0 })

const sumarEntradas = (entradas: HorasAzureFeatureEntry[]): HorasAzureGrupo =>
  entradas.reduce(
    (acc, e) => ({
      originalEstimate: acc.originalEstimate + e.original_estimate,
      completedWork: acc.completedWork + e.completed_work,
      remainingWork: acc.remainingWork + e.remaining_work,
    }),
    horasAzureVacio(),
  )

/**
 * Todos los datos derivados de la pantalla de Asignaciones: mapas de apoyo,
 * opciones de requerimiento, carga por persona (medidor), validación de
 * capacidad, el agrupado por acta (`gruposReq` -> `gruposFiltrados`) y por
 * persona (`gruposPorPersona`, que además incorpora WO y backlog futuro).
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
  busquedaReq,
  mostrar,
  orden,
}: ParametrosDerivados) {
  // Solo personas activas con rol operativo (sin LT_EPM): para selectores y filtros.
  // Para MOSTRAR nombres se usa `personaPorId` (lista completa).
  const personasDisponibles = useMemo(
    () => personas
      .filter((p) => p.activo && p.rol_operativo && !ROLES_EXCLUIDOS.includes(p.rol_operativo))
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

  // Análogo a `emailsPersonasConocidas` pero guardando la Persona completa:
  // se usa para resolver nombres (modal de detalle) y para detectar personas
  // conocidas con horas de Azure pero sin Asignación creada en el grupo.
  const personaPorEmail = useMemo(() => {
    const map = new Map<string, Persona>()
    for (const persona of personas) {
      if (persona.email) map.set(persona.email.trim().toLowerCase(), persona)
    }
    return map
  }, [personas])

  const categoriaPorId = useMemo(() => {
    const map = new Map<string, Categoria>()
    for (const categoria of categorias) map.set(categoria.id, categoria)
    return map
  }, [categorias])

  const reqPorId = useMemo(() => {
    const map = new Map<string, { sc: string; codigoReq: string; nombre: string; req: Requerimiento }>()
    for (const req of requerimientos) {
      map.set(req.id, {
        sc: req.solicitud?.codigo_sc ?? '',
        codigoReq: req.codigo_req,
        nombre: req.nombre ?? '',
        req,
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
    const horas = config ? Number(config.valor) : HORAS_MES_POR_DEFECTO
    return Number.isFinite(horas) && horas > 0 ? horas : HORAS_MES_POR_DEFECTO
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

  const esAsignacionActiva = useCallback(
    (a: AsignacionItem) => a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)),
    [reqIdsActivos],
  )

  /** % que valida el tope del 100%: solo asignaciones en requerimientos activos. */
  const capacidadUsada = useCallback((paraPersonaId: string, excluyendoId?: string) => {
    return asignaciones
      .filter((a) => a.persona_id === paraPersonaId && a.id !== excluyendoId)
      .filter(esAsignacionActiva)
      .reduce((sum, a) => sum + a.total_porcentaje, 0)
  }, [asignaciones, esAsignacionActiva])

  /** Nº de asignaciones activas de una persona (para el atajo "reparto igual"). */
  const contarActivas = useCallback((pid: string, excluyendoId?: string) => {
    return asignaciones.filter((a) => a.persona_id === pid && a.id !== excluyendoId && esAsignacionActiva(a)).length
  }, [asignaciones, esAsignacionActiva])

  // ─── Carga por persona (medidor) ───
  // Se calcula sobre TODAS las asignaciones (no las filtradas): el medidor de
  // una persona no depende de los filtros de la pantalla.
  const cargaPorPersona = useMemo(() => {
    const map = new Map<string, CargaPersona>()
    for (const asig of asignaciones) {
      let carga = map.get(asig.persona_id)
      if (!carga) {
        const horasBase = capPorPersonaId.get(asig.persona_id)
        carga = cargaVacia(asig.persona_id, horasBase ?? horasMesDefault, horasBase === undefined)
        map.set(asig.persona_id, carga)
      }
      carga.nAsignaciones += 1
      if (esAsignacionActiva(asig)) {
        carga.activa += asig.total_porcentaje
        carga.nActivas += 1
      } else if (!asig.proyectos.some((p) => p.requerimiento_id)) {
        carga.sinReq += asig.total_porcentaje
      } else {
        carga.otros += asig.total_porcentaje
      }
    }
    for (const carga of map.values()) {
      carga.total = carga.activa + carga.sinReq
      carga.horas = carga.capacidadHoras * (carga.total / 100)
    }
    return map
  }, [asignaciones, capPorPersonaId, horasMesDefault, esAsignacionActiva])

  const cargaDe = useCallback((pid: string): CargaPersona => {
    const existente = cargaPorPersona.get(pid)
    if (existente) return existente
    const horasBase = capPorPersonaId.get(pid)
    return cargaVacia(pid, horasBase ?? horasMesDefault, horasBase === undefined)
  }, [cargaPorPersona, capPorPersonaId, horasMesDefault])

  /** Asignación existente de la persona en ese requerimiento (duplicado persona–requerimiento). */
  const asignacionExistente = useCallback((pid: string, reqId: string, excluyendoId?: string) => {
    if (!reqId) return null
    return asignaciones.find((a) =>
      a.persona_id === pid &&
      a.id !== excluyendoId &&
      a.proyectos.some((p) => p.requerimiento_id === reqId),
    ) ?? null
  }, [asignaciones])

  /** Reparto igual (suma exactamente 100) de las asignaciones activas de una persona. */
  const planReparto = useCallback((pid: string): FilaReparto[] => {
    const activas = asignaciones
      .filter((a) => a.persona_id === pid && esAsignacionActiva(a))
      .map((asig) => ({ asig, reqLabel: etiquetaReq(reqIdDeAsignacion(asig)) }))
      .sort((a, b) => a.reqLabel.localeCompare(b.reqLabel, 'es'))
    const reparto = repartirIgual(activas.length)
    return activas.map((fila, i) => ({
      asig: fila.asig,
      reqLabel: fila.reqLabel,
      pctActual: fila.asig.total_porcentaje,
      pctNuevo: reparto[i],
    }))
  }, [asignaciones, esAsignacionActiva, etiquetaReq])

  const personasSobrecarga = useMemo(() => {
    return personasDisponibles
      .map((persona) => ({ persona, carga: cargaDe(persona.id) }))
      .filter((fila) => fila.carga.total > 100)
      .sort((a, b) => b.carga.total - a.carga.total)
  }, [personasDisponibles, cargaDe])

  /** Requerimientos activos sin ninguna asignación (nadie a cargo). */
  const reqsSinAsignar = useMemo(() => {
    const conAsignacion = new Set<string>()
    for (const asig of asignaciones) {
      for (const p of asig.proyectos) if (p.requerimiento_id) conAsignacion.add(p.requerimiento_id)
    }
    return opcionesReq.filter((o) => reqIdsActivos.has(o.id) && !conAsignacion.has(o.id))
  }, [asignaciones, opcionesReq, reqIdsActivos])

  const gruposReq = useMemo<GrupoReq[]>(() => {
    const map = new Map<string | null, GrupoReq>()

    for (const asig of asignaciones) {
      const reqId = reqIdDeAsignacion(asig)
      if (!map.has(reqId)) {
        const info = reqId ? reqPorId.get(reqId) : null
        const req = info?.req ?? null
        map.set(reqId, {
          reqId,
          reqLabel: info
            ? [info.sc, info.codigoReq, info.nombre].filter(Boolean).join(' - ')
            : (reqId ?? 'Sin requerimiento'),
          reqEstado: req?.estado ?? null,
          horasEstimadas: req?.total_horas_estimadas ?? null,
          idAzureHitss: req?.id_azure_hitss ?? null,
          horasAzureSinPersona: null,
          horasAzureTotal: null,
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
      grupo.horasAzureTotal = sumarEntradas(entradas)
      grupo.horasAzureSinPersona = sumarEntradas(entradas.filter((e) => {
        const email = e.email?.trim().toLowerCase()
        return !email || !emailsPersonasConocidas.has(email)
      }))

      // Personas conocidas por el sistema con horas reales de Azure bajo esta
      // Feature pero sin Asignación creada en este requerimiento: se agregan
      // como filas sintéticas de solo lectura (ver FilaAsignacion).
      const personaIdsCubiertos = new Set(grupo.items.map((item) => item.asig.persona_id))
      for (const entrada of entradas) {
        const email = entrada.email?.trim().toLowerCase()
        if (!email) continue
        const persona = personaPorEmail.get(email)
        if (!persona) continue
        if (personaIdsCubiertos.has(persona.id)) continue
        personaIdsCubiertos.add(persona.id)
        const item: ItemGrupo = {
          asig: {
            id: `azure-sin-asignar-${grupo.reqId}-${persona.id}`,
            persona_id: persona.id,
            categoria_id: '',
            total_porcentaje: 0,
            estado: '',
            prioridad: false,
            proyectos: [{ id: '', nombre: '', estado: '', requerimiento_id: grupo.reqId }],
          },
          horasCarga: 0,
          horasAzure: {
            originalEstimate: entrada.original_estimate,
            completedWork: entrada.completed_work,
            remainingWork: entrada.remaining_work,
          },
          sinAsignacionFormal: true,
        }
        grupo.items.push(item)
      }
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
    reqPorId,
    capPorPersonaId,
    horasMesDefault,
    personaPorId,
    horasAzurePorFeature,
    emailsPersonasConocidas,
    personaPorEmail,
  ])

  const estadosUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const grupo of gruposReq) {
      if (grupo.reqEstado) set.add(grupo.reqEstado)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [gruposReq])

  // Un filtro de persona guardado que ya no existe (otra aplicación, persona
  // eliminada) se ignora en vez de dejar la pantalla vacía.
  const personaFiltrada = filtroPersona !== '__todos__' && personaPorId.has(filtroPersona)
    ? filtroPersona
    : '__todos__'

  const terminoReq = sinTildes(busquedaReq.trim())

  // Estado + persona + requerimiento: base común de las dos pestañas.
  const gruposBase = useMemo(() => {
    let resultado = gruposReq

    // Búsqueda por requerimiento: sin tildes ni mayúsculas, parcial, sobre SC - REQ - nombre.
    // El grupo "Sin requerimiento" solo aparece con la búsqueda vacía.
    if (terminoReq) {
      resultado = resultado.filter((g) => g.reqId !== null && sinTildes(g.reqLabel).includes(terminoReq))
    }

    if (filtroEstado === '__sin_estado__') {
      resultado = resultado.filter((g) => !g.reqEstado)
    } else if (filtroEstado !== '__todos__') {
      resultado = resultado.filter((g) => g.reqEstado === filtroEstado)
    }

    if (personaFiltrada !== '__todos__') {
      resultado = resultado
        .map((g) => ({ ...g, items: g.items.filter((item) => item.asig.persona_id === personaFiltrada) }))
        .filter((g) => g.items.length > 0)
    }

    return resultado
  }, [gruposReq, filtroEstado, personaFiltrada, terminoReq])

  // Pestaña "Por Actas": además aplica "Mostrar" (con alerta / prioridad) a las filas.
  const gruposFiltrados = useMemo(() => {
    if (mostrar === 'todo') return gruposBase
    const pasa = (item: ItemGrupo) => {
      if (mostrar === 'alerta') return cargaDe(item.asig.persona_id).total > 100
      return item.asig.prioridad === true && !item.sinAsignacionFormal
    }
    return gruposBase
      .map((g) => ({ ...g, items: g.items.filter(pasa) }))
      .filter((g) => g.items.length > 0)
  }, [gruposBase, mostrar, cargaDe])

  // ─── Vista por personas: agrupa asignaciones por persona_id ───
  // Reagrupa `gruposBase` (estado + persona). Las filas sintéticas de Azure
  // ("Sin asignación formal") NO son asignaciones: se excluyen. Las personas con
  // solo WO o backlog futuro también se incorporan, y los filtros de persona y de
  // estado les aplican igual (con estado activo hace falta una asignación en ese
  // estado; con persona elegida solo aparece esa persona).
  const gruposPorPersona = useMemo(() => {
    const map = new Map<string, GrupoPersona>()
    for (const grupo of gruposBase) {
      for (const item of grupo.items) {
        if (item.sinAsignacionFormal) continue
        const pid = item.asig.persona_id
        if (!map.has(pid)) {
          const persona = personaPorId.get(pid)
          if (!persona) continue
          map.set(pid, { persona, reqs: [] })
        }
        map.get(pid)!.reqs.push({
          reqId: grupo.reqId,
          reqLabel: grupo.reqLabel,
          reqEstado: grupo.reqEstado,
          asig: item.asig,
          horasCarga: item.horasCarga,
        })
      }
    }

    const sinFiltroEstado = filtroEstado === '__todos__' && !terminoReq
    if (sinFiltroEstado) {
      const incorporar = (pid: string) => {
        if (map.has(pid)) return
        if (personaFiltrada !== '__todos__' && pid !== personaFiltrada) return
        const persona = personaPorId.get(pid)
        if (persona) map.set(pid, { persona, reqs: [] })
      }
      for (const [pid] of wosPorPersonaMap) incorporar(pid)
      for (const [pid] of backlogPorPersonaMap) incorporar(pid)
    }

    let resultado = Array.from(map.values())

    if (mostrar === 'alerta') {
      resultado = resultado.filter((g) => cargaDe(g.persona.id).total > 100)
    } else if (mostrar === 'prioridad') {
      resultado = resultado
        .map((g) => ({ ...g, reqs: g.reqs.filter((r) => r.asig.prioridad === true) }))
        .filter((g) => g.reqs.length > 0)
    }

    resultado.sort((a, b) => {
      if (orden === 'carga') {
        const diferencia = cargaDe(b.persona.id).total - cargaDe(a.persona.id).total
        if (diferencia !== 0) return diferencia
      }
      return a.persona.nombre.localeCompare(b.persona.nombre, 'es')
    })
    return resultado
  }, [
    gruposBase,
    personaPorId,
    personaFiltrada,
    filtroEstado,
    terminoReq,
    mostrar,
    orden,
    wosPorPersonaMap,
    backlogPorPersonaMap,
    cargaDe,
  ])

  // ─── Resumen para KPI y mapa de carga (población: personas activas con rol) ───
  const resumen = useMemo(() => {
    const filas = personasDisponibles.map((persona) => ({ persona, carga: cargaDe(persona.id) }))
    const conCarga = filas.filter((f) => f.carga.total > 0)
    const media = filas.length > 0 ? filas.reduce((s, f) => s + f.carga.total, 0) / filas.length : 0
    const conHolgura = filas.filter((f) => f.carga.total < 70)
    let azureSinPersonaHoras = 0
    let azureSinPersonaReqs = 0
    for (const grupo of gruposReq) {
      const trabajado = grupo.horasAzureSinPersona?.completedWork ?? 0
      if (trabajado > 0) {
        azureSinPersonaHoras += trabajado
        azureSinPersonaReqs += 1
      }
    }
    const mapa = [...filas].sort((a, b) => {
      if (orden === 'carga') {
        const diferencia = b.carga.total - a.carga.total
        if (diferencia !== 0) return diferencia
      }
      return a.persona.nombre.localeCompare(b.persona.nombre, 'es')
    })
    return {
      totalPersonas: filas.length,
      conCarga: conCarga.length,
      media,
      capacidadBaseMedia: filas.length > 0 ? filas.reduce((s, f) => s + f.carga.capacidadHoras, 0) / filas.length : 0,
      conHolgura,
      azureSinPersonaHoras,
      azureSinPersonaReqs,
      mapa,
    }
  }, [personasDisponibles, cargaDe, gruposReq, orden])

  return {
    personasDisponibles,
    personaPorId,
    personaPorEmail,
    categoriaPorId,
    reqPorId,
    reqIdsActivos,
    opcionesReq,
    horasMesDefault,
    capPorPersonaId,
    etiquetaReq,
    capacidadUsada,
    contarActivas,
    cargaDe,
    asignacionExistente,
    planReparto,
    personasSobrecarga,
    reqsSinAsignar,
    resumen,
    gruposReq,
    estadosUnicos,
    gruposFiltrados,
    gruposPorPersona,
  }
}
