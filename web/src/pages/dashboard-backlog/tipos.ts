// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Nivel de avance (mismo criterio de umbrales que la insignia de ANS). */
export type NivelAvance = 'exito' | 'alerta' | 'error'

export interface FilaSquad {
  squadId: string | null
  squad: string
  reqs: number
  /** Horas estimadas de los requerimientos (total_horas_estimadas completas). */
  horas: number
  /** Horas de las entregas que caen en el periodo seleccionado. */
  horasEntregas: number
  entregas: number
  ansActaCumple: number
  ansActaTotal: number
  ansEntregaCumple: number
  ansEntregaTotal: number
  aplicacionesEpmCount: number
}

export interface RegistroSoporteResumen {
  id: string
  Work_Order_ID: string
  Fecha_Fin_Real: string
  Horas_Estimadas: string
  Horas_Aprobadas: string
  Horas_Reales: string
}

export interface ResumenSoporteResponse {
  registros: RegistroSoporteResumen[]
}

export interface FilaCapacidadSquad {
  squadId: string
  squad: string
  horas: number
  personas: number
}

export interface FilaDetallePersona {
  personaId: string
  nombre: string
  squad: string
  horas: number
  personalizada: boolean
  predeterminada: boolean
}

export interface FilaEntregasMes {
  mes: string
  label: string
  entregas: number
  horas: number
}

export interface FilaWoMes {
  mes: string
  label: string
  wo: number
  woHoras: number
}

export interface FilaDetalleWo {
  mes: string
  label: string
  workOrder: string
  horasAprobadas: number
}

export interface FilaDetalleAplicacionEpm {
  aplicacionEpm: string
  cantidadRequerimientos: number
}

/** Fila de squad enriquecida con porcentajes de ANS, carga y estado de riesgo. */
export interface FilaSquadAnalisis extends FilaSquad {
  porcentajeActa: number | null
  porcentajeEntrega: number | null
  nivelActa: NivelAvance | null
  nivelEntrega: NivelAvance | null
  /** Peor nivel entre ANS Acta y ANS Entrega (null si ninguno tiene datos). */
  nivelGlobal: NivelAvance | null
  /** Horas disponibles del squad en el periodo (null si no hay capacidad configurada). */
  capacidadHoras: number | null
  /** Horas de entregas del periodo / capacidad del periodo, en % (null si no hay capacidad). */
  utilizacion: number | null
  sobrecarga: boolean
}

export interface ResumenRiesgo {
  criticos: number
  enAtencion: number
  sobrecargados: number
  /** Squads con al menos un indicador fuera de "exito" o en sobrecarga. */
  enRiesgo: number
}

/** Presets rápidos del filtro de rango: últimos N meses o todo el histórico. */
export type PresetRango = 3 | 6 | 12 | 'todo'
