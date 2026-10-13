// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Persona } from '../../types'

/** Valor de `activa` en modo consolidado (mismo literal que `CONSOLIDADO` de api/client). */
const TODOS = '__todas__'

/**
 * Vigencia de las membresías persona-squad en UN mes (ADR-0010).
 * La pertenencia de una persona a un squad en la capacidad es por vigencia mensual:
 * cuenta en el mes si estuvo vigente en el squad al menos un día de ese mes.
 */
export interface VigenciaMes {
  /** persona_id -> códigos de squad (Aplicacion) vigentes algún día del mes. */
  porPersona: Record<string, string[]>
  /** Personas que tienen alguna membresía en la respuesta (aunque no en este mes). */
  conMembresia: Set<string>
  /** `persona_id|squad_id` -> días hábiles de la membresía dentro del mes (de /membresias/metas); null si falló. */
  diasHabiles: Record<string, number> | null
}

interface ParametrosPertenencia {
  persona: Persona
  /** Squad activo del selector (consolidado o vacío = todos). */
  activa: string | null | undefined
  /** Vigencia del mes; null si no cargó (se usa el comportamiento legado). */
  vigencia: VigenciaMes | null
  squadActivaNombre: string
  squadCodigoPorNombre: Map<string, string>
}

/**
 * Squads (códigos) a los que la persona aporta capacidad en el mes y si la decisión salió de
 * la vigencia. Con membresías: vigencia del mes, sin exigir `persona.activo`. Sin ninguna
 * membresía (legado): `persona.activo` + `persona.squads` como antes, incluido squads vacío
 * (cuenta en el squad activo).
 */
export function squadsDePersonaEnMes({
  persona,
  activa,
  vigencia,
  squadActivaNombre,
  squadCodigoPorNombre,
}: ParametrosPertenencia): { squads: string[]; porVigencia: boolean } {
  const squadFiltro = activa && activa !== TODOS ? activa : null
  const tieneMembresias =
    !!vigencia && (vigencia.conMembresia.has(persona.id) || (persona.squads_detalle?.length ?? 0) > 0)

  if (vigencia && tieneMembresias) {
    const vigentes = vigencia.porPersona[persona.id] ?? []
    if (!squadFiltro) return { squads: vigentes, porVigencia: true }
    return { squads: vigentes.includes(squadFiltro) ? [squadFiltro] : [], porVigencia: true }
  }

  // Legado: comportamiento previo a las membresías.
  if (!persona.activo) return { squads: [], porVigencia: false }
  const normalizados = (persona.squads ?? []).map((squad) => squadCodigoPorNombre.get(squad) ?? squad)
  if (!squadFiltro) return { squads: normalizados, porVigencia: false }
  const pertenece =
    normalizados.length === 0 ||
    normalizados.includes(squadFiltro) ||
    (squadActivaNombre ? (persona.squads ?? []).includes(squadActivaNombre) : false)
  return { squads: pertenece ? [squadFiltro] : [], porVigencia: false }
}

/**
 * Factor de prorrateo de la capacidad por defecto: días hábiles de la membresía en el mes
 * sobre los del mes completo. 1 si no hay dato (legado, /metas falló o no trae la fila).
 */
export function factorVigencia(
  vigencia: VigenciaMes | null,
  personaId: string,
  squadId: string,
  diasHabilesMes: number,
  porVigencia: boolean,
): number {
  if (!porVigencia || !vigencia?.diasHabiles || diasHabilesMes <= 0) return 1
  const dias = vigencia.diasHabiles[`${personaId}|${squadId}`]
  if (dias === undefined) return 1
  return Math.min(1, dias / diasHabilesMes)
}
