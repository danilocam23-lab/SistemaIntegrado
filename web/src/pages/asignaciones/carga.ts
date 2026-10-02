// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/**
 * Lógica pura (sin React) de la carga de trabajo por persona: umbrales del
 * medidor, formato de porcentajes y reparto equitativo que suma exactamente 100.
 */

/** Horas "reales" de un requerimiento = horas estimadas × este factor (valor vigente, no cambia). */
export const FACTOR_HORAS_REALES = 0.9

/** Horas base del mes cuando no hay `horas_mes_default` en la configuración (valor vigente). */
export const HORAS_MES_POR_DEFECTO = 180

export type NivelCarga = 'sobrecarga' | 'alta' | 'normal' | 'holgura'

/** >100 sobrecarga · 90–100 alta · 70–89 normal · <70 holgura. */
export function nivelCarga(pct: number): NivelCarga {
  if (pct > 100) return 'sobrecarga'
  if (pct >= 90) return 'alta'
  if (pct >= 70) return 'normal'
  return 'holgura'
}

export const ETIQUETA_NIVEL: Record<NivelCarga, string> = {
  sobrecarga: 'sobrecarga',
  alta: 'carga alta',
  normal: 'carga normal',
  holgura: 'holgura',
}

export const TONO_CHIP_NIVEL: Record<NivelCarga, 'error' | 'alerta' | 'exito' | 'marca'> = {
  sobrecarga: 'error',
  alta: 'alerta',
  normal: 'exito',
  holgura: 'marca',
}

/** Clases literales (el JIT de Tailwind no ve nombres compuestos). */
export const CLASE_BARRA_NIVEL: Record<NivelCarga, string> = {
  sobrecarga: 'bg-red-600',
  alta: 'bg-amber-500',
  normal: 'bg-emerald-600',
  holgura: 'bg-marca-500',
}

export const CLASE_BORDE_NIVEL: Record<NivelCarga, string> = {
  sobrecarga: 'border-l-red-600',
  alta: 'border-l-amber-500',
  normal: 'border-l-emerald-600',
  holgura: 'border-l-marca-400',
}

/** Carga de una persona desglosada por el tipo de requerimiento de cada asignación. */
export interface CargaPersona {
  personaId: string
  /** % en requerimientos activos (el que valida el tope del 100%). */
  activa: number
  /** % en asignaciones sin requerimiento (cuentan en la carga, no bloquean). */
  sinReq: number
  /** % en requerimientos que ya no están activos (informativo, no cuenta). */
  otros: number
  /** Carga que cuenta para el medidor: activa + sin requerimiento. */
  total: number
  /** Nº de asignaciones en requerimientos activos. */
  nActivas: number
  /** Nº total de asignaciones de la persona. */
  nAsignaciones: number
  /** Capacidad base del mes (horas). */
  capacidadHoras: number
  /** `true` si no hay capacidad registrada para la persona y se usa la base por defecto. */
  capacidadPorDefecto: boolean
  /** Horas de carga según `total` y la capacidad base. */
  horas: number
}

export const cargaVacia = (personaId: string, capacidadHoras: number, porDefecto: boolean): CargaPersona => ({
  personaId,
  activa: 0,
  sinReq: 0,
  otros: 0,
  total: 0,
  nActivas: 0,
  nAsignaciones: 0,
  capacidadHoras,
  capacidadPorDefecto: porDefecto,
  horas: 0,
})

/** Redondea a 1 decimal y quita el ".0" (40 → "40", 33.333 → "33.3"). */
export function formatearPct(valor: number): string {
  const redondeado = Math.round(valor * 10) / 10
  return Number.isInteger(redondeado) ? String(redondeado) : redondeado.toFixed(1)
}

/**
 * Reparto equitativo de 100 entre `n` asignaciones que suma EXACTAMENTE 100:
 * todos reciben el piso y el resto se reparte de a 1 punto empezando por las
 * primeras (6 → 17, 17, 17, 17, 16, 16).
 */
export function repartirIgual(n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(100 / n)
  const resto = 100 - base * n
  return Array.from({ length: n }, (_, i) => (i < resto ? base + 1 : base))
}

/** Iniciales para el avatar ("Jose Danilo Camacho" → "JD"). */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}
