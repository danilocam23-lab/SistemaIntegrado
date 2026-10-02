// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/**
 * Lógica pura de capacidades: base sugerida del mes, tono de cada celda y
 * validación de horas. Sin React.
 */

import { contarDiasHabiles } from '../dashboard-backlog/utilidades'
import { HORAS_MAX } from './tipos'
import type { TonoCelda } from './tipos'

/** Clave `YYYY-MM` del mes `indice` (0 = enero) del año `anio`. */
export function claveMes(anio: number | string, indice: number): string {
  return `${anio}-${String(indice + 1).padStart(2, '0')}`
}

/** Mes en curso (`YYYY-MM`) según el reloj del navegador. */
export function mesEnCurso(): string {
  const hoy = new Date()
  return claveMes(hoy.getFullYear(), hoy.getMonth())
}

/**
 * Días hábiles y base sugerida de un mes: horas del mes por defecto × días hábiles
 * ÷ días laborables (lunes a viernes). Misma fórmula del Dashboard Backlog
 * (`useDerivadosBacklog`), redondeada a la hora para mostrarla y sugerirla.
 */
export function baseSugeridaMes(mes: string, horasMesDefault: number, festivosMes: Set<string>) {
  const diasLaborables = contarDiasHabiles(mes, new Set())
  const diasHabiles = contarDiasHabiles(mes, festivosMes)
  const factor = diasLaborables > 0 ? diasHabiles / diasLaborables : 1
  return { diasHabiles, base: Math.round(horasMesDefault * factor) }
}

/** Tono de una celda contra la base del mes: ±5 % en la base, <50 % crítico, >105 % alto. */
export function tonoCelda(horas: number | null, base: number): TonoCelda {
  if (horas === null) return 'sin'
  if (base <= 0) return 'ok'
  const razon = horas / base
  if (razon > 1.05) return 'alto'
  if (razon >= 0.95) return 'ok'
  if (razon < 0.5) return 'critico'
  return 'bajo'
}

export const ETIQUETA_TONO: Record<TonoCelda, string> = {
  ok: 'en la base',
  bajo: 'por debajo de la base',
  critico: 'menos de la mitad de la base',
  alto: 'por encima de la base',
  sin: 'sin registro (se aplica la base sugerida)',
}

/** Clases literales por tono (el JIT de Tailwind no ve nombres compuestos). */
export const CLASE_TONO: Record<TonoCelda, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  bajo: 'bg-amber-50 text-amber-700',
  critico: 'bg-red-50 text-red-700',
  alto: 'bg-marca-50 text-marca-700',
  sin: 'border border-dashed border-slate-300 text-slate-400 italic',
}

/**
 * Valida las horas escritas por la persona. Devuelve el número o un mensaje de
 * error: vacío, no numérico, negativo o por encima de `HORAS_MAX`.
 * (`Number('')` es 0: por eso el vacío se rechaza antes de convertir.)
 */
export function validarHoras(texto: string): { horas: number } | { error: string } {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return { error: 'Escribe las horas disponibles.' }
  const horas = Number(limpio)
  if (!Number.isFinite(horas)) return { error: 'Las horas deben ser un número.' }
  if (horas < 0) return { error: 'Las horas no pueden ser negativas.' }
  if (horas > HORAS_MAX) return { error: `Máximo ${HORAS_MAX} h por mes.` }
  return { horas }
}

export function formatearHoras(valor: number): string {
  return Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

/** Texto de una celda en modo "horas" o "% de la base". */
export function textoCelda(horas: number, base: number, modo: 'horas' | 'pct'): string {
  if (modo === 'pct') return base > 0 ? `${Math.round((horas / base) * 100)}%` : '—'
  return formatearHoras(horas)
}
