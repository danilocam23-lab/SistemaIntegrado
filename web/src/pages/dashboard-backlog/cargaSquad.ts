// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { FilaDetalleWo, RegistroSoporteResumen, ResumenWoPorSquad } from './tipos'
import { formatearPeriodo, horasAprobadasRegistro, mesDesdeFecha } from './utilidades'

/**
 * Horas aprobadas de WO por squad en los periodos seleccionados. Mismo criterio que el KPI
 * global (`woSoportePorMes`): por mes, una WO cuenta una sola vez con su máximo de
 * horas aprobadas (horas + minutos/60). La WO se asocia al squad por el campo `squad` del registro de soporte
 * (nombre del squad), normalizado con `resolverNombreSquad`. Las WO sin squad resoluble
 * quedan fuera de las filas (el KPI global no cambia).
 */
export function horasWoPorSquad(
  registros: RegistroSoporteResumen[],
  periodos: Set<string>,
  resolverNombreSquad: (id: string | null) => string,
): Map<string, number> {
  const resultado = new Map<string, number>()
  for (const [squad, { horas }] of resumenWoPorSquad(registros, periodos, resolverNombreSquad).porSquad) {
    resultado.set(squad, horas)
  }
  return resultado
}

/**
 * Misma lógica que `horasWoPorSquad`, pero además devuelve la cantidad de WO por squad, el detalle
 * de WO de cada squad y lo que quedó fuera por no tener squad resoluble.
 */
export function resumenWoPorSquad(
  registros: RegistroSoporteResumen[],
  periodos: Set<string>,
  resolverNombreSquad: (id: string | null) => string,
): ResumenWoPorSquad {
  const porWo = new Map<string, { squad: string; horas: number; mes: string; workOrder: string }>()
  for (const registro of registros) {
    const workOrder = registro.Work_Order_ID?.trim()
    const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
    if (!workOrder || !mes || !periodos.has(mes)) continue
    const clave = `${mes}|${workOrder}`
    const horas = horasAprobadasRegistro(registro)
    const squadCrudo = registro.squad?.trim() ?? ''
    const squad = squadCrudo ? resolverNombreSquad(squadCrudo) : ''
    const actual = porWo.get(clave)
    porWo.set(clave, {
      squad: actual?.squad || squad,
      horas: Math.max(actual?.horas ?? 0, horas),
      mes,
      workOrder,
    })
  }
  const porSquad = new Map<string, { horas: number; cantidad: number }>()
  const detallePorSquad = new Map<string, FilaDetalleWo[]>()
  const sinSquad = { cantidad: 0, horas: 0 }
  for (const { squad, horas, mes, workOrder } of porWo.values()) {
    if (!squad) {
      sinSquad.cantidad += 1
      sinSquad.horas += horas
      continue
    }
    const actual = porSquad.get(squad) ?? { horas: 0, cantidad: 0 }
    porSquad.set(squad, { horas: actual.horas + horas, cantidad: actual.cantidad + 1 })
    const lista = detallePorSquad.get(squad) ?? []
    lista.push({ mes, label: formatearPeriodo(mes), workOrder, horasAprobadas: horas })
    detallePorSquad.set(squad, lista)
  }
  for (const lista of detallePorSquad.values()) {
    lista.sort((a, b) => a.mes.localeCompare(b.mes) || a.workOrder.localeCompare(b.workOrder))
  }
  return { porSquad, sinSquad, detallePorSquad }
}

/** Carga del squad = horas de entregas + horas aprobadas de WO, frente a la capacidad (que no cambia). */
export function calcularCarga(horasEntregas: number, horasWo: number, capacidadHoras: number | null) {
  const horasCarga = horasEntregas + horasWo
  return {
    horasCarga,
    utilizacion: capacidadHoras === null ? null : Math.round((horasCarga / capacidadHoras) * 100),
    sobrecarga: capacidadHoras !== null && horasCarga > capacidadHoras,
  }
}
