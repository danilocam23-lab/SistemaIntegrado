// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

interface Columna {
  key: string
}

/** El orden nunca se deriva del conjunto de visibilidad (históricamente era orden de clics). */
export function normalizarOrdenColumnas(valor: unknown, catalogo: readonly Columna[]): string[] {
  const conocidas = new Set(catalogo.map((columna) => columna.key))
  const guardadas = Array.isArray(valor)
    ? valor.filter((clave): clave is string => typeof clave === 'string' && conocidas.has(clave))
    : []
  return [...new Set([...guardadas, ...catalogo.map((columna) => columna.key)])]
}

export function leerOrdenColumnas(
  datos: readonly { clave: string; valor?: string }[],
  clave: string,
  catalogo: readonly Columna[],
): string[] {
  try {
    return normalizarOrdenColumnas(JSON.parse(datos.find((dato) => dato.clave === clave)?.valor ?? 'null'), catalogo)
  } catch {
    return normalizarOrdenColumnas(null, catalogo)
  }
}

export function ordenarColumnasVisibles<T extends Columna>(
  catalogo: readonly T[],
  orden: readonly string[],
  activas: ReadonlySet<string>,
): T[] {
  const porClave = new Map(catalogo.map((columna) => [columna.key, columna]))
  return normalizarOrdenColumnas(orden, catalogo)
    .filter((clave) => activas.has(clave))
    .map((clave) => porClave.get(clave)!)
}

/** Mueve entre posiciones visibles; conserva los huecos y el orden relativo de las ocultas. */
export function moverColumnaVisible(
  orden: readonly string[],
  activas: ReadonlySet<string>,
  clave: string,
  posicion: number,
): string[] {
  const visibles = orden.filter((actual) => activas.has(actual))
  if (!visibles.includes(clave) || !Number.isInteger(posicion) || posicion < 1 || posicion > visibles.length) {
    throw new RangeError(`La posición debe ser un entero entre 1 y ${visibles.length}.`)
  }
  visibles.splice(visibles.indexOf(clave), 1)
  visibles.splice(posicion - 1, 0, clave)
  let indice = 0
  return orden.map((actual) => activas.has(actual) ? visibles[indice++] : actual)
}
