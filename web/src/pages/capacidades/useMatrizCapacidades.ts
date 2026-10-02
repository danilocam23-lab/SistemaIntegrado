// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo } from 'react'
import { baseSugeridaMes, claveMes, mesEnCurso, tonoCelda } from './base'
import { MESES_ABREV, ROLES_EXCLUIDOS_CAPACIDAD, SIN_SQUAD } from './tipos'
import type {
  CapacidadFila, CargaFila, CeldaCapacidad, FilaCapacidad, FilaEquipo, PersonaConApp, TotalMes,
} from './tipos'

/** Carga por encima de la cual una persona está en sobrecarga (Asignaciones). */
const UMBRAL_SOBRECARGA = 100
/** Carga por debajo de la cual se considera subutilizada (solo con asignaciones). */
const UMBRAL_SUBUTILIZACION = 60

export interface FiltrosCapacidades {
  busqueda: string
  rol: string
  soloAlertas: boolean
}

interface Parametros {
  capacidades: CapacidadFila[]
  personas: PersonaConApp[]
  anio: number
  horasMesDefault: number
  festivosPorMes: Map<string, Set<string>>
  cargaPorPersona: Map<string, CargaFila>
  cargaDisponible: boolean
  /** Ids de registros ocultos porque están pendientes de eliminar con "Deshacer". */
  ocultos: Set<string>
  filtros: FiltrosCapacidades
}

const sinTildes = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Deriva todo lo que pinta la pantalla: la base sugerida de cada mes, las filas
 * persona × mes (construidas desde las PERSONAS, no desde las capacidades),
 * totales, KPI y la vista por equipo. No llama a la API.
 */
