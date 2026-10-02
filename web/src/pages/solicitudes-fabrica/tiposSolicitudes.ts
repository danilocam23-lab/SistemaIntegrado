// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

export interface RegistroSoporte {
  id: string
  aplicacion_id: string
  fila_origen: number
  lider: string
  squad: string
  datos: Record<string, string>
  sincronizado_en: string | null
}

export interface ListadoPaginadoResponse {
  total: number
  pagina: number
  tamanio: number
  total_paginas: number
  ultima_actualizacion: string | null
  headers: string[]
  registros: RegistroSoporte[]
}

export interface ErrorValidacion {
  fila: number
  lider: string | null
  squad: string | null
  motivo: string
}

export interface UltimaSincronizacion {
  sync_id: string
  estado: string
  archivo: string | null
  total_encontrados: number
  validos: number
  con_error: number
  cargados: number
  omitidos: number
  iniciado_en: string
  finalizado_en: string | null
  error_general: string | null
  errores: ErrorValidacion[]
}

export interface PreviewResponse {
  fuente_url: string
  archivo: string
  total_encontrados: number
  registros_validos: number
  registros_con_error: number
  registros_que_seran_cargados: number
  registros_que_no_seran_cargados: number
  errores: ErrorValidacion[]
}

export interface SyncResponse {
  sync_id: string
  total_procesados: number
  registros_creados: number
  registros_omitidos: number
  tiempo_ejecucion_ms: number
}

export function fmtFecha(fecha: string | null): string {
  if (!fecha) return '—'
  // El backend guarda las fechas en UTC pero las serializa sin sufijo de zona
  // horaria (p. ej. "2026-09-08T21:10:17"), así que si no trae 'Z' ni offset
  // se le agrega para que no se interprete por error como hora local del
  // navegador. Luego se formatea explícitamente en hora de Colombia.
  const iso = /[zZ]|[+-]\d{2}:\d{2}$/.test(fecha) ? fecha : `${fecha}Z`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
}

export const CAMPOS_TASK10 = [
  'Task ID 10',
  'Task Name 10',
  'Status Task 10',
  'Assignee Group 10',
  'Assignee 10',
  'Start Assignment Task 10',
  'End Assignment Task 10',
  'Total Hours Assigned Task 10',
  'Total Minutes Assigned Task 10',
]

export const CAMPOS_TASK20 = [
  'Task ID 20',
  'Task Name 20',
  'Status Task 20',
  'Assignee Group 20',
  'Assignee 20',
  'Start Assignment Task 20',
  'End Assignment Task 20',
  'Total Hours Assigned Task 20',
  'Total Minutes Assigned Task 20',
]

export const CAMPOS_TASK30 = [
  'Task ID 30',
  'Task Name 30',
  'Status Task 30',
  'Assignee Group 30',
  'Assignee 30',
  'Start Assignment Task 30',
  'End Assignment Task 30',
  'Total Hours Assigned Task 30',
  'Total Minutes Assigned Task 30',
]
