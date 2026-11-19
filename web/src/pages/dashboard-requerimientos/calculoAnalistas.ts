// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Entrega, Persona, Requerimiento } from '../../types'
import {
  calcularAns,
  estaCanceladoOReemplazado,
  itemsAnsEntrega,
  itemsAnsReq,
  normalizarAns,
} from './calculoAns'
import type { ItemAns } from './calculoAns'

export const SIN_ANALISTA = 'sin_analista'

interface IdentificacionRegistroAnalista {
  clave: string
  requerimientoId: string
  codigoReq: string
  codigoSc?: string
  acta: string
  numeroEntrega: number | null
  fechaReferencia: string | null
  observacionesHitss?: string | null
}

export interface RegistroAnalista extends ItemAns {
  analista: string
  tipo: 'requerimiento' | 'entrega'
  mes: string | null
  identificacion?: IdentificacionRegistroAnalista
}

export interface DetalleIncumplimientoAnalista extends IdentificacionRegistroAnalista {
  analista: string
  nombreAnalista: string
  tipo: RegistroAnalista['tipo']
  tipificacion: ItemAns['tipificacion']
  noCumpleReal: boolean
  noCumpleHitss: boolean
}

export interface FilaAnalista {
  id: string
  nombre: string
  requerimientosReal: number
  requerimientosHitss: number
  entregasReal: number
  entregasHitss: number
}

/** Lee el calendario escrito en la API, sin convertir zonas horarias ni inventar fechas. */
export function mesCalendario(fecha: string | null | undefined): string | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(fecha)) return null
  const ano = Number(fecha.slice(0, 4))
  const mes = Number(fecha.slice(5, 7))
  const dia = Number(fecha.slice(8, 10))
  const bisiesto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > dias[mes - 1]) return null
  return fecha.slice(0, 7)
}

function claveAnalista(r: Requerimiento): string {
  const id = r.solicitud?.analista_requerimientos_id
  return id?.trim() ? `persona:${id}` : SIN_ANALISTA
}

function identificarRegistro(
  r: Requerimiento,
  e?: Entrega,
  indice?: number,
): IdentificacionRegistroAnalista {
  return {
    clave: JSON.stringify([r.id, e ? 'entrega' : 'requerimiento', e?.numero ?? null, indice ?? null]),
    requerimientoId: r.id,
    codigoReq: r.codigo_req?.trim() || '—',
    codigoSc: r.solicitud?.codigo_sc?.trim() || '—',
    acta: r.acta_trabajo?.trim() || r.nombre?.trim() || 'Sin acta',
    numeroEntrega: e?.numero ?? null,
    fechaReferencia: (e ? e.fecha_recepcion ?? e.fecha_comprometida : r.fecha_solicitud_acta)
      ?.slice(0, 10) ?? null,
    observacionesHitss: e ? e.observaciones_hitss : r.seguimiento,
  }
}

/** Mismo universo y clasificación ANS que el dashboard, conservando el padre de cada entrega. */
export function prepararRegistrosAnalistas(reqs: Requerimiento[]): RegistroAnalista[] {
  const activos = reqs.filter(r => !estaCanceladoOReemplazado(r.estado))
  const porEntrega = new Map<Entrega, { padre: Requerimiento; indice: number }>()
  for (const r of activos) {
    for (const [indice, entrega] of (r.entregas ?? []).entries()) {
      porEntrega.set(entrega, { padre: r, indice })
    }
  }
  const registros: RegistroAnalista[] = [
    ...itemsAnsReq(activos).map(({ r, ans, tipificacion }): RegistroAnalista => ({
      analista: claveAnalista(r),
      tipo: 'requerimiento',
      mes: mesCalendario(r.fecha_solicitud_acta),
      ans,
      tipificacion,
      identificacion: identificarRegistro(r),
    })),
    ...itemsAnsEntrega(activos).map(({ e, ans, tipificacion }): RegistroAnalista => {
      const origen = porEntrega.get(e)
      return {
        analista: origen ? claveAnalista(origen.padre) : SIN_ANALISTA,
        tipo: 'entrega',
        mes: mesCalendario(e.fecha_recepcion ?? e.fecha_comprometida),
        ans,
        tipificacion,
        identificacion: origen ? identificarRegistro(origen.padre, e, origen.indice) : undefined,
      }
    }),
  ]
  return registros.filter(r => ['cumple', 'no_cumple'].includes(normalizarAns(r.ans)))
}