export function useMatrizCapacidades({
  capacidades, personas, anio, horasMesDefault, festivosPorMes, cargaPorPersona,
  cargaDisponible, ocultos, filtros,
}: Parametros) {
  const mesActual = mesEnCurso()
  const anioActual = Number(mesActual.slice(0, 4))
  const indiceMesActual = Number(mesActual.slice(5, 7)) - 1
  const esAnioActual = anio === anioActual

  const meses = useMemo(
    () => MESES_ABREV.map((_, i) => {
      const mes = claveMes(anio, i)
      const { base, diasHabiles } = baseSugeridaMes(mes, horasMesDefault, festivosPorMes.get(mes) ?? new Set())
      return { mes, indice: i, base, diasHabiles }
    }),
    [anio, horasMesDefault, festivosPorMes],
  )

  const filasTodas = useMemo<FilaCapacidad[]>(() => {
    // persona|mes → registros (el último gana, igual que Asignaciones y Backlog).
    const porClave = new Map<string, CapacidadFila[]>()
    const conRegistroEnAnio = new Set<string>()
    for (const cap of capacidades) {
      if (cap.scope !== 'persona' || !cap.persona_id || !cap.mes || ocultos.has(cap.id)) continue
      const clave = `${cap.persona_id}|${cap.mes}`
      const lista = porClave.get(clave) ?? []
      lista.push(cap)
      porClave.set(clave, lista)
      if (cap.mes.startsWith(`${anio}-`)) conRegistroEnAnio.add(cap.persona_id)
    }

    const baseActual = baseSugeridaMes(
      mesActual, horasMesDefault, festivosPorMes.get(mesActual) ?? new Set(),
    ).base

    const filas: FilaCapacidad[] = []
    for (const persona of personas) {
      if (!persona.rol_operativo || ROLES_EXCLUIDOS_CAPACIDAD.includes(persona.rol_operativo)) continue
      // Inactivas: solo si tienen histórico en el año visible (gris, solo lectura).
      if (!persona.activo && !conRegistroEnAnio.has(persona.id)) continue

      let total = 0
      let conRegistro = 0
      const celdas: CeldaCapacidad[] = meses.map(({ mes, indice, base }) => {
        const duplicados = porClave.get(`${persona.id}|${mes}`) ?? []
        const registro = duplicados.length > 0 ? duplicados[duplicados.length - 1] : null
        const horas = registro ? Number(registro.horas_disponibles) : null
        if (horas !== null) {
          total += horas
          conRegistro += 1
        }
        return { mes, indice, registro, duplicados, horas, base, tono: tonoCelda(horas, base) }
      })

      const carga = cargaDisponible ? (cargaPorPersona.get(persona.id) ?? { pct: 0, nAsignaciones: 0 }) : null
      // Capacidad del mes en curso (registro o base) para convertir la carga a horas.
      const registrosActual = porClave.get(`${persona.id}|${mesActual}`)
      const ultimo = registrosActual ? registrosActual[registrosActual.length - 1] : null
      const capacidadMesActual = ultimo ? Number(ultimo.horas_disponibles) : baseActual

      const sobrecarga = !!carga && carga.pct > UMBRAL_SOBRECARGA
      const subutilizada = !!carga && carga.nAsignaciones > 0 && carga.pct < UMBRAL_SUBUTILIZACION
      const vacioMesActual = persona.activo && esAnioActual && celdas[indiceMesActual].registro === null

      filas.push({
        persona,
        inactiva: !persona.activo,
        celdas,
        total,
        conRegistro,
        carga,
        capacidadMesActual,
        sobrecarga,
        subutilizada,
        vacioMesActual,
        conAlerta: persona.activo && (sobrecarga || subutilizada || vacioMesActual),
      })
    }
    filas.sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre, 'es'))
    return filas
  }, [
    capacidades, personas, ocultos, anio, meses, cargaPorPersona, cargaDisponible,
    mesActual, horasMesDefault, festivosPorMes, esAnioActual, indiceMesActual,
  ])

  const roles = useMemo(
    () => Array.from(new Set(filasTodas.map((f) => f.persona.rol_operativo))).sort((a, b) => a.localeCompare(b, 'es')),
    [filasTodas],
  )

  const filas = useMemo(() => {
    const texto = sinTildes(filtros.busqueda.trim())
    return filasTodas.filter((fila) => {
      if (texto && !sinTildes(fila.persona.nombre).includes(texto)) return false
      if (filtros.rol && fila.persona.rol_operativo !== filtros.rol) return false
      if (filtros.soloAlertas && !fila.conAlerta) return false
      return true
    })
  }, [filasTodas, filtros])

  const totalesMes = useMemo<TotalMes[]>(
    () => meses.map((_, i) => {
      let horas = 0
      let conRegistro = 0
      for (const fila of filas) {
        const h = fila.celdas[i].horas
        if (h !== null) {
          horas += h
          conRegistro += 1
        }
      }
      return { horas, conRegistro, personas: filas.length }
    }),
    [filas, meses],
  )

  const totalAnio = useMemo(() => filas.reduce((suma, f) => suma + f.total, 0), [filas])

  const equipos = useMemo<FilaEquipo[]>(() => {
    const porEquipo = new Map<string, FilaCapacidad[]>()
    for (const fila of filas) {
      const squads = fila.persona.squads?.length ? fila.persona.squads : [SIN_SQUAD]
      // Una persona en varios squads cuenta en cada uno (igual que el Dashboard Backlog).
      for (const squad of squads) {
        const lista = porEquipo.get(squad) ?? []
        lista.push(fila)
        porEquipo.set(squad, lista)
      }
    }
    return Array.from(porEquipo.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([equipo, personasEquipo]) => {
        const porMes: TotalMes[] = meses.map((_, i) => {
          let horas = 0
          let conRegistro = 0
          for (const fila of personasEquipo) {
            const h = fila.celdas[i].horas
            if (h !== null) {
              horas += h
              conRegistro += 1
            }
          }
          return { horas, conRegistro, personas: personasEquipo.length }
        })
        const conCarga = personasEquipo.filter((f) => f.carga && f.carga.nAsignaciones > 0)
        const cargaPromedio = conCarga.length > 0
          ? conCarga.reduce((s, f) => s + (f.carga?.pct ?? 0), 0) / conCarga.length
          : null
        return {
          equipo,
          personas: personasEquipo,
          porMes,
          total: personasEquipo.reduce((s, f) => s + f.total, 0),
          cargaPromedio,
        }
      })
  }, [filas, meses])

  // Indicadores sobre TODAS las personas del año visible (no dependen de los filtros).
  const indicadores = useMemo(() => {
    const activas = filasTodas.filter((f) => !f.inactiva)
    let totalHoras = 0
    let registros = 0
    for (const fila of filasTodas) {
      totalHoras += fila.total
      registros += fila.conRegistro
    }
    // Celdas por registrar: desde el mes en curso (año actual), todo el año (futuro) o ninguna (pasado).
    const desde = esAnioActual ? indiceMesActual : anio > anioActual ? 0 : 12
    let porRegistrar = 0
    for (const fila of activas) {
      for (let i = desde; i < 12; i++) if (fila.celdas[i].registro === null) porRegistrar += 1
    }
    return {
      totalHoras,
      registros,
      promedioMensual: registros > 0 ? totalHoras / registros : 0,
      porRegistrar,
      desdeMes: desde,
      vaciasMesActual: activas.filter((f) => f.vacioMesActual).length,
      sobrecarga: activas.filter((f) => f.sobrecarga),
      subutilizadas: activas.filter((f) => f.subutilizada),
      personasActivas: activas.length,
      alertas: activas.filter((f) => f.conAlerta).length,
      sinRegistrosEnAnio: registros === 0,
    }
  }, [filasTodas, esAnioActual, indiceMesActual, anio, anioActual])

  return {
    meses, mesActual, esAnioActual, indiceMesActual,
    filasTodas, filas, roles, totalesMes, totalAnio, equipos, indicadores,
  }
}
