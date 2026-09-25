// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Requerimiento } from '../../types'
import type { NivelAvance } from './tipos'

export const MESES_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function fmtNumero(valor: number): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

export function numero(valor: string | number | null | undefined): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const texto = (valor ?? '').trim().replace(/\s/g, '')
  if (!texto) return 0
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  const resultado = Number(normalizado)
  return Number.isFinite(resultado) ? resultado : 0
}

export function mesActual(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}

export function fechaKey(fechaIso: string): string {
  return fechaIso.slice(0, 10)
}

export function formatearPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-')
  const indiceMes = Number(mes) - 1
  const etiquetaMes = MESES_LABELS[indiceMes] ?? mes
  return anio && mes ? `${etiquetaMes} ${anio}` : periodo
}

export function mesDesdeFecha(valor: string | null | undefined): string | null {
  const texto = (valor ?? '').trim()
  if (!texto) return null

  const iso = texto.match(/^(\d{4})[-/](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}`

  const dmy = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}`

  const fecha = new Date(texto)
  if (Number.isNaN(fecha.getTime())) return null
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

export function mesDesdeEntrega(req: Requerimiento, entrega: Requerimiento['entregas'][number]): string | null {
  return (
    mesDesdeFecha(entrega.fecha_recepcion) ??
    mesDesdeFecha(entrega.fecha_comprometida) ??
    mesDesdeFecha(entrega.fecha_aprobacion) ??
    mesDesdeFecha(entrega.fecha_cargue) ??
    mesDesdeFecha(entrega.fecha_ejecucion) ??
    mesDesdeFecha(req.fecha_inicio) ??
    mesDesdeFecha(req.fecha_solicitud_acta) ??
    mesDesdeFecha(req.solicitud?.fecha_solicitud)
  )
}

/** Mes propio del requerimiento (para los que aún no tienen entregas). */
export function mesDesdeRequerimiento(req: Requerimiento): string | null {
  return (
    mesDesdeFecha(req.fecha_inicio) ??
    mesDesdeFecha(req.fecha_solicitud_acta) ??
    mesDesdeFecha(req.solicitud?.fecha_solicitud)
  )
}

export function contarDiasHabiles(mes: string, festivosMes: Set<string>): number {
  const [anioTxt, mesTxt] = mes.split('-')
  const anio = Number(anioTxt)
  const mesNumero = Number(mesTxt)
  if (!Number.isInteger(anio) || !Number.isInteger(mesNumero) || mesNumero < 1 || mesNumero > 12) {
    return 0
  }

  const ultimoDia = new Date(anio, mesNumero, 0).getDate()
  let total = 0
  for (let dia = 1; dia <= ultimoDia; dia += 1) {
    const fecha = new Date(anio, mesNumero - 1, dia)
    const dow = fecha.getDay()
    const key = `${anio}-${String(mesNumero).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    if (dow !== 0 && dow !== 6 && !festivosMes.has(key)) total += 1
  }
  return total
}

/** Umbrales de avance: >=75 éxito, >=50 alerta, <50 error. */
export function nivelDeAvance(porcentaje: number): NivelAvance {
  if (porcentaje >= 75) return 'exito'
  if (porcentaje >= 50) return 'alerta'
  return 'error'
}

/** Porcentaje redondeado de cumplimiento; null si no hay datos (total 0). */
export function porcentajeCumplimiento(cumple: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((cumple / total) * 100)
}
