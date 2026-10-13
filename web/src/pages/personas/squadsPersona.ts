// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Persona, SquadDetalle } from '../../types'

/**
 * Membresías de la persona (vigentes y cerradas), más los squads de `squads` (vigentes hoy) que
 * ningún elemento del detalle cubre (legados sin Aplicacion o de apps no autorizadas), que se
 * añaden como activos sin fechas. Si el detalle falta o está vacío cae a `squads`.
 */
export function detalleSquads(p: Persona): SquadDetalle[] {
  const detalle = p.squads_detalle ?? []
  const cubiertos = new Set(detalle.map((d) => d.squad))
  const extra: SquadDetalle[] = (p.squads ?? [])
    .filter((squad) => !cubiertos.has(squad))
    .map((squad) => ({ squad, squad_id: squad, activo: true, desde: null, hasta: null }))
  return [...detalle, ...extra]
}

/** ¿La persona está activa EN ese squad? Activa si alguna de sus membresías de ese squad lo está. */
export function activaEnSquad(p: Persona, squad: string): boolean {
  return detalleSquads(p).some((d) => d.squad === squad && d.activo)
}

/** Squads de la persona sin repetir (una persona puede tener varias membresías del mismo squad). */
export function nombresSquads(p: Persona): string[] {
  return Array.from(new Set(detalleSquads(p).map((d) => d.squad)))
}
