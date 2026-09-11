import type { FilaEstimacion } from '../../types'

export interface Filtros {
  codigoReq: string
  sc: string
  squad: string
  estado: string
  liderTecnico: string
  fechaSolicitudDesde: string
  fechaSolicitudHasta: string
  fechaComprometidaDesde: string
  fechaComprometidaHasta: string
  fechaLimiteDesde: string
  fechaLimiteHasta: string
  estadoEntrega: string
  ansEstimacion: string
  categoria: string
  tipificacion: string
  tipoCosto: string
}

export const FILTROS_INIT: Filtros = {
  codigoReq: '', sc: '', squad: '', estado: '', liderTecnico: '',
  fechaSolicitudDesde: '', fechaSolicitudHasta: '',
  fechaComprometidaDesde: '', fechaComprometidaHasta: '',
  fechaLimiteDesde: '', fechaLimiteHasta: '',
  estadoEntrega: '',
  ansEstimacion: '',
  categoria: '',
  tipificacion: '',
  tipoCosto: '',
}

export interface GrupoHU {
  key: string
  historia_usuario: string
  epica_feature: string
  filas: FilaEstimacion[]
  totalHorasEstimadas: number
  totalHorasFinales: number
  totalMejor: number
  totalPeor: number
  totalPromedio: number
  createdHU: number | null
  createdTasks: number[]
  createdTasksEpm: number[]
}

// INVARIANTE 13: CORE_COLUMNAS sube a tipos.ts; columnasExtra es el catalogo menos estas 15 historicas.
export const CORE_COLUMNAS = ['codigoReq', 'sc', 'squad', 'nombreActa', 'aplicacionEpm', 'estado', 'ansEstimacion', 'ltHitss', 'scrum', 'horas', 'fechaSolicitud', 'fechaLimite', 'fechaReal', 'diasTranscurridos', 'entregasCount']

export type ClaveSeccionResumen = 'type' | 'sprint' | 'complexity'
