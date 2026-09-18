// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/**
 * Tipos y utilidades compartidas por las listas de "Detalle ANS"
 * (`RequerimientosDetalleANS.tsx` + `ListaRequerimientosAns.tsx` /
 * `ListaEntregasAns.tsx`). Sin cambios de comportamiento respecto al
 * archivo monolítico original: solo se movieron aquí para trocear la
 * pantalla en piezas más pequeñas.
 */

export type TonoChip = 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'

export interface FilaRequerimiento {
  id: string
  sc: string
  codigoReq: string
  nombre: string
  squad: string
  ltHitss: string
  estado: string
  ansActa: string | null
  horasEstimadas: number | null
  fechaLimite: string | null
  fechaRealEntregaEstimacion: string | null
  seLevanto: boolean
  observacionesAns: string
  seguimientoHitss: string | null
  seguimientoEpm: string | null
  tipificacion: string | null
}

export interface FilaEntrega {
  id: string
  reqId: string
  codigoReq: string
  nombreReq: string
  sc: string
  squad: string
  ltHitss: string
  numero: number
  horas: number | null
  porcentaje: number | null
  fechaComprometida: string | null
  fechaReal: string | null
  estado: string | null
  ansEntrega: string | null
  entregaNumero: number
  seLevanto: boolean
  observacionesAns: string
  observacionesEpm: string | null
  observacionesHitss: string | null
  tipificacion: string | null
}

/** Filas por página en las listas densas de Requerimientos y Entregas ANS. */
export const TAMANO_PAGINA_ANS = 15

export function normalizarAns(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  return v || '—'
}

export function tonoAns(valor: string | null | undefined): TonoChip {
  const v = (valor ?? '').trim().toUpperCase().replace(/[_-]+/g, ' ')
  if (v === 'CUMPLE') return 'exito'
  if (v === 'NO CUMPLE') return 'error'
  return 'neutro'
}

export function calcularDiasTranscurridos(
  fechaLimite: string | null,
  fechaReal: string | null,
): { dias: number; esNegativo: boolean } | null {
  if (!fechaLimite) return null

  const hoy = new Date().toISOString().slice(0, 10)
  const inicio = fechaLimite.slice(0, 10)
  const fin = fechaReal ? fechaReal.slice(0, 10) : hoy

  const fecha1 = new Date(inicio)
  const fecha2 = new Date(fin)
  const diferencia = Math.floor((fecha2.getTime() - fecha1.getTime()) / (1000 * 60 * 60 * 24))

  let esNegativo = false
  if (!fechaReal && hoy > inicio) {
    esNegativo = true
  } else if (fechaReal && fechaReal.slice(0, 10) > inicio) {
    esNegativo = true
  }

  return { dias: Math.abs(diferencia), esNegativo }
}

export function tipificacionEtiqueta(valor: string | null): string {
  if (valor === 'HITSS') return 'Hitss'
  if (valor === 'EPM') return 'EPM'
  return '—'
}
