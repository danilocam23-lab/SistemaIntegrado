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

/**
 * ¿La persona está activa en el listado? Se mide en el squad de contexto (el elegido en el
 * filtro o el de la aplicación activa; `undefined` en modo consolidado -> estado general).
 * Inactiva general => inactiva. Con squad y alguna membresía de ese squad => activa solo si
 * alguna lo está. Con squad pero sin membresía de ese squad => estado general.
 */
export function estadoEnSquadContexto(p: Persona, squad?: string): boolean {
  if (!p.activo) return false
  if (!squad) return true
  const delSquad = detalleSquads(p).filter((d) => d.squad === squad)
  if (delSquad.length === 0) return p.activo
  return delSquad.some((d) => d.activo)
}

/** Membresía cerrada más reciente de la persona en ese squad (la de `hasta` mayor), si existe. */
export function cierreEnSquad(p: Persona, squad: string): SquadDetalle | undefined {
  return detalleSquads(p)
    .filter((d) => d.squad === squad && !d.activo)
    .sort((a, b) => (b.hasta ?? '').localeCompare(a.hasta ?? ''))[0]
}
