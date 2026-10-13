// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Fecha de hoy (calendario de Bogotá) como `YYYY-MM-DD`. */
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

/** `2026-09-15T00:00:00` -> `15-sep` (o `15-sep-2026` con `conAnio`). Vacío si no hay fecha. */
export function fechaCorta(iso: string | null | undefined, conAnio = false): string {
  if (!iso) return '—'
  const [anio, mes, dia] = iso.slice(0, 10).split('-')
  const nombreMes = MESES[Number(mes) - 1]
  if (!nombreMes) return iso.slice(0, 10)
  return conAnio ? `${dia}-${nombreMes}-${anio}` : `${dia}-${nombreMes}`
}
