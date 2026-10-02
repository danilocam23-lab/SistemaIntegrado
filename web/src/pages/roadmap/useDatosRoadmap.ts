// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useState } from 'react'
import client from '../../api/client'
import type {
  AsignacionRoadmap, CategoriaRoadmap, PersonaRoadmap, RequerimientoRoadmap,
} from './tipos'

interface RespuestaRoadmap {
  requerimientos?: RequerimientoRoadmap[]
  personas?: PersonaRoadmap[]
  categorias?: CategoriaRoadmap[]
  asignaciones?: AsignacionRoadmap[]
}

/** Primero los de código mayor (aprox. más recientes); el backend no los ordena. */
function porCodigoDesc(a: RequerimientoRoadmap, b: RequerimientoRoadmap): number {
  return b.codigo_req.localeCompare(a.codigo_req, 'es', { numeric: true })
}

/**
 * Carga de datos del Roadmap (solo lectura) en UNA llamada a `/reportes/roadmap`
 * (permiso `roadmap.ver`). Si falla, falla la pantalla: no hay fuentes degradables.
 */
export function useDatosRoadmap() {
  const [respuesta, setRespuesta] = useState<RespuestaRoadmap | null>(null)
  const [hayError, setHayError] = useState(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)

  const cargar = useCallback(() => {
    client
      .get<RespuestaRoadmap>('/reportes/roadmap')
      .then((r) => {
        setRespuesta(r.data)
        setHayError(false)
      })
      .catch(() => setHayError(true))
      .finally(() => setCargandoInicial(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Un refresco no vuelve a mostrar el esqueleto (`cargandoInicial` solo es true la primera vez).
  const reintentar = useCallback(() => {
    setHayError(false)
    setCargandoInicial(true)
    cargar()
  }, [cargar])

  const requerimientos = useMemo(
    () => [...(respuesta?.requerimientos ?? [])].sort(porCodigoDesc),
    [respuesta],
  )
  const personas = useMemo(() => respuesta?.personas ?? [], [respuesta])
  const asignaciones = useMemo(() => respuesta?.asignaciones ?? [], [respuesta])
  const categoriasPorId = useMemo(() => {
    const mapa = new Map<string, CategoriaRoadmap>()
    ;(respuesta?.categorias ?? []).forEach((c) => mapa.set(c.id, c))
    return mapa
  }, [respuesta])

  return {
    requerimientos,
    personas,
    categoriasPorId,
    asignaciones,
    cargandoInicial,
    hayError,
    /** La carga se calcula con las asignaciones de la misma respuesta. */
    cargaDisponible: respuesta !== null && !hayError,
    reintentar,
  }
}
