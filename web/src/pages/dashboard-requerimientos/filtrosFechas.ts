// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Requerimiento } from '../../types'
import {
  calcularAns, calcularTendenciaAns, estaCanceladoOReemplazado,
  itemsAnsEntrega, itemsAnsReq, normalizarAns, porcentajeCumple,
} from './calculoAns'

export interface FiltroTemporal {
  anos: ReadonlySet<string>
  meses: ReadonlySet<string>
  hasta: string
}

export interface RegistroSoporte {
  lider?: string
  Work_Order_ID?: string
  Fecha_Fin_Real?: string
  Estado_ANS_Oportunidad?: string
  Estado_ANS_Cumplimiento?: string
  Estado_ANS_inicio_trabajo?: string
}

/** Solo el reloj se convierte a Bogotá; nunca se desplaza el calendario escrito en un registro. */
export function hoyColombia(instante = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instante)
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

/** Valida el día y, si existe, la hora ISO, sin normalizar días imposibles ni cambiar su zona. */
export function fechaCalendario(fecha: string | null | undefined): string | null {
  if (!fecha) return null
  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?(?:[zZ]|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/.exec(fecha)
  if (!partes) return null
  const ano = Number(partes[1]), mes = Number(partes[2]), dia = Number(partes[3])
  const bisiesto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return ano > 0 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1]
    ? fecha.slice(0, 10) : null
}

export function filtroInicial(hasta: string) {
  return { anos: new Set([hasta.slice(0, 4)]), meses: new Set<string>(), hasta }
}

export function pasaFecha(fecha: string | null | undefined, filtro: FiltroTemporal): boolean {
  const dia = fechaCalendario(fecha)
  if (!dia || dia > filtro.hasta) return false
  return (!filtro.anos.size || filtro.anos.has(dia.slice(0, 4)))
    && (!filtro.meses.size || filtro.meses.has(String(Number(dia.slice(5, 7)))))
}

export function anosDisponibles(fechas: (string | null | undefined)[], hasta: string): string[] {
  const anos = new Set([hasta.slice(0, 4)])
  for (const fecha of fechas) {
    const dia = fechaCalendario(fecha)
    if (dia && dia <= hasta) anos.add(dia.slice(0, 4))
  }
  return Array.from(anos).sort()
}

