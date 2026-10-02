// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

export interface PersonaResumen {
  id: string
  nombre: string
  email: string | null
  squads: string[]
  activo: boolean
  aplicacion_id: string
  score: number
}

export interface GrupoDuplicados {
  nombre: string
  rol: string
  total: number
  ganador: PersonaResumen
  duplicados: PersonaResumen[]
}

export type EstadoFiltro = 'todas' | 'activas' | 'inactivas'
export type VistaPersonas = 'lista' | 'por-rol'

export interface FiltrosPersonas {
  busqueda: string
  rol: string
  estado: EstadoFiltro
  squad: string
  contratacion: string
}

export const FILTROS_INICIALES: FiltrosPersonas = {
  busqueda: '',
  rol: '',
  estado: 'todas',
  squad: '',
  contratacion: '',
}

/** Respuesta de `GET /personas/{id}/impacto`. */
export interface ImpactoEliminacion {
  persona_id: string
  nombre: string
  cascada: { asignaciones: number; capacidades: number; work_items: number }
  referencias: { requerimientos: number; squads: number }
  eliminable: boolean
}
