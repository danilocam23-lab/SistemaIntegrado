// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  agruparPlano, agruparPorPersona, calcularCargaPorPersona, construirBase, construirRango,
  indicesDePreset, rangoTodoRecortado, seSolapaConRango, TODOS_ID,
} from './derivados'
import { etiquetaIndiceMes, hoyLocal, indiceMes } from './fechas'
import type { GrupoRoadmap, ModoAgrupacion, PresetRango, ReqRoadmap } from './tipos'
import { useDatosRoadmap } from './useDatosRoadmap'

export interface ResumenRoadmap {
  requerimientos: number
  personasConCarga: number
  inactivasConReqs: number
  sinAsignar: number
  vencidos: ReqRoadmap[]
  sobrecarga: GrupoRoadmap[]
}

/** Estado de filtros y datos derivados del Roadmap (grupos, rango, resumen). */
export function useRoadmap() {
  const datos = useDatosRoadmap()
  const hoy = useMemo(() => hoyLocal(), [])

  const [modo, setModo] = useState<ModoAgrupacion>('usuario')
  const [filtroPersona, setFiltroPersona] = useState(TODOS_ID)
  const [busqueda, setBusqueda] = useState('')
  const [estadosActivos, setEstadosActivos] = useState<Set<string>>(new Set())
  const [preset, setPreset] = useState<PresetRango>('6')
  const [personalizado, setPersonalizado] = useState({ desde: indiceMes(hoy) - 2, hasta: indiceMes(hoy) + 3 })
  const [contraidos, setContraidos] = useState<Set<string>>(new Set())

  const base = useMemo(
    () => construirBase(datos.requerimientos, datos.categoriasPorId, hoy),
    [datos.requerimientos, datos.categoriasPorId, hoy],
  )

  /* Estados: al llegar los datos se marcan todos; vacío significa "todos" (sin filtro). */
  const estadosDisponibles = useMemo(() => {
    const conjunto = new Set<string>()
    datos.requerimientos.forEach((r) => { if (r.estado) conjunto.add(r.estado) })
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b, 'es'))
  }, [datos.requerimientos])

  useEffect(() => {
    if (estadosDisponibles.length === 0) return
    setEstadosActivos((previo) => {
      const siguiente = new Set<string>()
      previo.forEach((estado) => { if (estadosDisponibles.includes(estado)) siguiente.add(estado) })
      if (siguiente.size === 0) estadosDisponibles.forEach((estado) => siguiente.add(estado))
      return siguiente
    })
  }, [estadosDisponibles])

  /* Rango de meses */
  const indices = useMemo(
    () => indicesDePreset(preset, hoy, base.ultimoIndice, personalizado),
    [preset, hoy, base.ultimoIndice, personalizado],
  )
  const rango = useMemo(() => construirRango(indices.desde, indices.hasta, hoy), [indices, hoy])
  const rangoRecortado = preset === 'todo' && rangoTodoRecortado(hoy, base.ultimoIndice)

  const opcionesMes = useMemo(() => {
    const h = indiceMes(hoy)
    const desde = Math.min(h - 12, base.primerIndice ?? h - 12)
    const hasta = Math.max(h + 12, base.ultimoIndice ?? h + 12, rango.hastaIndice)
    const lista: { indice: number; etiqueta: string }[] = []
    for (let i = desde; i <= hasta; i++) lista.push({ indice: i, etiqueta: etiquetaIndiceMes(i) })
    return lista
  }, [hoy, base.primerIndice, base.ultimoIndice, rango.hastaIndice])

  const elegirPreset = useCallback((nuevo: PresetRango) => setPreset(nuevo), [])

  /** Cambia un extremo del rango; si se cruzan, el otro extremo lo acompaña. */
  const cambiarExtremo = useCallback((extremo: 'desde' | 'hasta', valor: number) => {
    const actual = { desde: rango.desdeIndice, hasta: rango.hastaIndice }
    const siguiente = { ...actual, [extremo]: valor }
    if (siguiente.desde > siguiente.hasta) {
      if (extremo === 'desde') siguiente.hasta = valor
      else siguiente.desde = valor
    }
    setPersonalizado(siguiente)
    setPreset('personalizado')
  }, [rango.desdeIndice, rango.hastaIndice])

  /* Filtro de requerimientos: estados, búsqueda y solape con el rango */
  const textoBusqueda = busqueda.trim().toLowerCase()
  const pasaFiltros = useCallback((r: { req: { estado: string; codigo_req: string; nombre: string | null } }) => {
    if (estadosActivos.size > 0 && !estadosActivos.has(r.req.estado)) return false
    if (textoBusqueda) {
      const texto = `${r.req.codigo_req} ${r.req.nombre ?? ''}`.toLowerCase()
      if (!texto.includes(textoBusqueda)) return false
    }
    return true
  }, [estadosActivos, textoBusqueda])

  const visibles = useMemo(
    () => base.dibujables.filter((r) => pasaFiltros(r) && seSolapaConRango(r, rango)),
    [base.dibujables, pasaFiltros, rango],
  )

  /** Requerimientos que cumplen estado y búsqueda pero no tienen ninguna fecha de inicio. */
  const sinFecha = useMemo(
    () => base.sinFecha.filter((req) => pasaFiltros({ req })),
    [base.sinFecha, pasaFiltros],
  )

  /** Cuántos requerimientos (con filtros de estado/búsqueda) existen fuera del rango. */
  const fueraDeRango = useMemo(
    () => base.dibujables.filter((r) => pasaFiltros(r)).length - visibles.length,
    [base.dibujables, pasaFiltros, visibles.length],
  )

  const cargas = useMemo(
    () => (datos.cargaDisponible ? calcularCargaPorPersona(datos.asignaciones, datos.requerimientos) : null),
    [datos.cargaDisponible, datos.asignaciones, datos.requerimientos],
  )

  const gruposUsuario = useMemo(
    () => agruparPorPersona(
      visibles, datos.personas, datos.asignaciones, cargas, modo === 'usuario' ? filtroPersona : TODOS_ID,
    ),
    [visibles, datos.personas, datos.asignaciones, cargas, modo, filtroPersona],
  )
  const grupos = useMemo(
    () => (modo === 'plano' ? agruparPlano(visibles) : gruposUsuario),
    [modo, visibles, gruposUsuario],
  )

  const resumen = useMemo<ResumenRoadmap>(() => {
    const unicos = new Map<string, ReqRoadmap>()
    gruposUsuario.forEach((g) => g.categorias.forEach((c) => c.reqs.forEach((r) => unicos.set(r.req.id, r))))
    const sinAsignarGrupo = gruposUsuario.find((g) => g.sinAsignar)
    return {
      requerimientos: unicos.size,
      personasConCarga: gruposUsuario.filter((g) => !g.sinAsignar && !g.inactiva).length,
      inactivasConReqs: gruposUsuario.filter((g) => g.inactiva).length,
      sinAsignar: sinAsignarGrupo?.totalReqs ?? 0,
      vencidos: Array.from(unicos.values()).filter((r) => r.vencido),
      sobrecarga: gruposUsuario.filter((g) => g.carga !== null && g.carga > 100),
    }
  }, [gruposUsuario])

  const alternarContraido = useCallback((id: string) => {
    setContraidos((previo) => {
      const siguiente = new Set(previo)
      if (siguiente.has(id)) siguiente.delete(id)
      else siguiente.add(id)
      return siguiente
    })
  }, [])

  return {
    datos, hoy, base,
    modo, setModo, filtroPersona, setFiltroPersona, busqueda, setBusqueda,
    estadosActivos, setEstadosActivos, estadosDisponibles,
    preset, elegirPreset, cambiarExtremo, rango, rangoRecortado, opcionesMes,
    visibles, sinFecha, fueraDeRango, grupos, resumen, contraidos, alternarContraido,
  }
}
