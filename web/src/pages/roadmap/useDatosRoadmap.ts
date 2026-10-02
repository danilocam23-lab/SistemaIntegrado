// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLista } from '../../api/hooks'
import type { Asignacion, Categoria, Persona, Requerimiento } from '../../types'

export interface FuenteConError {
  nombre: string
  /** Sin esta fuente la pantalla no se puede dibujar. */
  critica: boolean
  recargar: () => void
}

/**
 * Carga de datos del Roadmap (solo lectura): requerimientos y personas son
 * imprescindibles; categorías (colores) y asignaciones (carga) degradan la
 * pantalla pero no la bloquean. El error de cada fuente se informa por separado.
 */
export function useDatosRoadmap() {
  const lRequerimientos = useLista<Requerimiento>('/requerimientos')
  const lPersonas = useLista<Persona>('/personas')
  const lCategorias = useLista<Categoria>('/categorias')
  const lAsignaciones = useLista<Asignacion>('/asignaciones')

  // `cargandoInicial` solo en la primera carga: un refresco no vuelve a mostrar el esqueleto.
  const cargando = lRequerimientos.cargando || lPersonas.cargando
  const yaCargo = useRef(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  useEffect(() => {
    if (!cargando && !yaCargo.current) {
      yaCargo.current = true
      setCargandoInicial(false)
    }
  }, [cargando])

  const { recargar: recargarRequerimientos } = lRequerimientos
  const { recargar: recargarPersonas } = lPersonas
  const { recargar: recargarCategorias } = lCategorias
  const { recargar: recargarAsignaciones } = lAsignaciones

  const categoriasPorId = useMemo(() => {
    const mapa = new Map<string, Categoria>()
    lCategorias.datos.forEach((c) => mapa.set(c.id, c))
    return mapa
  }, [lCategorias.datos])

  const errores = useMemo<FuenteConError[]>(() => {
    const lista: FuenteConError[] = []
    if (lRequerimientos.error) lista.push({ nombre: 'Requerimientos', critica: true, recargar: recargarRequerimientos })
    if (lPersonas.error) lista.push({ nombre: 'Personas', critica: true, recargar: recargarPersonas })
    if (lCategorias.error) lista.push({ nombre: 'Categorías', critica: false, recargar: recargarCategorias })
    if (lAsignaciones.error) lista.push({ nombre: 'Asignaciones', critica: false, recargar: recargarAsignaciones })
    return lista
  }, [
    lRequerimientos.error, lPersonas.error, lCategorias.error, lAsignaciones.error,
    recargarRequerimientos, recargarPersonas, recargarCategorias, recargarAsignaciones,
  ])

  const reintentarFallidas = useCallback(() => {
    errores.forEach((e) => e.recargar())
  }, [errores])

  return {
    requerimientos: lRequerimientos.datos,
    personas: lPersonas.datos,
    categoriasPorId,
    asignaciones: lAsignaciones.datos,
    cargandoInicial,
    errores,
    hayErrorCritico: errores.some((e) => e.critica),
    /** La carga de Asignaciones es confiable (cargó sin error). */
    cargaDisponible: !lAsignaciones.error && !lAsignaciones.cargando && !lRequerimientos.error,
    reintentarFallidas,
  }
}
