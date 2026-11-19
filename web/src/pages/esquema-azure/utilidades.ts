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

/**
 * Inserta los hijos recien cargados bajo `padreId` sin duplicar los que ya estaban
 * y recalcula `hijos_pendientes` del padre. No muta el arbol original.
 */
export function fusionarHijos(
  nodos: NodoEsquemaAzure[],
  padreId: number,
  nuevos: NodoEsquemaAzure[],
  total: number,
): NodoEsquemaAzure[] {
  return nodos.map((nodo) => {
    if (nodo.azdo_id === padreId) {
      const vistos = new Set(nodo.hijos.map((hijo) => hijo.azdo_id))
      const agregados: NodoEsquemaAzure[] = []
      for (const hijo of nuevos) {
        if (vistos.has(hijo.azdo_id)) continue
        vistos.add(hijo.azdo_id)
        agregados.push(hijo)
      }
      const hijos = [...nodo.hijos, ...agregados]
      const pendientes = Math.max(0, total - hijos.length)
      return { ...nodo, hijos, hijos_pendientes: pendientes }
    }
    if (nodo.hijos.length === 0) return nodo
    const hijos = fusionarHijos(nodo.hijos, padreId, nuevos, total)
    const cambio = hijos.some((hijo, i) => hijo !== nodo.hijos[i])
    return cambio ? { ...nodo, hijos } : nodo
  })
}

/** Cantidad de hijos ya cargados del nodo `id` (0 si no existe). */
export function hijosCargados(nodos: NodoEsquemaAzure[], id: number): number {
  for (const nodo of nodos) {
    if (nodo.azdo_id === id) return nodo.hijos.length
    const n = hijosCargados(nodo.hijos, id)
    if (n > 0) return n
  }
  return 0
}

/** Aviso de arbol parcial; cadena vacia si no hay truncado. */
export function textoAvisoTruncado(
  mostrados: number,
  totalCoincidentes: number | undefined,
  truncado: boolean,
): string {
  if (!truncado) return ''
  const fmt = (n: number) => n.toLocaleString('es-CO')
  const de = totalCoincidentes !== undefined ? ` de ${fmt(totalCoincidentes)}` : ''
  return `Mostrando ${fmt(mostrados)}${de} work items sincronizados. La sincronización guarda todos; expande un nodo con «+K hijos» para cargar el resto o filtra por tipo, estado o iteración.`
}
