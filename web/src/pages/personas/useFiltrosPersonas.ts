// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useMemo, useState } from 'react'
import type { Persona } from '../../types'
import { FILTROS_INICIALES } from './tipos'
import type { FiltrosPersonas, VistaPersonas } from './tipos'

export const TAMANIO_PAGINA = 14
const CLAVE_VISTA = 'personas.vista'

export interface GrupoRol {
  rol: string
  personas: Persona[]
}

function vistaGuardada(): VistaPersonas {
  try {
    return sessionStorage.getItem(CLAVE_VISTA) === 'por-rol' ? 'por-rol' : 'lista'
  } catch {
    return 'lista'
  }
}

/** Filtros, vista (recordada por sesión), agrupado por rol y paginación del directorio. */
export function useFiltrosPersonas(personas: Persona[], roles: string[]) {
  const [filtros, setFiltros] = useState<FiltrosPersonas>(FILTROS_INICIALES)
  const [vista, setVistaEstado] = useState<VistaPersonas>(vistaGuardada)
  const [pagina, setPagina] = useState(1)
  const [colapsados, setColapsados] = useState<Set<string>>(new Set())

  const cambiarFiltros = useCallback((parcial: Partial<FiltrosPersonas>) => {
    setFiltros((previo) => ({ ...previo, ...parcial }))
    setPagina(1)
  }, [])

  const limpiarFiltros = useCallback(() => {
    setFiltros(FILTROS_INICIALES)
    setPagina(1)
  }, [])

  const setVista = useCallback((nueva: VistaPersonas) => {
    setVistaEstado(nueva)
    setPagina(1)
    try {
      sessionStorage.setItem(CLAVE_VISTA, nueva)
    } catch {
      // sin almacenamiento de sesión: la preferencia no se recuerda
    }
  }, [])

  const alternarGrupo = useCallback((rol: string) => {
    setColapsados((previo) => {
      const siguiente = new Set(previo)
      if (siguiente.has(rol)) siguiente.delete(rol)
      else siguiente.add(rol)
      return siguiente
    })
  }, [])

  const filtradas = useMemo(() => {
    const q = filtros.busqueda.trim().toLowerCase()
    return personas.filter((p) => {
      if (filtros.rol && (p.rol_operativo ?? '') !== filtros.rol) return false
      if (filtros.estado === 'activas' && !p.activo) return false
      if (filtros.estado === 'inactivas' && p.activo) return false
      if (filtros.squad && !(p.squads ?? []).includes(filtros.squad)) return false
      if (filtros.contratacion && (p.tipo_contratacion ?? '') !== filtros.contratacion) return false
      if (!q) return true
      return (
        p.nombre.toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.squads ?? []).join(' ').toLowerCase().includes(q) ||
        (p.rol_operativo ?? '').toLowerCase().includes(q)
      )
    })
  }, [personas, filtros])

  // Roles en el orden del catálogo, luego los que existen en datos pero no en el catálogo.
  const rolesVisibles = useMemo(() => {
    const extra = new Set<string>()
    for (const p of personas) {
      const r = p.rol_operativo ?? ''
      if (r && !roles.includes(r)) extra.add(r)
    }
    return [...roles, ...Array.from(extra).sort((a, b) => a.localeCompare(b, 'es'))]
  }, [personas, roles])

  const resumenRoles = useMemo(
    () =>
      rolesVisibles.map((rol) => {
        const delRol = personas.filter((p) => (p.rol_operativo ?? '') === rol)
        return { rol, total: delRol.length, activas: delRol.filter((p) => p.activo).length }
      }),
    [personas, rolesVisibles],
  )

  const grupos = useMemo<GrupoRol[]>(() => {
    const resultado: GrupoRol[] = []
    for (const rol of [...rolesVisibles, '']) {
      const delRol = filtradas.filter((p) => (p.rol_operativo ?? '') === rol)
      if (delRol.length > 0) resultado.push({ rol, personas: delRol })
    }
    return resultado
  }, [filtradas, rolesVisibles])

  const opcionesSquad = useMemo(() => {
    const s = new Set<string>()
    for (const p of personas) for (const q of p.squads ?? []) s.add(q)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }, [personas])

  const opcionesContratacion = useMemo(() => {
    const s = new Set<string>()
    for (const p of personas) if (p.tipo_contratacion) s.add(p.tipo_contratacion)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'))
  }, [personas])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAMANIO_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const paginaActual = useMemo(
    () => filtradas.slice((paginaSegura - 1) * TAMANIO_PAGINA, paginaSegura * TAMANIO_PAGINA),
    [filtradas, paginaSegura],
  )

  const hayFiltros =
    !!filtros.busqueda.trim() || !!filtros.rol || !!filtros.squad || !!filtros.contratacion || filtros.estado !== 'todas'

  return {
    filtros,
    cambiarFiltros,
    limpiarFiltros,
    hayFiltros,
    vista,
    setVista,
    filtradas,
    paginaActual,
    pagina: paginaSegura,
    totalPaginas,
    setPagina,
    grupos,
    colapsados,
    alternarGrupo,
    resumenRoles,
    rolesVisibles,
    opcionesSquad,
    opcionesContratacion,
  }
}
