// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { MESES_ES } from '../../constantes'
import type { Requerimiento, Tarifa } from '../../types'

/** Entrega con la referencia a su requerimiento, para poblar el detalle. */
export interface EntregaMes {
  requerimientoId: string
  codigoReq: string
  nombreReq: string | null
  numero: number
  estado: string
  horas: number
  fechaComprometida: string | null
  fechaAprobacion: string | null
}

export interface FilaMesAprobacion {
  clave: string
  ano: string
  mes: string
  entregas: EntregaMes[]
  horas: number
  valorHora: number | null
}

const quitarTildes = (texto: string) =>
  texto.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Convierte a número finito; cualquier valor no numérico (NaN, texto, null) cuenta como 0. */
export function horasSeguras(valor: unknown): number {
  const resultado = Number(valor ?? 0)
  return Number.isFinite(resultado) ? resultado : 0
}

/**
 * Mapa año -> valor hora de la ramificación indicada (sin distinguir mayúsculas/tildes).
 * Si hay varias tarifas del mismo año y ramificación, gana la ÚLTIMA de la lista
 * (comportamiento determinista); `tarifasDuplicadasConflicto` permite avisar del conflicto.
 */
export function mapaTarifasPorRamificacion(tarifas: Tarifa[], ramificacion: string): Map<string, number> {
  const objetivo = quitarTildes(ramificacion)
  return new Map(
    tarifas
      .filter((tarifa) => quitarTildes(tarifa.ramificacion ?? '') === objetivo)
      .map((tarifa) => [String(tarifa.anio), tarifa.valor_hora]),
  )
}

export interface TarifaDuplicada {
  ramificacion: string
  anio: string
  valores: number[]
}

/**
 * Años con más de una tarifa de valores DISTINTOS para alguna de las ramificaciones dadas
 * (mismo año y ramificación, sin distinguir mayúsculas/tildes). Duplicados con igual valor se ignoran.
 */
export function tarifasDuplicadasConflicto(tarifas: Tarifa[], ramificaciones: string[]): TarifaDuplicada[] {
  const resultado: TarifaDuplicada[] = []
  ramificaciones.forEach((ramificacion) => {
    const objetivo = quitarTildes(ramificacion)
    const porAnio = new Map<string, number[]>()
    tarifas
      .filter((tarifa) => quitarTildes(tarifa.ramificacion ?? '') === objetivo)
      .forEach((tarifa) => {
        const anio = String(tarifa.anio)
        porAnio.set(anio, [...(porAnio.get(anio) ?? []), tarifa.valor_hora])
      })
    porAnio.forEach((valores, anio) => {
      if (new Set(valores).size > 1) resultado.push({ ramificacion, anio, valores })
    })
  })
  return resultado.sort((a, b) => a.ramificacion.localeCompare(b.ramificacion) || a.anio.localeCompare(b.anio))
}

/** Índice 0-11 del mes en MESES_ES, o -1 si no se reconoce. */
export function indiceMes(mes: string): number {
  const buscado = quitarTildes(mes)
  return MESES_ES.findIndex((nombre) => quitarTildes(nombre) === buscado)
}

/**
 * Agrupa por (año, mes de aprobación) las entregas con `mes_aprobacion`, más la fila
 * "Sin mes" para entregas APROBADA sin mes. Año: fecha_aprobacion, si no fecha_comprometida,
 * si no 'Sin fecha'. Orden: año descendente, mes por calendario; 'Sin fecha' y 'Sin mes' al final.
 */
export function agruparPorMesAprobacion(
  requerimientos: Requerimiento[],
  tarifas: Tarifa[],
  anoActual: string = String(new Date().getFullYear()),
): FilaMesAprobacion[] {
  const tarifasFabrica = mapaTarifasPorRamificacion(tarifas, 'fábrica')
  const agrupadas = new Map<string, FilaMesAprobacion & { orden: number }>()
  requerimientos.forEach((requerimiento) => {
    requerimiento.entregas?.forEach((entrega) => {
      const mesCrudo = (entrega.mes_aprobacion ?? '').trim()
      const estado = (entrega.estado ?? '').trim().toUpperCase()
      if (!mesCrudo && estado !== 'APROBADA') return
      const fechaAprob = entrega.fecha_aprobacion?.trim() ?? ''
      const fechaComp = entrega.fecha_comprometida?.trim() ?? ''
      const fuente = /^\d{4}/.test(fechaAprob) ? fechaAprob : fechaComp
      const tieneAno = /^\d{4}/.test(fuente)
      const ano = tieneAno ? fuente.slice(0, 4) : 'Sin fecha'
      let mes = 'Sin mes'
      let orden = 100
      if (mesCrudo) {
        const indice = indiceMes(mesCrudo)
        mes = indice >= 0 ? MESES_ES[indice] : mesCrudo
        orden = indice >= 0 ? indice : 50
      }
      const clave = `${ano}|${mes}`
      const fila = agrupadas.get(clave) ?? {
        clave, ano, mes, entregas: [], horas: 0, orden,
        valorHora: tarifasFabrica.get(tieneAno ? ano : anoActual) ?? null,
      }
      const horas = horasSeguras(entrega.horas)
      fila.entregas.push({
        requerimientoId: requerimiento.id,
        codigoReq: requerimiento.codigo_req,
        nombreReq: requerimiento.nombre,
        numero: entrega.numero,
        estado: entrega.estado ?? '',
        horas,
        fechaComprometida: entrega.fecha_comprometida,
        fechaAprobacion: entrega.fecha_aprobacion,
      })
      fila.horas += horas
      agrupadas.set(clave, fila)
    })
  })
  return Array.from(agrupadas.values()).sort((a, b) => {
    if (a.ano !== b.ano) {
      if (a.ano === 'Sin fecha') return 1
      if (b.ano === 'Sin fecha') return -1
      return b.ano.localeCompare(a.ano)
    }
    if (a.orden !== b.orden) return a.orden - b.orden
    return a.mes.localeCompare(b.mes)
  })
}

/** Entregas del detalle ordenadas por requerimiento y número. */
export function ordenarEntregasDetalle(entregas: EntregaMes[]): EntregaMes[] {
  return [...entregas].sort(
    (a, b) => a.codigoReq.localeCompare(b.codigoReq, 'es') || a.numero - b.numero,
  )
}