export function anosAnalistas(registros: RegistroAnalista[]): string[] {
  return Array.from(new Set(registros.flatMap(r => r.mes ? [r.mes.slice(0, 4)] : [])))
    .sort((a, b) => b.localeCompare(a))
}

export function anoInicialAnalistas(anos: string[], actual: string): string {
  const ordenados = [...anos].sort()
  return anos.includes(actual) ? actual : ordenados[ordenados.length - 1] ?? actual
}

/** Incluye personas inactivas y referencias huérfanas; nunca mezcla identidades por nombre. */
export function opcionesAnalistas(reqs: Requerimiento[], personas: Persona[]): { id: string; nombre: string }[] {
  const nombres = new Map(personas.map(p => [`persona:${p.id}`, p.nombre]))
  const claves = new Set(reqs
    .filter(r => !estaCanceladoOReemplazado(r.estado))
    .map(claveAnalista))
  const huerfanos = [...claves].filter(id => id !== SIN_ANALISTA && !nombres.has(id)).sort()
  return [...claves].map(id => ({
    id,
    nombre: id === SIN_ANALISTA ? 'Sin analista'
      : nombres.get(id) ?? `Analista no disponible (${huerfanos.indexOf(id) + 1})`,
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id))
}

export function resumirAnalistas(
  registros: RegistroAnalista[],
  opciones: { id: string; nombre: string }[],
  filtro: { ano: string; mes: string; analista: string },
) {
  const porAnalista = new Map<string, FilaAnalista>()
  const detalles: DetalleIncumplimientoAnalista[] = []
  const nombres = new Map(opciones.map(opcion => [opcion.id, opcion.nombre]))
  let registrosPeriodo = 0
  let requerimientosSinFecha = 0
  let entregasSinFecha = 0
  for (const [indice, registro] of registros.entries()) {
    if (filtro.analista && registro.analista !== filtro.analista) continue
    if (!registro.mes) {
      if (normalizarAns(registro.ans) === 'no_cumple') {
        if (registro.tipo === 'requerimiento') requerimientosSinFecha++
        else entregasSinFecha++
      }
      continue
    }
    if (registro.mes.slice(0, 4) !== filtro.ano) continue
    if (filtro.mes && registro.mes.slice(5, 7) !== filtro.mes) continue
    registrosPeriodo++
    const real = calcularAns([registro], { atribuirEpm: false }).noCumple
    if (!real) continue
    const hitss = calcularAns([registro], { atribuirEpm: true }).noCumple
    const fila = porAnalista.get(registro.analista) ?? {
      id: registro.analista,
      nombre: nombres.get(registro.analista) ?? 'Analista no disponible',
      requerimientosReal: 0,
      requerimientosHitss: 0,
      entregasReal: 0,
      entregasHitss: 0,
    }
    if (registro.tipo === 'requerimiento') {
      fila.requerimientosReal += real
      fila.requerimientosHitss += hitss
    } else {
      fila.entregasReal += real
      fila.entregasHitss += hitss
    }
    porAnalista.set(fila.id, fila)
    detalles.push({
      clave: `registro:${indice}`,
      requerimientoId: '',
      codigoReq: '—',
      codigoSc: '—',
      acta: 'Sin acta',
      numeroEntrega: null,
      fechaReferencia: null,
      ...registro.identificacion,
      analista: fila.id,
      nombreAnalista: fila.nombre,
      tipo: registro.tipo,
      tipificacion: registro.tipificacion,
      noCumpleReal: real > 0,
      noCumpleHitss: hitss > 0,
    })
  }
  const filas = [...porAnalista.values()].sort((a, b) =>
    (b.requerimientosReal + b.entregasReal) - (a.requerimientosReal + a.entregasReal)
    || a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id))
  return { filas, detalles, registrosPeriodo, requerimientosSinFecha, entregasSinFecha }
}
