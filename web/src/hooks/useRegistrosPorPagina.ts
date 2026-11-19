// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react'
import { useLista } from '../api/hooks'
import { useAplicacion } from '../context/AplicacionContext'
import type { Configuracion } from '../types'
import { calcularRangoPagina, leerRegistrosPorPagina } from '../utils/paginacion'

/** Registros por página configurados (clave `registros_por_pagina`, pestaña Parámetros).
 *  Comparte petición y caché con el resto de `useLista('/configuracion')`. */
export function useRegistrosPorPagina(): number {
  const { datos } = useLista<Configuracion>('/configuracion')
  const { activa } = useAplicacion()
  return useMemo(() => leerRegistrosPorPagina(datos, activa), [datos, activa])
}

/** Paginación client-side como último paso: recibe TODAS las filas ya filtradas/ordenadas.
 *  `claveReinicio` identifica filtros/búsqueda/orden: al cambiar, vuelve a la página 1. */
export function usePaginacion<T>(filas: readonly T[], tamano: number, claveReinicio: string) {
  const [estado, setEstado] = useState({ pagina: 1, clave: claveReinicio })
  const paginaPedida = estado.clave === claveReinicio ? estado.pagina : 1
  const rango = calcularRangoPagina(filas.length, paginaPedida, tamano)
  const filasPagina = useMemo(
    () => filas.slice(rango.inicio, rango.fin),
    [filas, rango.inicio, rango.fin],
  )
  const cambiarPagina = (pagina: number) => setEstado({ pagina, clave: claveReinicio })
  return { filasPagina, rango, cambiarPagina }
}
