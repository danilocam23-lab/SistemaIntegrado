// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Lógica pura de paginación client-side (sin React): testeable con node. */

export const REGISTROS_POR_PAGINA_DEFECTO = 50
export const REGISTROS_POR_PAGINA_MAXIMO = 500
export const CLAVE_REGISTROS_POR_PAGINA = 'registros_por_pagina'

/** Entero positivo acotado a [1, MAXIMO]; si falta, no es numérico o es <= 0 usa el defecto. */
export function normalizarRegistrosPorPagina(valor: unknown): number {
  const texto = typeof valor === 'string' ? valor.trim() : valor
  if (texto === '' || texto == null || typeof texto === 'boolean') return REGISTROS_POR_PAGINA_DEFECTO
  const numero = Number(texto)
  if (!Number.isFinite(numero)) return REGISTROS_POR_PAGINA_DEFECTO
  const entero = Math.floor(numero)
  if (entero <= 0) return REGISTROS_POR_PAGINA_DEFECTO
  return Math.min(entero, REGISTROS_POR_PAGINA_MAXIMO)
}

/** Elige el registro de `registros_por_pagina` entre todos los que devuelve `/configuracion`
 *  (hay uno por aplicación; el API no filtra). Criterio determinista: 1) el `global`
 *  (lo que se edita en Parámetros), 2) el de la aplicación activa, 3) el primero. */
export function elegirRegistroPorPagina<T extends { clave: string; aplicacion_id?: string }>(
  configuracion: ReadonlyArray<T>,
  aplicacionActiva?: string,
): T | undefined {
  const candidatos = configuracion.filter((c) => c.clave === CLAVE_REGISTROS_POR_PAGINA)
  const global = candidatos.find((c) => c.aplicacion_id === 'global')
  if (global) return global
  if (aplicacionActiva && aplicacionActiva !== '__todas__') {
    const activa = candidatos.find((c) => c.aplicacion_id === aplicacionActiva)
    if (activa) return activa
  }
  return candidatos[0]
}

/** Valor normalizado de `registros_por_pagina` según `elegirRegistroPorPagina`. */
export function leerRegistrosPorPagina(
  configuracion: ReadonlyArray<{ clave: string; valor: unknown; aplicacion_id?: string }>,
  aplicacionActiva?: string,
): number {
  return normalizarRegistrosPorPagina(elegirRegistroPorPagina(configuracion, aplicacionActiva)?.valor)
}

export interface RangoPagina {
  /** Página efectiva (1..totalPaginas), corregida si la pedida queda fuera de rango. */
  pagina: number
  totalPaginas: number
  /** Índices para `slice(inicio, fin)`. */
  inicio: number
  fin: number
  /** Rango 1-based para "Mostrando desde–hasta de total" (0–0 si no hay filas). */
  desde: number
  hasta: number
  total: number
}

export function calcularRangoPagina(total: number, paginaPedida: number, tamano: number): RangoPagina {
  const tam = normalizarRegistrosPorPagina(tamano)
  const totalSeguro = Math.max(0, Math.floor(total) || 0)
  const totalPaginas = Math.max(1, Math.ceil(totalSeguro / tam))
  const pedida = Number.isFinite(paginaPedida) ? Math.floor(paginaPedida) : 1
  const pagina = Math.min(Math.max(1, pedida), totalPaginas)
  const inicio = (pagina - 1) * tam
  const fin = Math.min(inicio + tam, totalSeguro)
  return {
    pagina, totalPaginas, inicio, fin, total: totalSeguro,
    desde: totalSeguro === 0 ? 0 : inicio + 1,
    hasta: fin,
  }
}
