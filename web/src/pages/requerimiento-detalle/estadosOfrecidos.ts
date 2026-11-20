// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

/**
 * Estados que ofrece el selector de estado de un requerimiento.
 *
 * - Sin mapa de transiciones (la carga falló) o sin requerimiento: todos los estados.
 * - Con mapa: el estado actual + los siguientes permitidos + los estados
 *   "personalizados", es decir, configurados en `estadosReq` pero que no aparecen
 *   ni como clave ni como valor del mapa (el backend los permite desde cualquier estado).
 * - Si el estado actual no figura en el mapa, se ofrecen todos (comportamiento anterior).
 */
export function calcularEstadosOfrecidos(
  estadoActual: string | undefined,
  estadosReq: string[],
  transiciones: Record<string, string[]> | null,
): string[] {
  const siguientes = transiciones?.[estadoActual ?? '']
  if (!estadoActual || !transiciones || !siguientes) return estadosReq

  const enMapa = new Set<string>()
  for (const [origen, destinos] of Object.entries(transiciones)) {
    enMapa.add(origen)
    destinos.forEach((d) => enMapa.add(d))
  }
  const personalizados = estadosReq.filter((s) => !enMapa.has(s))

  const resultado = [estadoActual]
  for (const s of [...siguientes, ...personalizados]) {
    if (!resultado.includes(s)) resultado.push(s)
  }
  return resultado
}
