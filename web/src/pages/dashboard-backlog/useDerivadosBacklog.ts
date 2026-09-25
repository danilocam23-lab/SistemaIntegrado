// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo } from 'react'
import { CONSOLIDADO } from '../../api/client'
import type { Capacidad, Configuracion, Festivo, Persona, Requerimiento } from '../../types'
import type {
  FilaCapacidadSquad,
  FilaDetalleAplicacionEpm,
  FilaDetallePersona,
  FilaDetalleWo,
  FilaEntregasMes,
  FilaSquad,
  FilaSquadAnalisis,
  FilaWoMes,
  NivelAvance,
  RegistroSoporteResumen,
  ResumenRiesgo,
} from './tipos'
import {
  contarDiasHabiles,
  fechaKey,
  formatearPeriodo,
  mesDesdeEntrega,
  mesDesdeFecha,
  mesDesdeRequerimiento,
  nivelDeAvance,
  numero,
  porcentajeCumplimiento,
} from './utilidades'

interface ParametrosDerivados {
  activa: string | null | undefined
  requerimientos: Requerimiento[]
  personas: Persona[]
  capacidades: Capacidad[]
  festivos: Festivo[]
  configuraciones: Configuracion[]
  soporteResumen: RegistroSoporteResumen[]
  resolverNombreSquad: (id: string | null) => string
  squadCodigoPorNombre: Map<string, string>
  periodosSeleccionados: string[]
  squadDetalleAplicaciones: string | null
  busquedaDetalleWo: string
  busquedaDetallePersonas: string
  busquedaDetalleAplicaciones: string
}

/** Entregas del requerimiento cuyo mes cae dentro de los periodos seleccionados. */
function entregasDelPeriodo(req: Requerimiento, periodos: Set<string>): Requerimiento['entregas'] {
  return (req.entregas ?? []).filter((entrega) => {
    const mes = mesDesdeEntrega(req, entrega)
    return mes !== null && periodos.has(mes)
  })
}

/**
 * Un requerimiento entra al periodo si alguna de sus entregas cae en él (mismo
 * criterio que `entregasPorMes`) o, si aún no tiene entregas, si su propia fecha
 * (inicio / solicitud de acta / solicitud) cae en él.
 */
function requerimientoEnPeriodo(req: Requerimiento, periodos: Set<string>): boolean {
  if ((req.entregas ?? []).length > 0) return entregasDelPeriodo(req, periodos).length > 0
  const mes = mesDesdeRequerimiento(req)
  return mes !== null && periodos.has(mes)
}

const ORDEN_NIVEL: Record<NivelAvance, number> = { exito: 0, alerta: 1, error: 2 }

function peorNivel(a: NivelAvance | null, b: NivelAvance | null): NivelAvance | null {
  if (a === null) return b
  if (b === null) return a
  return ORDEN_NIVEL[a] >= ORDEN_NIVEL[b] ? a : b
}

/**
 * Todos los datos derivados del dashboard de Backlog. Todo respeta el mismo
 * filtro de periodo (`periodosSeleccionados`).
 */
