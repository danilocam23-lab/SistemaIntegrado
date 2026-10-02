// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/**
 * Planes de los procesos en lote (puros, sin React): dicen qué se crea, qué se
 * actualiza y qué se omite ANTES de escribir, para mostrarlo en la vista previa.
 */

import { MESES_LARGO } from './tipos'
import type { AlcanceAplicacion, FilaCapacidad, FilaPlanLote, ItemLote } from './tipos'

function filaPlan(
  fila: FilaCapacidad, indice: number, horas: number, sobrescribir: boolean,
): FilaPlanLote {
  const celda = fila.celdas[indice]
  const base = {
    personaId: fila.persona.id,
    nombre: fila.persona.nombre,
    mes: celda.mes,
    horas,
    horasActuales: celda.horas,
    registroId: celda.registro?.id ?? null,
  }
  if (celda.registro === null) return { ...base, accion: 'crear' }
  if (!sobrescribir) return { ...base, accion: 'omitir', motivo: 'ya tiene registro' }
  if (celda.horas === horas) return { ...base, accion: 'omitir', motivo: 'sin cambios' }
  return { ...base, accion: 'actualizar' }
}

/** Copia las horas registradas del mes `desde` al mes `hasta` de cada persona editable. */
export function planificarCopiaMes(
  filas: FilaCapacidad[], desde: number, hasta: number, sobrescribir: boolean,
): FilaPlanLote[] {
  return filas
    .filter((f) => !f.inactiva)
    .map((fila): FilaPlanLote => {
      const origen = fila.celdas[desde]
      if (origen.horas === null) {
        const destino = fila.celdas[hasta]
        return {
          personaId: fila.persona.id,
          nombre: fila.persona.nombre,
          mes: destino.mes,
          horas: 0,
          accion: 'omitir',
          horasActuales: destino.horas,
          registroId: destino.registro?.id ?? null,
          motivo: 'el mes de origen no tiene registro',
        }
      }
      return filaPlan(fila, hasta, origen.horas, sobrescribir)
    })
}

/** Crea los registros que faltan desde el mes `desdeMes` con la base sugerida de cada mes. */
export function planificarRelleno(
  filas: FilaCapacidad[], desdeMes: number, basePorMes: number[],
): FilaPlanLote[] {
  const plan: FilaPlanLote[] = []
  for (const fila of filas) {
    if (fila.inactiva) continue
    for (let i = desdeMes; i < 12; i++) {
      const item = filaPlan(fila, i, basePorMes[i], false)
      if (item.accion === 'crear') plan.push(item)
    }
  }
  return plan
}

/** Meses (índices) a los que aplica un valor desde `indice` según el alcance elegido. */
export function mesesDelAlcance(indice: number, alcance: AlcanceAplicacion): number[] {
  if (alcance === 'mes') return [indice]
  const desde = alcance === 'anio' ? 0 : indice
  return Array.from({ length: 12 - desde }, (_, k) => desde + k)
}

/** Plan de "Aplicar a": mismas horas en el alcance elegido (sobrescribe lo existente). */
export function planificarAplicacion(
  fila: FilaCapacidad, indice: number, alcance: AlcanceAplicacion, horas: number,
): FilaPlanLote[] {
  return mesesDelAlcance(indice, alcance).map((i) => filaPlan(fila, i, horas, true))
}

export function aItemsLote(plan: FilaPlanLote[]): ItemLote[] {
  return plan
    .filter((p) => p.accion !== 'omitir')
    .map((p) => ({ persona_id: p.personaId, mes: p.mes, horas_disponibles: p.horas }))
}

export function contarPlan(plan: FilaPlanLote[]) {
  let crear = 0
  let actualizar = 0
  let omitir = 0
  for (const p of plan) {
    if (p.accion === 'crear') crear += 1
    else if (p.accion === 'actualizar') actualizar += 1
    else omitir += 1
  }
  return { crear, actualizar, omitir }
}

/** "oct 2026" → "Octubre 2026" a partir de la clave `YYYY-MM`. */
export function etiquetaMes(mes: string): string {
  const [anio, numero] = mes.split('-')
  return `${MESES_LARGO[Number(numero) - 1] ?? numero} ${anio}`
}
