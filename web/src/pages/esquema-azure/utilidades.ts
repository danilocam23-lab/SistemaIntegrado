// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { NodoEsquemaAzure } from '../../types'

export function idsDelArbol(nodos: NodoEsquemaAzure[]): number[] {
  return nodos.flatMap((nodo) => [nodo.azdo_id, ...idsDelArbol(nodo.hijos)])
}

export function contarPorTipo(nodos: NodoEsquemaAzure[]): Record<string, number> {
  const conteo: Record<string, number> = {}
  for (const nodo of nodos) {
    conteo[nodo.tipo] = (conteo[nodo.tipo] ?? 0) + 1
    const conteoHijos = contarPorTipo(nodo.hijos)
    for (const [tipo, cantidad] of Object.entries(conteoHijos)) {
      conteo[tipo] = (conteo[tipo] ?? 0) + cantidad
    }
  }
  return conteo
}

export function filtrarArbol(nodos: NodoEsquemaAzure[], busqueda: string): NodoEsquemaAzure[] {
  const texto = busqueda.trim().toLocaleLowerCase('es')
  if (!texto) return nodos

  return nodos.flatMap((nodo) => {
    const hijos = filtrarArbol(nodo.hijos, texto)
    const coincide =
      nodo.titulo.toLocaleLowerCase('es').includes(texto) || String(nodo.azdo_id).includes(texto)

    if (coincide || hijos.length > 0) return [{ ...nodo, hijos }]
    return []
  })
}

export function resumenConteo(conteo: Record<string, number>): string {
  const entradas = Object.entries(conteo)
  if (entradas.length === 0) return 'Sin work items cargados'
  return entradas.map(([tipo, cantidad]) => `${cantidad} ${tipo}`).join(' · ')
}

export function colorAzure(color: string | null | undefined): string | undefined {
  if (!color) return undefined
  const limpio = color.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return undefined
  return `#${limpio}`
}
