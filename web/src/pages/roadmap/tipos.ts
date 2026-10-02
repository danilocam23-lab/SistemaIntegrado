// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Requerimiento } from '../../types'

export type TonoHito = 'ok' | 'pend' | 'bad'

export interface HitoEntrega {
  numero: number
  fecha: Date
  tono: TonoHito
  estado: string | null
}

/** Requerimiento con fechas dibujables (inicio, fin y entregas ya leídos en hora local). */
export interface ReqRoadmap {
  req: Requerimiento
  inicio: Date
  fin: Date
  hitos: HitoEntrega[]
  /** Entregas que no traen `fecha_comprometida` y por eso no se dibujan. */
  entregasSinFecha: number
  vencido: boolean
  categoriaNombre: string
  color: string
}

export interface GrupoCategoria {
  id: string
  nombre: string
  color: string
  /** Suma de las asignaciones de la persona en esa categoría (0 = no aplica). */
  porcentaje: number
  reqs: ReqRoadmap[]
}

export interface GrupoRoadmap {
  id: string
  nombre: string
  rol: string
  inactiva: boolean
  sinAsignar: boolean
  plano: boolean
  categorias: GrupoCategoria[]
  totalReqs: number
  totalEntregas: number
  /** Carga vigente en % (Asignaciones). `null` = no aplica o no disponible. */
  carga: number | null
}

export interface ColumnaMes {
  indice: number
  etiqueta: string
  /** Ancho en % proporcional a los días del mes. */
  ancho: number
  esActual: boolean
}

export interface RangoRoadmap {
  inicio: Date
  /** Primer día del mes siguiente al último mes visible (exclusivo). */
  fin: Date
  columnas: ColumnaMes[]
  desdeIndice: number
  hastaIndice: number
}

export type PresetRango = '3' | '6' | 'todo' | 'personalizado'
export type ModoAgrupacion = 'usuario' | 'plano'
