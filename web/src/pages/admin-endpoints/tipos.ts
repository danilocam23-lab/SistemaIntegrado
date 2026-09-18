// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** Clasificación de riesgo de una operación (F4.3, ADR-0008): la calcula el backend, no el cliente. */
export type Riesgo = 'seguro' | 'mutante' | 'destructivo'

/** Tono semántico por nivel de riesgo, reutilizado por la compuerta de confirmación (F4.7) y el chip de la tabla. */
export const RIESGO_TONO: Record<Riesgo, 'exito' | 'alerta' | 'error'> = {
  seguro: 'exito',
  mutante: 'alerta',
  destructivo: 'error',
}

export const RIESGO_ETIQUETA: Record<Riesgo, string> = {
  seguro: 'Seguro',
  mutante: 'Mutante',
  destructivo: 'Destructivo',
}
