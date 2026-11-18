// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Un campo vacío limpia el dato; cero y fracciones son valores válidos. */
export function convertirHorasSiguienteAnio(valor: string): number | null {
  if (!valor.trim()) return null
  const horas = Number(valor)
  if (!Number.isFinite(horas) || horas < 0) {
    throw new Error('El número de horas para el siguiente año debe ser finito y mayor o igual a cero.')
  }
  return horas
}