export function useDerivadosBacklog({
  activa,
  requerimientos,
  personas,
  capacidades,
  festivos,
  configuraciones,
  soporteResumen,
  resolverNombreSquad,
  squadCodigoPorNombre,
  periodosSeleccionados,
  squadDetalleAplicaciones,
  busquedaDetalleWo,
  busquedaDetallePersonas,
  busquedaDetalleAplicaciones,
}: ParametrosDerivados) {
  const periodos = useMemo(() => new Set(periodosSeleccionados), [periodosSeleccionados])

  const requerimientosPeriodo = useMemo(
    () => requerimientos.filter((req) => requerimientoEnPeriodo(req, periodos)),
    [requerimientos, periodos],
  )

  const filas = useMemo<FilaSquad[]>(() => {
    const mapa = new Map<string, FilaSquad>()
    const aplicacionesEpmPorSquad = new Map<string, Set<string>>()
    for (const req of requerimientosPeriodo) {
      // aplicacion_id es el campo autoritativo de pertenencia al squad (consistente con el
      // filtro de squad activo). solicitud.squad_id puede estar desactualizado en datos legados
      // y no debe usarse para agrupar/mostrar cuando aplicacion_id está presente.
      const squadId = req.aplicacion_id || req.solicitud?.squad_id || null
      const squad = resolverNombreSquad(squadId)
      const key = squad
      const entregas = entregasDelPeriodo(req, periodos)
      const actual = mapa.get(key) ?? {
        squadId,
        squad,
        reqs: 0,
        horas: 0,
        horasEntregas: 0,
        entregas: 0,
        ansActaCumple: 0,
        ansActaTotal: 0,
        ansEntregaCumple: 0,
        ansEntregaTotal: 0,
        aplicacionesEpmCount: 0,
      }
      actual.reqs += 1
      actual.horas += Number(req.total_horas_estimadas ?? 0)
      actual.entregas += entregas.length
      for (const entrega of entregas) actual.horasEntregas += Number(entrega.horas ?? 0)
      if (req.ans_acta) {
        actual.ansActaTotal += 1
        if (req.ans_acta === 'CUMPLE') actual.ansActaCumple += 1
      }
      for (const entrega of entregas) {
        if (!entrega.ans_entrega) continue
        actual.ansEntregaTotal += 1
        if (entrega.ans_entrega === 'CUMPLE') actual.ansEntregaCumple += 1
      }
      mapa.set(key, actual)

      const aplicacionEpm = req.nombre ? req.nombre.split('-')[0].trim() : ''
      if (aplicacionEpm) {
        const setAplicaciones = aplicacionesEpmPorSquad.get(key) ?? new Set<string>()
        setAplicaciones.add(aplicacionEpm)
        aplicacionesEpmPorSquad.set(key, setAplicaciones)
      }
    }
    for (const [key, fila] of mapa) {
      fila.aplicacionesEpmCount = aplicacionesEpmPorSquad.get(key)?.size ?? 0
    }
    return Array.from(mapa.values()).sort((a, b) => b.reqs - a.reqs || b.horas - a.horas)
  }, [requerimientosPeriodo, periodos, resolverNombreSquad])

  const horasMesDefault = useMemo(() => {
    const config = configuraciones.find((item) => item.clave === 'horas_mes_default')
    const valor = config ? Number(config.valor) : 180
    return Number.isFinite(valor) && valor > 0 ? valor : 180
  }, [configuraciones])

  const festivosPorMes = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const festivo of festivos) {
      const keyMes = fechaKey(festivo.fecha).slice(0, 7)
      const keyDia = fechaKey(festivo.fecha)
      if (!mapa.has(keyMes)) mapa.set(keyMes, new Set<string>())
      mapa.get(keyMes)?.add(keyDia)
    }
    return mapa
  }, [festivos])

  const capacidadPorPersonaMes = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const capacidad of capacidades) {
      if (capacidad.scope === 'persona' && capacidad.persona_id && capacidad.mes) {
        mapa.set(`${capacidad.persona_id}|${capacidad.mes}`, Number(capacidad.horas_disponibles ?? 0))
      }
    }
    return mapa
  }, [capacidades])

  /**
   * Recorre periodo x persona activa (sin LT_EPM) y llama a `alVisitar` por cada
   * squad al que aporta, con las horas disponibles de esa persona en el periodo.
   * Es el recorrido común de capacidad por squad, detalle por persona y resumen.
   */
  const recorrerCapacidad = useMemo(() => {
    const squadActivaNombre = activa && activa !== CONSOLIDADO ? resolverNombreSquad(activa) : ''

    return (
      alVisitar: (visita: {
        persona: Persona
        periodo: string
        squadId: string
        horasDefaultMes: number
      }) => void,
    ) => {
      for (const periodo of periodosSeleccionados) {
        const festivosMesSeleccionado = festivosPorMes.get(periodo) ?? new Set<string>()
        const diasLaborables = contarDiasHabiles(periodo, new Set())
        const diasHabiles = contarDiasHabiles(periodo, festivosMesSeleccionado)
        const factorMes = diasLaborables > 0 ? diasHabiles / diasLaborables : 1
        const horasDefaultMes = horasMesDefault * factorMes

        for (const persona of personas) {
          if (!persona.activo || persona.rol_operativo === 'LT_EPM') continue
          const squadsNormalizados = (persona.squads ?? []).map((squad) => squadCodigoPorNombre.get(squad) ?? squad)
          const perteneceActiva =
            activa !== CONSOLIDADO &&
            !!activa &&
            (
              squadsNormalizados.length === 0 ||
              squadsNormalizados.includes(activa) ||
              (squadActivaNombre ? (persona.squads ?? []).includes(squadActivaNombre) : false)
            )

          const squadsPersona = activa !== CONSOLIDADO && activa
            ? (perteneceActiva ? [activa] : [])
            : squadsNormalizados

          for (const squadId of squadsPersona) {
            alVisitar({ persona, periodo, squadId, horasDefaultMes })
          }
        }
      }
    }
  }, [
    activa,
    festivosPorMes,
    horasMesDefault,
    personas,
    periodosSeleccionados,
    squadCodigoPorNombre,
    resolverNombreSquad,
  ])

  const filasCapacidadSquad = useMemo<FilaCapacidadSquad[]>(() => {
    const mapa = new Map<string, FilaCapacidadSquad>()
    recorrerCapacidad(({ persona, periodo, squadId, horasDefaultMes }) => {
      const capacidadPersona = capacidadPorPersonaMes.get(`${persona.id}|${periodo}`) ?? horasDefaultMes
      const actual = mapa.get(squadId) ?? { squadId, squad: resolverNombreSquad(squadId), horas: 0, personas: 0 }
      actual.horas += capacidadPersona
      actual.personas += 1
      mapa.set(squadId, actual)
    })
    return Array.from(mapa.values()).sort((a, b) => b.horas - a.horas || b.personas - a.personas)
  }, [recorrerCapacidad, capacidadPorPersonaMes, resolverNombreSquad])

  const detallePersonasCapacidad = useMemo<FilaDetallePersona[]>(() => {
    const mapa = new Map<string, FilaDetallePersona>()
    recorrerCapacidad(({ persona, periodo, squadId, horasDefaultMes }) => {
      const claveCapacidad = `${persona.id}|${periodo}`
      const tieneConfigPersonalizada = capacidadPorPersonaMes.has(claveCapacidad)
      const capacidadPersona = capacidadPorPersonaMes.get(claveCapacidad) ?? horasDefaultMes
      const key = `${persona.id}|${squadId}`
      const actual = mapa.get(key) ?? {
        personaId: persona.id,
        nombre: persona.nombre,
        squad: resolverNombreSquad(squadId),
        horas: 0,
        personalizada: false,
        predeterminada: false,
      }
      actual.horas += capacidadPersona
      if (tieneConfigPersonalizada) actual.personalizada = true
      else actual.predeterminada = true
      mapa.set(key, actual)
    })
    return Array.from(mapa.values()).sort((a, b) => b.horas - a.horas || a.nombre.localeCompare(b.nombre))
  }, [recorrerCapacidad, capacidadPorPersonaMes, resolverNombreSquad])

  const detallePersonasCapacidadFiltrado = useMemo(() => {
    const busqueda = busquedaDetallePersonas.trim().toLowerCase()
    if (!busqueda) return detallePersonasCapacidad
    return detallePersonasCapacidad.filter(
      (fila) => fila.nombre.toLowerCase().includes(busqueda) || fila.squad.toLowerCase().includes(busqueda),
    )
  }, [busquedaDetallePersonas, detallePersonasCapacidad])

  const detalleAplicacionesEpmPorSquad = useMemo<FilaDetalleAplicacionEpm[]>(() => {
    if (!squadDetalleAplicaciones) return []
    const mapa = new Map<string, number>()
    // Mismo conjunto de requerimientos que la tabla, para que el detalle cuadre con el conteo.
    for (const req of requerimientosPeriodo) {
      const squadId = req.aplicacion_id || req.solicitud?.squad_id || null
      const squad = resolverNombreSquad(squadId)
      if (squad !== squadDetalleAplicaciones) continue
      const aplicacionEpm = req.nombre ? req.nombre.split('-')[0].trim() : ''
      if (!aplicacionEpm) continue
      mapa.set(aplicacionEpm, (mapa.get(aplicacionEpm) ?? 0) + 1)
    }
    return Array.from(mapa.entries())
      .map(([aplicacionEpm, cantidadRequerimientos]) => ({ aplicacionEpm, cantidadRequerimientos }))
      .sort((a, b) => b.cantidadRequerimientos - a.cantidadRequerimientos || a.aplicacionEpm.localeCompare(b.aplicacionEpm))
  }, [requerimientosPeriodo, resolverNombreSquad, squadDetalleAplicaciones])

  const detalleAplicacionesEpmFiltrado = useMemo(() => {
    const busqueda = busquedaDetalleAplicaciones.trim().toLowerCase()
    if (!busqueda) return detalleAplicacionesEpmPorSquad
    return detalleAplicacionesEpmPorSquad.filter((fila) => fila.aplicacionEpm.toLowerCase().includes(busqueda))
  }, [busquedaDetalleAplicaciones, detalleAplicacionesEpmPorSquad])

  const resumenCapacidad = useMemo(() => {
    const totalHoras = filasCapacidadSquad.reduce((sum, fila) => sum + fila.horas, 0)
    const personasDisponibles = new Set<string>()
    recorrerCapacidad(({ persona, periodo, horasDefaultMes }) => {
      const capacidadPersona = capacidadPorPersonaMes.get(`${persona.id}|${periodo}`) ?? horasDefaultMes
      if (capacidadPersona > 0) personasDisponibles.add(persona.id)
    })
    const personasUnicas = personas.filter((persona) => persona.activo && persona.rol_operativo !== 'LT_EPM').length
    return { totalHoras, personasDisponibles: personasDisponibles.size, personasUnicas }
  }, [recorrerCapacidad, capacidadPorPersonaMes, filasCapacidadSquad, personas])

  const entregasPorMes = useMemo<FilaEntregasMes[]>(() => {
    const mapa = new Map<string, FilaEntregasMes>()

    for (const req of requerimientos) {
      for (const entrega of req.entregas ?? []) {
        const mes = mesDesdeEntrega(req, entrega)
        if (!mes) continue
        if (!periodos.has(mes)) continue
        const actual = mapa.get(mes) ?? { mes, label: formatearPeriodo(mes), entregas: 0, horas: 0 }
        actual.entregas += 1
        actual.horas += Number(entrega.horas ?? 0)
        mapa.set(mes, actual)
      }
    }

    return Array.from(mapa.values()).sort((a, b) => a.mes.localeCompare(b.mes))
  }, [periodos, requerimientos])

  const woSoportePorMes = useMemo<FilaWoMes[]>(() => {
    const mapa = new Map<string, { mes: string; label: string; horasPorWo: Map<string, number> }>()

    for (const registro of soporteResumen) {
      const workOrder = registro.Work_Order_ID?.trim()
      const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
      if (!workOrder || !mes) continue

      if (!periodos.has(mes)) continue
      const actual = mapa.get(mes) ?? { mes, label: formatearPeriodo(mes), horasPorWo: new Map<string, number>() }
      const horasAprobadas = numero(registro.Horas_Aprobadas)
      actual.horasPorWo.set(workOrder, Math.max(actual.horasPorWo.get(workOrder) ?? 0, horasAprobadas))
      mapa.set(mes, actual)
    }

    return Array.from(mapa.values())
      .map(({ horasPorWo, ...resto }) => ({
        ...resto,
        wo: horasPorWo.size,
        woHoras: Array.from(horasPorWo.values()).reduce((sum, horas) => sum + horas, 0),
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
  }, [periodos, soporteResumen])

  const detalleWoSoporte = useMemo<FilaDetalleWo[]>(() => {
    const mapa = new Map<string, FilaDetalleWo>()

    for (const registro of soporteResumen) {
      const workOrder = registro.Work_Order_ID?.trim()
      const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
      if (!workOrder || !mes) continue

      if (!periodos.has(mes)) continue

      const clave = `${mes}|${workOrder}`
      const horasAprobadas = numero(registro.Horas_Aprobadas)
      const actual = mapa.get(clave)
      mapa.set(clave, {
        mes,
        label: formatearPeriodo(mes),
        workOrder,
        horasAprobadas: Math.max(actual?.horasAprobadas ?? 0, horasAprobadas),
      })
    }

    return Array.from(mapa.values()).sort((a, b) => (
      a.mes.localeCompare(b.mes) || a.workOrder.localeCompare(b.workOrder)
    ))
  }, [periodos, soporteResumen])

  const detalleWoSoporteFiltrado = useMemo(() => {
    const busqueda = busquedaDetalleWo.trim().toLowerCase()
    if (!busqueda) return detalleWoSoporte
    return detalleWoSoporte.filter((fila) => fila.workOrder.toLowerCase().includes(busqueda))
  }, [busquedaDetalleWo, detalleWoSoporte])

  const horasEntregasFiltradas = useMemo(() => {
    const totalHoras = entregasPorMes.reduce((sum, item) => sum + item.horas, 0)
    const totalEntregas = entregasPorMes.reduce((sum, item) => sum + item.entregas, 0)
    const promedioHoras = totalEntregas > 0 ? totalHoras / totalEntregas : 0
    return { totalHoras, totalEntregas, promedioHoras }
  }, [entregasPorMes])

  const horasWoFiltradas = useMemo(() => {
    const totalHoras = woSoportePorMes.reduce((sum, item) => sum + item.woHoras, 0)
    const totalWo = woSoportePorMes.reduce((sum, item) => sum + item.wo, 0)
    const promedioHoras = totalWo > 0 ? totalHoras / totalWo : 0
    return { totalHoras, totalWo, promedioHoras }
  }, [woSoportePorMes])

  const totalHorasEntregasWo = horasEntregasFiltradas.totalHoras + horasWoFiltradas.totalHoras

  const kpis = useMemo(() => {
    const top = filas[0]
    return {
      totalSquads: filas.length,
      topNombre: top?.squad ?? '—',
      topCantidad: top?.reqs ?? 0,
    }
  }, [filas])

  /** Filas de squad con % de ANS, nivel de riesgo y carga frente a capacidad. */
  const filasAnalisis = useMemo<FilaSquadAnalisis[]>(() => {
    const capacidadPorNombre = new Map<string, number>()
    for (const fila of filasCapacidadSquad) {
      capacidadPorNombre.set(fila.squad, (capacidadPorNombre.get(fila.squad) ?? 0) + fila.horas)
    }

    return filas.map((fila) => {
      const porcentajeActa = porcentajeCumplimiento(fila.ansActaCumple, fila.ansActaTotal)
      const porcentajeEntrega = porcentajeCumplimiento(fila.ansEntregaCumple, fila.ansEntregaTotal)
      const nivelActa = porcentajeActa === null ? null : nivelDeAvance(porcentajeActa)
      const nivelEntrega = porcentajeEntrega === null ? null : nivelDeAvance(porcentajeEntrega)
      const capacidad = capacidadPorNombre.get(fila.squad) ?? 0
      const capacidadHoras = capacidad > 0 ? capacidad : null
      return {
        ...fila,
        porcentajeActa,
        porcentajeEntrega,
        nivelActa,
        nivelEntrega,
        nivelGlobal: peorNivel(nivelActa, nivelEntrega),
        capacidadHoras,
        utilizacion: capacidadHoras === null ? null : Math.round((fila.horasEntregas / capacidadHoras) * 100),
        sobrecarga: capacidadHoras !== null && fila.horasEntregas > capacidadHoras,
      }
    })
  }, [filas, filasCapacidadSquad])

  const resumenRiesgo = useMemo<ResumenRiesgo>(() => {
    let criticos = 0
    let enAtencion = 0
    let sobrecargados = 0
    let enRiesgo = 0
    for (const fila of filasAnalisis) {
      if (fila.nivelGlobal === 'error') criticos += 1
      else if (fila.nivelGlobal === 'alerta') enAtencion += 1
      if (fila.sobrecarga) sobrecargados += 1
      if (fila.nivelGlobal === 'error' || fila.nivelGlobal === 'alerta' || fila.sobrecarga) enRiesgo += 1
    }
    return { criticos, enAtencion, sobrecargados, enRiesgo }
  }, [filasAnalisis])

  return {
    filas,
    filasAnalisis,
    resumenRiesgo,
    filasCapacidadSquad,
    detallePersonasCapacidad,
    detallePersonasCapacidadFiltrado,
    detalleAplicacionesEpmFiltrado,
    resumenCapacidad,
    entregasPorMes,
    woSoportePorMes,
    detalleWoSoporte,
    detalleWoSoporteFiltrado,
    horasEntregasFiltradas,
    horasWoFiltradas,
    totalHorasEntregasWo,
    kpis,
    festivosPorMes,
  }
}
