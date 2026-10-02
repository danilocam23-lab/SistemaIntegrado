// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Capacidad, Persona } from '../../types'

/** Capacidad tal como la devuelve la API (incluye campos que el tipo compartido no declara). */
export type CapacidadFila = Capacidad & {
  notas?: string | null
  aplicacion_id?: string
}

/** Persona con la aplicación a la que pertenece (visible en modo consolidado). */
export type PersonaConApp = Persona & { aplicacion_id?: string }

export const MESES_ABREV = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

export const MESES_LARGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Roles operativos que no tienen capacidad propia (igual que en Asignaciones y Backlog). */
export const ROLES_EXCLUIDOS_CAPACIDAD = ['LT_EPM']

/** Tope de horas de un mes (31 días × 24 h); el servidor valida el mismo rango. */
export const HORAS_MAX = 744

/** Equipo de las personas sin squad. */
export const SIN_SQUAD = 'Sin squad'

export type TonoCelda = 'ok' | 'bajo' | 'critico' | 'alto' | 'sin'

export interface CeldaCapacidad {
  /** `YYYY-MM`. */
  mes: string
  /** Índice 0 = enero … 11 = diciembre. */
  indice: number
  /** Registro vigente (el último si hay duplicados); `null` = sin registro. */
  registro: CapacidadFila | null
  /** Todos los registros de esa persona y mes (más de uno = duplicado). */
  duplicados: CapacidadFila[]
  /** Horas registradas, o `null` si no hay registro. */
  horas: number | null
  /** Base sugerida del mes. */
  base: number
  tono: TonoCelda
}

export interface CargaFila {
  /** % de carga vigente (requerimientos activos + sin requerimiento). */
  pct: number
  nAsignaciones: number
}

export interface FilaCapacidad {
  persona: PersonaConApp
  /** Persona desactivada con histórico: se ve en gris y solo lectura. */
  inactiva: boolean
  celdas: CeldaCapacidad[]
  /** Suma de horas registradas del año. */
  total: number
  conRegistro: number
  carga: CargaFila | null
  /** Horas de capacidad del mes en curso (registro o base). */
  capacidadMesActual: number
  sobrecarga: boolean
  subutilizada: boolean
  /** Sin registro en el mes en curso (solo si el año visible es el actual). */
  vacioMesActual: boolean
  conAlerta: boolean
}

export interface TotalMes {
  horas: number
  conRegistro: number
  personas: number
}

export interface FilaEquipo {
  equipo: string
  personas: FilaCapacidad[]
  porMes: TotalMes[]
  total: number
  cargaPromedio: number | null
}

export interface ItemLote {
  persona_id: string
  mes: string
  horas_disponibles: number
}

export type AccionLote = 'crear' | 'actualizar' | 'omitir'

export interface FilaPlanLote {
  personaId: string
  nombre: string
  mes: string
  horas: number
  accion: AccionLote
  /** Horas que ya tenía (para mostrar el antes/después). */
  horasActuales: number | null
  /** Id del registro existente (para el plan B por fila si no hay endpoint por lote). */
  registroId: string | null
  motivo?: string
}

export type AlcanceAplicacion = 'mes' | 'siguientes' | 'anio'

export interface ResultadoLote {
  total: number
  creadas: number
  actualizadas: number
  /** Mensajes de error de los lotes o filas que fallaron. */
  errores: string[]
}