export function normalizarTexto(valor: string): string {
  return valor.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Universos independientes: una entrega no depende del período de su requerimiento padre. */
export function derivarRequerimientos(reqs: Requerimiento[], filtro: FiltroTemporal) {
  const requerimientos = reqs.filter((r) => pasaFecha(r.fecha_inicio ?? r.fecha_solicitud_acta, filtro))
  const entregas = reqs.flatMap((r) => r.entregas ?? [])
    .filter((e) => pasaFecha(e.fecha_recepcion ?? e.fecha_comprometida, filtro))
  const activosAns = reqs.filter((r) => !estaCanceladoOReemplazado(r.estado) && pasaFecha(r.fecha_solicitud_acta, filtro))
  const itemsReq = itemsAnsReq(activosAns).filter((i) => normalizarAns(i.ans))
  // Conserva la clasificación previa de la tendencia: solo CUMPLE / NO_CUMPLE.
  const itemsTendenciaReq = itemsReq.filter((i) => ['cumple', 'no_cumple'].includes(normalizarAns(i.ans)))
  const itemsEnt = itemsAnsEntrega(reqs)
    .filter((i) => normalizarAns(i.ans) && pasaFecha(i.e.fecha_recepcion ?? i.e.fecha_comprometida, filtro))
  const ansReq = calcularAns(itemsReq, { atribuirEpm: false })
  const ansReqEpm = calcularAns(itemsReq, { atribuirEpm: true })
  const ansEnt = calcularAns(itemsEnt, { atribuirEpm: false })
  const ansEntEpm = calcularAns(itemsEnt, { atribuirEpm: true })
  const porMes = new Map<string, number>()
  const porLt: Record<string, number> = {}
  for (const r of requerimientos) {
    const mes = (r.fecha_inicio ?? r.fecha_solicitud_acta)!.slice(0, 7)
    porMes.set(mes, (porMes.get(mes) ?? 0) + 1)
    const lider = r.solicitud?.lt_hitss_id
    if (lider) porLt[lider] = (porLt[lider] ?? 0) + 1
  }
  return {
    requerimientos, itemsReq, itemsEnt, porLt,
    kpis: {
      total: requerimientos.length,
      totalHoras: requerimientos.reduce((s, r) => s + Number(r.total_horas_estimadas ?? 0), 0),
      totalEntregas: entregas.length, activos: activosAns.length,
      ansReqPct: porcentajeCumple(ansReq), ansReqCumple: ansReq.cumple, ansReqTotal: ansReq.total,
      ansReqEpmPct: porcentajeCumple(ansReqEpm), ansReqEpmCumple: ansReqEpm.cumple,
      ansEntPct: porcentajeCumple(ansEnt), ansEntCumple: ansEnt.cumple, ansEntTotal: ansEnt.total,
      ansEntEpmPct: porcentajeCumple(ansEntEpm), ansEntEpmCumple: ansEntEpm.cumple,
    },
    porMes: Array.from(porMes, ([mes, cantidad]) => ({ mes, cantidad })).sort((a, b) => a.mes.localeCompare(b.mes)),
    tendencia: calcularTendenciaAns(itemsEnt, (i) => i.e.fecha_recepcion ?? i.e.fecha_comprometida, { atribuirEpm: false, hasta: filtro.hasta }),
    tendenciaEpm: calcularTendenciaAns(itemsEnt, (i) => i.e.fecha_recepcion ?? i.e.fecha_comprometida, { atribuirEpm: true, hasta: filtro.hasta }),
    tendenciaReqs: calcularTendenciaAns(itemsTendenciaReq, (i) => i.r.fecha_solicitud_acta, { atribuirEpm: false, hasta: filtro.hasta }),
    tendenciaReqsEpm: calcularTendenciaAns(itemsTendenciaReq, (i) => i.r.fecha_solicitud_acta, { atribuirEpm: true, hasta: filtro.hasta }),
  }
}

function contarAns(registros: RegistroSoporte[], campo: keyof RegistroSoporte) {
  const conAns = registros.filter((r) => r[campo])
  const total = conAns.length
  const cumple = conAns.filter((r) => r[campo]!.toUpperCase() === 'CUMPLE').length
  const noCumple = total - cumple
  const pct = (cantidad: number) => total ? Number((cantidad * 100 / total).toFixed(1)) : 0
  return { total, cumple, noCumple, pct: pct(cumple), noCumplePct: pct(noCumple) }
}

/** Primero fecha/filtros, después todos los agregados; ANS conserva su conteo por fila. */
export function derivarSoporte(registros: RegistroSoporte[], filtro: FiltroTemporal) {
  const filtrados = registros.filter((r) => pasaFecha(r.Fecha_Fin_Real, filtro))
  const ids = new Set<string>()
  const porLt = new Map<string, Set<string>>()
  const porMes = new Map<string, RegistroSoporte[]>()
  for (const r of filtrados) {
    const mes = r.Fecha_Fin_Real!.slice(0, 7)
    const lista = porMes.get(mes) ?? []
    lista.push(r)
    porMes.set(mes, lista)
    if (!r.Work_Order_ID) continue
    ids.add(r.Work_Order_ID)
    if (r.lider) {
      const lider = normalizarTexto(r.lider)
      const ordenes = porLt.get(lider) ?? new Set<string>()
      ordenes.add(r.Work_Order_ID)
      porLt.set(lider, ordenes)
    }
  }
  const meses = Array.from(porMes).sort(([a], [b]) => a.localeCompare(b))
  return {
    workOrderIDFiltrado: ids.size,
    woPorLt: Object.fromEntries(Array.from(porLt, ([lider, ordenes]) => [lider, ordenes.size])),
    woPorMes: meses.map(([mes, filas]) => ({ mes, wo: new Set(filas.map((r) => r.Work_Order_ID).filter(Boolean)).size })),
    ansOportShow: contarAns(filtrados, 'Estado_ANS_Oportunidad'),
    ansCumplShow: contarAns(filtrados, 'Estado_ANS_Cumplimiento'),
    ansInicioShow: contarAns(filtrados, 'Estado_ANS_inicio_trabajo'),
    ansTendencia: meses.map(([mes, filas]) => {
      const oportunidad = contarAns(filas, 'Estado_ANS_Oportunidad')
      const cumplimiento = contarAns(filas, 'Estado_ANS_Cumplimiento')
      const inicio = contarAns(filas, 'Estado_ANS_inicio_trabajo')
      return {
        mes,
        oportunidadTotal: oportunidad.total, oportunidadCumple: oportunidad.cumple,
        oportunidadNoCumple: oportunidad.noCumple, oportunidadPct: oportunidad.pct, oportunidadNoCumplePct: oportunidad.noCumplePct,
        cumplimientoTotal: cumplimiento.total, cumplimientoCumple: cumplimiento.cumple,
        cumplimientoNoCumple: cumplimiento.noCumple, cumplimientoPct: cumplimiento.pct, cumplimientoNoCumplePct: cumplimiento.noCumplePct,
        inicioTotal: inicio.total, inicioCumple: inicio.cumple,
        inicioNoCumple: inicio.noCumple, inicioPct: inicio.pct, inicioNoCumplePct: inicio.noCumplePct,
      }
    }),
  }
}
