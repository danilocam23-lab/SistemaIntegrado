// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo } from 'react'
import type { Requerimiento } from '../../types'
import {
  FASES_ENTREGA,
  FASES_REQUERIMIENTO,
  FASE_OTROS,
  colorEstado,
  esActivo,
  faseDeRequerimiento,
  normalizarEstado,
} from './constantes'
import type { DefinicionFase, FaseCiclo, FilaEstado, TotalesCiclo } from './tipos'

function filaVacia(estado: string): FilaEstado {
  return { estado, cantidad: 0, horas: 0, garantias: 0, garantiasDetalle: [], porcentaje: 0, color: '' }
}

function finalizar(mapa: Map<string, FilaEstado>, total: number): FilaEstado[] {
  return Array.from(mapa.values())
    .map((fila) => ({ ...fila, porcentaje: (fila.cantidad / (total || 1)) * 100, color: colorEstado(fila.estado) }))
    .sort((a, b) => b.cantidad - a.cantidad || b.horas - a.horas)
}

function calcularPorEstado(requerimientos: Requerimiento[]): FilaEstado[] {
  const mapa = new Map<string, FilaEstado>()
  for (const req of requerimientos) {
    const actual = mapa.get(req.estado) ?? filaVacia(req.estado)
    actual.cantidad += 1
    actual.horas += Number(req.total_horas_estimadas ?? 0)
    mapa.set(req.estado, actual)
  }
  return finalizar(mapa, requerimientos.length)
}

function calcularPorEstadoEntregas(requerimientos: Requerimiento[]): FilaEstado[] {
  const mapa = new Map<string, FilaEstado>()
  let total = 0
  for (const req of requerimientos) {
    for (const entrega of req.entregas ?? []) {
      total += 1
      const estado = entrega.estado?.trim() || 'Sin estado'
      const actual = mapa.get(estado) ?? filaVacia(estado)
      actual.cantidad += 1
      actual.horas += Number(entrega.horas ?? 0)
      if (entrega.garantia) {
        actual.garantias += 1
        actual.garantiasDetalle.push({
          reqId: req.id,
          codigoReq: req.codigo_req,
          nombreReq: req.nombre ?? '—',
          estadoEntrega: estado,
          numeroEntrega: entrega.numero,
          horas: Number(entrega.horas ?? 0),
          fechaComprometida: entrega.fecha_comprometida,
          fechaRecepcion: entrega.fecha_recepcion,
          observaciones: entrega.observaciones,
        })
      }
      mapa.set(estado, actual)
    }
  }
  return finalizar(mapa, total)
}

function construirFase(def: DefinicionFase, propias: FilaEstado[]): FaseCiclo {
  return {
    ...def,
    filas: propias,
    cantidad: propias.reduce((s, f) => s + f.cantidad, 0),
    horas: propias.reduce((s, f) => s + f.horas, 0),
    garantias: propias.reduce((s, f) => s + f.garantias, 0),
  }
}

function agruparEnFases(filas: FilaEstado[], definiciones: DefinicionFase[]): FaseCiclo[] {
  const cubiertos = new Set<FilaEstado>()
  const fases = definiciones.map((def) => {
    const propias = def.estados
      .map((e) => filas.find((f) => normalizarEstado(f.estado) === e))
      .filter((f): f is FilaEstado => f !== undefined)
    propias.forEach((f) => cubiertos.add(f))
    return construirFase(def, propias)
  })
  const otros = filas.filter((f) => !cubiertos.has(f))
  if (otros.length > 0) fases.push(construirFase(FASE_OTROS, otros))
  return fases
}

function sumarTotales(filas: FilaEstado[]): TotalesCiclo {
  return filas.reduce(
    (acc, fila) => {
      acc.cantidad += fila.cantidad
      acc.horas += fila.horas
      acc.garantias += fila.garantias
      return acc
    },
    { cantidad: 0, horas: 0, garantias: 0 },
  )
}

/**
 * Derivados del dashboard de estados. `requerimientos` ya viene filtrado por el squad activo;
 * `fase` ('todas' o id de fase de requerimiento) recorta ciclos, gráficas y evolución, pero no
 * los KPI ni el reparto por fase. Las cifras por estado se calculan igual que antes.
 */
export function useDerivadosEstados(requerimientos: Requerimiento[], fase: string) {
  const kpis = useMemo(() => {
    const totalHoras = requerimientos.reduce((sum, req) => sum + Number(req.total_horas_estimadas ?? 0), 0)
    const totalEntregas = requerimientos.reduce((sum, req) => sum + (req.entregas?.length ?? 0), 0)
    const activos = requerimientos.filter((req) => esActivo(req.estado)).length
    return { total: requerimientos.length, activos, totalHoras, totalEntregas }
  }, [requerimientos])

  const filtrados = useMemo(
    () => (fase === 'todas' ? requerimientos : requerimientos.filter((req) => faseDeRequerimiento(req.estado) === fase)),
    [requerimientos, fase],
  )

  const porEstado = useMemo(() => calcularPorEstado(filtrados), [filtrados])
  const porEstadoEntregas = useMemo(() => calcularPorEstadoEntregas(filtrados), [filtrados])
  // El reparto por fase siempre usa todos los requerimientos del squad.
  const porEstadoTodos = useMemo(
    () => (fase === 'todas' ? porEstado : calcularPorEstado(requerimientos)),
    [fase, porEstado, requerimientos],
  )

  const cicloRequerimientos = useMemo(() => agruparEnFases(porEstado, FASES_REQUERIMIENTO), [porEstado])
  const cicloEntregas = useMemo(() => agruparEnFases(porEstadoEntregas, FASES_ENTREGA), [porEstadoEntregas])
  const repartoFases = useMemo(() => agruparEnFases(porEstadoTodos, FASES_REQUERIMIENTO), [porEstadoTodos])

  const totalesRequerimientos = useMemo(() => sumarTotales(porEstado), [porEstado])
  const totalesEntregas = useMemo(() => sumarTotales(porEstadoEntregas), [porEstadoEntregas])
  const totalesReparto = useMemo(() => sumarTotales(porEstadoTodos), [porEstadoTodos])

  const detalleGarantiasTotal = useMemo(
    () => porEstadoEntregas.flatMap((fila) => fila.garantiasDetalle),
    [porEstadoEntregas],
  )

  const porMes = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const req of filtrados) {
      if (!req.fecha_solicitud_acta) continue
      const mes = req.fecha_solicitud_acta.substring(0, 7)
      mapa.set(mes, (mapa.get(mes) ?? 0) + 1)
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, cantidad]) => ({ mes, cantidad }))
  }, [filtrados])

  const hayOtros = useMemo(
    () => requerimientos.some((req) => faseDeRequerimiento(req.estado) === FASE_OTROS.id),
    [requerimientos],
  )

  return {
    kpis,
    cicloRequerimientos,
    cicloEntregas,
    repartoFases,
    totalesRequerimientos,
    totalesEntregas,
    totalesReparto,
    detalleGarantiasTotal,
    porMes,
    hayOtros,
  }
}
