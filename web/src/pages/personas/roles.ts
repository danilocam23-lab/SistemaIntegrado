// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/** Roles por defecto del código; el despliegue real los toma de `/personas/roles`. */
export const ROLES_DEFAULT = ['DEV', 'LT_HITSS', 'LT_EPM', 'SCRUM', 'EPM', 'COORD', 'LECTOR']

/** Rol sin tipo de contratación ni valores económicos (personal del cliente). */
export const ROL_SIN_CONTRATACION = 'LT_EPM'

/**
 * Color CATEGÓRICO de cada rol (identidad, no estado): nunca verde/ámbar/rojo.
 * El chip lleva siempre el nombre del rol escrito, para no depender solo del color.
 */
const COLOR_ROL: Record<string, string> = {
  DEV: '#1e5fa8',
  LT_HITSS: '#6d28d9',
  LT_EPM: '#0e7490',
  SCRUM: '#4338ca',
  EPM: '#475569',
  COORD: '#a21caf',
  LECTOR: '#78716c',
  'AR/QA': '#0d9488',
}

const COLOR_OTRO = '#64748b'

/** Roles con borde punteado: personal del cliente y roles sin color asignado. */
const ROLES_PUNTEADOS = new Set([ROL_SIN_CONTRATACION])

export function esRolConocido(rol: string | null | undefined): boolean {
  return !!rol && rol in COLOR_ROL
}

export function colorRol(rol: string | null | undefined): string {
  return rol && rol in COLOR_ROL ? COLOR_ROL[rol] : COLOR_OTRO
}

export function bordePunteado(rol: string | null | undefined): boolean {
  return !esRolConocido(rol) || ROLES_PUNTEADOS.has(rol as string)
}

/** Texto del chip: el rol tal cual, o «OTRO · nombre» si no tiene color asignado. */
export function etiquetaRol(rol: string | null | undefined): string {
  if (!rol) return 'Sin rol'
  return esRolConocido(rol) ? rol : `OTRO · ${rol}`
}
