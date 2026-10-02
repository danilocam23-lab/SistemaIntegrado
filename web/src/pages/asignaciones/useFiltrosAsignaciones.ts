// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useState } from 'react'
import { FILTROS_INICIALES } from './tipos'
import type { FiltrosAsignaciones } from './tipos'

const CLAVE = 'asignaciones.filtros.v1'

function leer(): FiltrosAsignaciones {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE)
    if (!crudo) return FILTROS_INICIALES
    const dato = JSON.parse(crudo) as Partial<FiltrosAsignaciones>
    return {
      vista: dato.vista === 'personas' ? 'personas' : 'actas',
      estado: typeof dato.estado === 'string' ? dato.estado : FILTROS_INICIALES.estado,
      persona: typeof dato.persona === 'string' ? dato.persona : FILTROS_INICIALES.persona,
      mostrar: dato.mostrar === 'alerta' || dato.mostrar === 'prioridad' ? dato.mostrar : 'todo',
      orden: dato.orden === 'nombre' ? 'nombre' : 'carga',
    }
  } catch {
    return FILTROS_INICIALES
  }
}

/**
 * Filtros y pestaña de la pantalla, guardados en `sessionStorage`: sobreviven a
 * cambiar de pestaña, navegar y recargar, solo en este navegador. Comparten las
 * dos pestañas (Por Actas / Por Personas).
 */
export function useFiltrosAsignaciones() {
  const [filtros, setFiltros] = useState<FiltrosAsignaciones>(leer)

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CLAVE, JSON.stringify(filtros))
    } catch {
      // sessionStorage no disponible (modo privado estricto): se ignora, solo se pierde la persistencia.
    }
  }, [filtros])

  const actualizar = useCallback((parcial: Partial<FiltrosAsignaciones>) => {
    setFiltros((previo) => ({ ...previo, ...parcial }))
  }, [])

  const limpiar = useCallback(() => {
    setFiltros((previo) => ({
      ...previo,
      estado: FILTROS_INICIALES.estado,
      persona: FILTROS_INICIALES.persona,
      mostrar: FILTROS_INICIALES.mostrar,
    }))
  }, [])

  const hayFiltros =
    filtros.estado !== FILTROS_INICIALES.estado ||
    filtros.persona !== FILTROS_INICIALES.persona ||
    filtros.mostrar !== FILTROS_INICIALES.mostrar

  const nFiltros =
    (filtros.estado !== FILTROS_INICIALES.estado ? 1 : 0) +
    (filtros.persona !== FILTROS_INICIALES.persona ? 1 : 0) +
    (filtros.mostrar !== FILTROS_INICIALES.mostrar ? 1 : 0)

  return { filtros, actualizar, limpiar, hayFiltros, nFiltros }
}
