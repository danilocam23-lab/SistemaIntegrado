// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

export const ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO']

export const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

export const ESTADO_TONO: Record<string, 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'> = {
  PENDIENTE: 'alerta',
  EN_PROGRESO: 'marca',
  COMPLETADO: 'exito',
  CANCELADO: 'neutro',
}

/** Color del borde superior de cada columna del tablero, alineado a `ESTADO_TONO`. */
export const ESTADO_BORDE: Record<string, string> = {
  PENDIENTE: 'border-t-amber-400',
  EN_PROGRESO: 'border-t-marca-500',
  COMPLETADO: 'border-t-emerald-500',
  CANCELADO: 'border-t-slate-300',
}
