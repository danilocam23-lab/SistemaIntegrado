// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/*
 * Fechas YYYY-MM-DD en hora LOCAL. Nunca `new Date('YYYY-MM-DD')`: eso se
 * interpreta como UTC y en zonas al oeste de Greenwich corre el día anterior.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MS_DIA = 86_400_000

export function aIso(fecha: Date): string {
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${m}-${d}`
}

/** Parsea 'YYYY-MM-DD' a medianoche local; null si no es una fecha válida. */
export function desdeIso(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

export function hoyLocal(): Date {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

/** Días desde hoy hasta la fecha (negativo = ya pasó); null si no hay fecha válida. */
export function diasHasta(iso: string | null | undefined, hoy: Date): number | null {
  const fecha = desdeIso(iso)
  if (!fecha) return null
  return Math.round((fecha.getTime() - hoy.getTime()) / MS_DIA)
}

export function formatearFecha(iso: string | null | undefined): string {
  const f = desdeIso(iso)
  if (!f) return 'Sin fecha'
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
}

/** "vence en 3 d", "vence hoy", "vencido hace 7 d". */
export function textoVencimiento(dias: number | null): string {
  if (dias === null) return ''
  if (dias < 0) return `vencido hace ${-dias} d`
  if (dias === 0) return 'vence hoy'
  return `vence en ${dias} d`
}

export function sumarDias(hoy: Date, dias: number): string {
  return aIso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias))
}

export function finDeMes(hoy: Date): string {
  return aIso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0))
}

/** Fecha y hora ISO del servidor a "14 sep 2026" (hora local). */
export function formatearMarca(marca: string | null | undefined): string {
  if (!marca) return ''
  const f = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(marca) ? marca : `${marca}Z`)
  if (Number.isNaN(f.getTime())) return ''
  return `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
}
