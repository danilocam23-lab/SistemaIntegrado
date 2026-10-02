// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Entrega, Persona, Requerimiento } from '../../types'

/** Entrega tal como la sirve `GET /reportes/roadmap` (solo lo que la pantalla usa). */
export type EntregaRoadmapDato = Pick<Entrega, 'numero' | 'fecha_comprometida' | 'fecha_aprobacion' | 'estado'>

/** Requerimiento de `GET /reportes/roadmap`: sin datos económicos; `solicitud` puede venir nula. */
export type RequerimientoRoadmap =
  Pick<Requerimiento, 'id' | 'codigo_req' | 'nombre' | 'estado' | 'categoria_id' | 'developers_asignados'
    | 'fecha_inicio' | 'fecha_fin' | 'fecha_solicitud_acta'>
  & { solicitud?: { lt_hitss_id?: string | null } | null; entregas: EntregaRoadmapDato[] }

export type PersonaRoadmap = Pick<Persona, 'id' | 'nombre' | 'activo' | 'rol_operativo'>

export interface CategoriaRoadmap {
  id: string
  nombre: string
  color: string
}

export interface AsignacionRoadmap {
  id: string
  persona_id: string
  categoria_id: string
  total_porcentaje: number
  estado: string
  proyectos: { requerimiento_id: string | null }[]
}

export type TonoHito = 'ok' | 'pend' | 'bad'

export interface HitoEntrega {
  numero: number
  fecha: Date
  tono: TonoHito
  estado: string | null
}

/** Requerimiento con fechas dibujables (inicio, fin y entregas ya leídos en hora local). */
export interface ReqRoadmap {
  req: RequerimientoRoadmap
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
