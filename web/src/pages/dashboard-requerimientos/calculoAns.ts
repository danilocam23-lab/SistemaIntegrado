// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Entrega, Requerimiento } from '../../types'

/** Nota visible en los KPI/gráficas "(Hitss)". */
export const NOTA_ATRIBUCION_EPM =
  'Los incumplimientos atribuidos a EPM cuentan como cumple; el dato original no se modifica.'

/** Elemento mínimo para calcular ANS: valor real (ans_acta / ans_entrega) y su tipificación. */
export interface ItemAns {
  ans: string | null | undefined
  tipificacion: 'HITSS' | 'EPM' | null | undefined
}

export interface ResultadoAns {
  total: number
  cumple: number
  noCumple: number
}

export interface PuntoTendenciaAns extends ResultadoAns {
  mes: string
  cumplePct: number
  noCumplePct: number
}

export function normalizarAns(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+/g, '_')
}

/** `Requerimiento.estado` incluye CANCELADO o REEMPLAZADO (no cuenta para ANS). */
export function estaCanceladoOReemplazado(estado: string | null | undefined): boolean {
  const e = (estado ?? '').toUpperCase()
  return e.includes('CANCELADO') || e.includes('REEMPLAZADO')
}

function porcentaje(parte: number, total: number): number {
  return total > 0 ? parseFloat(((parte / total) * 100).toFixed(1)) : 0
}

/**
 * Cuenta cumple / no cumple de una lista. Con `atribuirEpm`, un NO_CUMPLE cuya
 * tipificación es EPM cuenta como CUMPLE (vista "(Hitss)"). El dato original no se modifica.
 * `total` es la cantidad de elementos recibidos: el llamador decide qué entra.
 */
export function calcularAns(items: ItemAns[], { atribuirEpm }: { atribuirEpm: boolean }): ResultadoAns {
  let cumple = 0
  let noCumple = 0
  for (const it of items) {
    const ans = normalizarAns(it.ans)
    if (ans === 'cumple' || (atribuirEpm && ans === 'no_cumple' && it.tipificacion === 'EPM')) cumple++
    else if (ans === 'no_cumple') noCumple++
  }
  return { total: items.length, cumple, noCumple }
}

/** Porcentaje de cumple sobre el total (1 decimal). */
export function porcentajeCumple(r: ResultadoAns): number {
  return porcentaje(r.cumple, r.total)
}

/** Agrupa por mes (YYYY-MM) los elementos con fecha y calcula cumple/no cumple y porcentajes. */
export function calcularTendenciaAns<T extends ItemAns>(
  items: T[],
  fechaDe: (item: T) => string | null | undefined,
  opciones: { atribuirEpm: boolean },
): PuntoTendenciaAns[] {
  const hoy = new Date().toISOString().substring(0, 10)
  const porMes = new Map<string, T[]>()
  for (const it of items) {
    const fecha = fechaDe(it)
    if (!fecha || fecha.substring(0, 10) > hoy) continue
    const mes = fecha.substring(0, 7)
    const lista = porMes.get(mes)
    if (lista) lista.push(it)
    else porMes.set(mes, [it])
  }
  return Array.from(porMes.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, lista]) => {
      const r = calcularAns(lista, opciones)
      return { mes, ...r, cumplePct: porcentaje(r.cumple, r.total), noCumplePct: porcentaje(r.noCumple, r.total) }
    })
}

export interface ClasificacionAns<T extends ItemAns> {
  /** ANS real = CUMPLE. */
  cumple: T[]
  /** ANS real = NO_CUMPLE y tipificación distinta de EPM. */
  noCumple: T[]
  /** ANS real = NO_CUMPLE atribuido a EPM (en la vista "(Hitss)" cuenta como cumple). */
  noCumpleEpm: T[]
  /** Elementos con otro valor de ANS (no se listan, pero sí cuentan en el total del KPI). */
  otros: number
}

/** Separa los elementos en las 3 categorías del detalle "(Hitss)". Función pura. */
export function clasificarAns<T extends ItemAns>(items: T[]): ClasificacionAns<T> {
  const r: ClasificacionAns<T> = { cumple: [], noCumple: [], noCumpleEpm: [], otros: 0 }
  for (const it of items) {
    const ans = normalizarAns(it.ans)
    if (ans === 'cumple') r.cumple.push(it)
    else if (ans === 'no_cumple') (it.tipificacion === 'EPM' ? r.noCumpleEpm : r.noCumple).push(it)
    else r.otros++
  }
  return r
}

/** Fila normalizada del modal de detalle (requerimiento o entrega). */
export interface FilaDetalleAns extends ItemAns {
  clave: string
  reqId: string
  codigoReq: string
  /** N.° de entrega; `null` en filas de requerimiento. */
  numeroEntrega: number | null
  nombre: string
  estado: string
  ltHitss: string
  /** Fecha relevante (YYYY-MM-DD…) o `null`. */
  fecha: string | null
}

/** Filas de detalle desde ítems de requerimiento (fecha = fecha_solicitud_acta). */
export function filasDetalleReq(
  items: ReturnType<typeof itemsAnsReq>,
  nombrePersona: (id: string | null) => string,
): FilaDetalleAns[] {
  return items.map(({ r, ans, tipificacion }) => ({
    clave: r.id,
    reqId: r.id,
    codigoReq: r.codigo_req,
    numeroEntrega: null,
    nombre: r.nombre ?? r.acta_trabajo ?? '—',
    estado: r.estado,
    ltHitss: nombrePersona(r.solicitud?.lt_hitss_id ?? null),
    fecha: r.fecha_solicitud_acta,
    ans,
    tipificacion,
  }))
}

/** Filas de detalle desde ítems de entrega (fecha = fecha_recepcion ?? fecha_comprometida). */
export function filasDetalleEntrega(
  items: ReturnType<typeof itemsAnsEntrega>,
  reqs: Requerimiento[],
  nombrePersona: (id: string | null) => string,
): FilaDetalleAns[] {
  const porEntrega = new Map<Entrega, Requerimiento>()
  for (const r of reqs) for (const e of r.entregas ?? []) porEntrega.set(e, r)
  return items.map(({ e, ans, tipificacion }) => {
    const r = porEntrega.get(e)
    return {
      clave: `${r?.id ?? ''}-${e.numero}`,
      reqId: r?.id ?? '',
      codigoReq: r?.codigo_req ?? '—',
      numeroEntrega: e.numero,
      nombre: r?.nombre ?? '—',
      estado: e.estado ?? '—',
      ltHitss: nombrePersona(r?.solicitud?.lt_hitss_id ?? null),
      fecha: e.fecha_recepcion ?? e.fecha_comprometida,
      ans,
      tipificacion,
    }
  })
}

/** Elementos ANS de requerimientos con un valor ANS (cualquiera). */
export function itemsAnsReq(reqs: Requerimiento[]): (ItemAns & { r: Requerimiento })[] {
  return reqs.map((r) => ({ ans: r.ans_acta, tipificacion: r.tipificacion, r }))
}

/**
 * Entregas aplanadas con su ANS y tipificación propia (sin herencia del requerimiento),
 * excluyendo las de requerimientos CANCELADO o REEMPLAZADO (igual que ANS Estimación).
 */
export function itemsAnsEntrega(reqs: Requerimiento[]): (ItemAns & { e: Entrega })[] {
  return reqs
    .filter((r) => !estaCanceladoOReemplazado(r.estado))
    .flatMap((r) => (r.entregas ?? []).map((e) => ({ ans: e.ans_entrega, tipificacion: e.tipificacion, e })))
}
