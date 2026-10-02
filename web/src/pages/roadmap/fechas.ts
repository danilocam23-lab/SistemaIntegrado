// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/**
 * Fechas del Roadmap, siempre en hora LOCAL. Las fechas del API vienen como
 * `YYYY-MM-DD`: `new Date('YYYY-MM-DD')` las lee como UTC y en Colombia (UTC-5)
 * mostraría el día anterior, así que se parten a mano.
 */

export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Lee `YYYY-MM-DD` (se ignora cualquier hora posterior) como fecha local a las 00:00. */
export function parseFechaLocal(texto: string | null | undefined): Date | null {
  if (!texto) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto)
  if (!m) return null
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const fecha = new Date(anio, mes - 1, dia)
  // Rechaza fechas imposibles (2026-02-31 se desbordaría a marzo).
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null
  return fecha
}

export function hoyLocal(): Date {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

/** Día siguiente (inicio del día) — el fin de una barra incluye su último día. */
export function diaSiguiente(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1)
}

/** `07 ago 26` */
export function fechaCorta(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${dd} ${MESES_CORTOS[fecha.getMonth()]} ${String(fecha.getFullYear()).slice(-2)}`
}

/** Índice absoluto de mes (año × 12 + mes 0-11): permite comparar y sumar meses. */
export function indiceMes(fecha: Date): number {
  return fecha.getFullYear() * 12 + fecha.getMonth()
}

export function primerDiaDeIndice(indice: number): Date {
  return new Date(Math.floor(indice / 12), indice % 12, 1)
}

/** `ago 26` */
export function etiquetaIndiceMes(indice: number): string {
  return `${MESES_CORTOS[indice % 12]} ${String(Math.floor(indice / 12)).slice(-2)}`
}
