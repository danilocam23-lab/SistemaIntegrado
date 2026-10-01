// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

export interface DetalleGarantia {
  reqId: string
  codigoReq: string
  nombreReq: string
  estadoEntrega: string
  numeroEntrega: number
  horas: number
  fechaComprometida: string | null
  fechaRecepcion: string | null
  observaciones: string | null
}

/** Una fila por estado (cantidad, horas y, en entregas, garantías). */
export interface FilaEstado {
  estado: string
  cantidad: number
  horas: number
  garantias: number
  garantiasDetalle: DetalleGarantia[]
  porcentaje: number
  color: string
}

export interface DefinicionFase {
  id: string
  nombre: string
  subtitulo: string
  /** Fase del flujo principal (true) o de salida/cierre (false). */
  flujo: boolean
  /** Clase literal de borde superior (Tailwind) de la columna. */
  acento: string
  /** Color hex de la fase (reparto por fase). */
  color: string
  estados: string[]
}

export interface FaseCiclo extends DefinicionFase {
  filas: FilaEstado[]
  cantidad: number
  horas: number
  garantias: number
}

export interface TotalesCiclo {
  cantidad: number
  horas: number
  garantias: number
}

export type Metrica = 'cantidad' | 'horas'

export interface DetalleGarantiasAbierto {
  titulo: string
  filas: DetalleGarantia[]
}
