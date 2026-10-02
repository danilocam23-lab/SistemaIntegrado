// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Requerimiento } from '../../types'
import type { AsignacionItem } from './tipos'

/**
 * Aplicación a la que pertenece una asignación (cabecera `X-Aplicacion` en
 * modo consolidado): la propia, la de su primer requerimiento o la activa.
 */
export function resolverAppAsignacion(
  asig: AsignacionItem,
  requerimientoPorId: Map<string, Requerimiento>,
  activa: string,
): string {
  if (asig.aplicacion_id) return asig.aplicacion_id
  const reqId = asig.proyectos.find((p) => p.requerimiento_id)?.requerimiento_id
  const req = reqId ? requerimientoPorId.get(reqId) : undefined
  return req?.aplicacion_id ?? activa
}

/** Id del primer requerimiento de una asignación (`null` si no tiene). */
export function reqIdDeAsignacion(asig: AsignacionItem): string | null {
  return asig.proyectos.find((p) => p.requerimiento_id)?.requerimiento_id ?? null
}
