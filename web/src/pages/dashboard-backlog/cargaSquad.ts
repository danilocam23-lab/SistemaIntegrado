// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { RegistroSoporteResumen } from './tipos'
import { mesDesdeFecha, numero } from './utilidades'

/**
 * Horas aprobadas de WO por squad en los periodos seleccionados. Mismo criterio que el KPI
 * global (`woSoportePorMes`): por mes, una WO cuenta una sola vez con su máximo de
 * `Horas_Aprobadas`. La WO se asocia al squad por el campo `squad` del registro de soporte
 * (nombre del squad), normalizado con `resolverNombreSquad`. Las WO sin squad resoluble
 * quedan fuera de las filas (el KPI global no cambia).
 */
export function horasWoPorSquad(
  registros: RegistroSoporteResumen[],
  periodos: Set<string>,
  resolverNombreSquad: (id: string | null) => string,
): Map<string, number> {
  const porWo = new Map<string, { squad: string; horas: number }>()
  for (const registro of registros) {
    const workOrder = registro.Work_Order_ID?.trim()
    const mes = mesDesdeFecha(registro.Fecha_Fin_Real)
    if (!workOrder || !mes || !periodos.has(mes)) continue
    const clave = `${mes}|${workOrder}`
    const horas = numero(registro.Horas_Aprobadas)
    const squadCrudo = registro.squad?.trim() ?? ''
    const squad = squadCrudo ? resolverNombreSquad(squadCrudo) : ''
    const actual = porWo.get(clave)
    porWo.set(clave, {
      squad: actual?.squad || squad,
      horas: Math.max(actual?.horas ?? 0, horas),
    })
  }
  const resultado = new Map<string, number>()
  for (const { squad, horas } of porWo.values()) {
    if (!squad) continue
    resultado.set(squad, (resultado.get(squad) ?? 0) + horas)
  }
  return resultado
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
