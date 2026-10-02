// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useMemo, useState } from 'react'
import type { Persona, Requerimiento } from '../../types'
import { formatearPct } from './carga'
import { reqIdDeAsignacion } from './resolverApp'
import type { AsignacionItem, OpcionReq } from './tipos'

interface Parametros {
  asignaciones: AsignacionItem[]
  opcionesReq: OpcionReq[]
  requerimientoPorId: Map<string, Requerimiento>
  personasDisponibles: Persona[]
  puedeEditar: boolean
  /** % ya usado por la persona en requerimientos activos (sin la asignación indicada). */
  capacidadUsada: (personaId: string, excluyendoId?: string) => number
}

export interface OpcionesApertura {
  requerimientoId?: string
  personaId?: string
}

/**
 * Estado del panel lateral "Asignar" (alta y edición): campos controlados,
 * valores por defecto (el % propuesto es lo que le queda libre a la persona)
 * y apertura desde cualquier fila. No renderiza JSX ni escribe en el servidor.
 */
export function usePanelAsignar({
  asignaciones,
  opcionesReq,
  requerimientoPorId,
  personasDisponibles,
  puedeEditar,
  capacidadUsada,
}: Parametros) {
  const [abierto, setAbierto] = useState(false)
  const [asigEditando, setAsigEditando] = useState<AsignacionItem | null>(null)
  const [personaId, setPersonaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [porcentaje, setPorcentaje] = useState('')
  const [requerimientoId, setRequerimientoId] = useState('')
  const [prioridad, setPrioridad] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  const modoEdicion = asigEditando !== null

  const opcionReqSeleccionada = useMemo(
    () => opcionesReq.find((o) => o.id === requerimientoId) ?? null,
    [opcionesReq, requerimientoId],
  )

  /** Lo que le queda libre a la persona (tope 100 − requerimientos activos). */
  const restoDe = useCallback(
    (pid: string, excluyendoId?: string) => Math.max(0, 100 - capacidadUsada(pid, excluyendoId)),
    [capacidadUsada],
  )

  /** Categoría que ya usa la persona en sus asignaciones (para no pedirla de nuevo). */
  const categoriaHabitual = useCallback(
    (pid: string) => asignaciones.find((a) => a.persona_id === pid && a.categoria_id)?.categoria_id ?? '',
    [asignaciones],
  )

  const reiniciar = useCallback(() => {
    setAsigEditando(null)
    setPersonaId('')
    setCategoriaId('')
    setPorcentaje('')
    setRequerimientoId('')
    setPrioridad(false)
    setError('')
    setAviso('')
    setGuardando(false)
  }, [])

  const cerrar = useCallback(() => {
    setAbierto(false)
    reiniciar()
  }, [reiniciar])

  const abrirCrear = useCallback((opciones: OpcionesApertura = {}) => {
    if (!puedeEditar) return
    reiniciar()
    setRequerimientoId(opciones.requerimientoId ?? '')
    if (opciones.personaId) {
      setPersonaId(opciones.personaId)
      const resto = restoDe(opciones.personaId)
      setPorcentaje(resto > 0 ? formatearPct(resto) : '')
      setCategoriaId(categoriaHabitual(opciones.personaId))
    }
    setAbierto(true)
  }, [categoriaHabitual, puedeEditar, reiniciar, restoDe])

  const abrirEditar = useCallback((asig: AsignacionItem) => {
    if (!puedeEditar) return
    reiniciar()
    setAsigEditando(asig)
    setPersonaId(asig.persona_id)
    setCategoriaId(asig.categoria_id)
    setPorcentaje(formatearPct(asig.total_porcentaje))
    setRequerimientoId(reqIdDeAsignacion(asig) ?? '')
    setPrioridad(asig.prioridad === true)
    setAbierto(true)
  }, [puedeEditar, reiniciar])

  const cambiarPersona = useCallback((pid: string) => {
    setPersonaId(pid)
    setError('')
    setAviso('')
    if (!modoEdicion && pid) {
      const resto = restoDe(pid)
      setPorcentaje(resto > 0 ? formatearPct(resto) : '')
      if (!categoriaId) setCategoriaId(categoriaHabitual(pid))
    }
  }, [categoriaHabitual, categoriaId, modoEdicion, restoDe])

  const cambiarRequerimiento = useCallback((id: string) => {
    setRequerimientoId(id)
    setError('')
    setAviso('')
    // Si el requerimiento tiene un analista de requerimientos configurado y aún no se
    // eligió persona, se preselecciona ese analista (si sigue activo) con 0% de carga,
    // para dejarlo asignado de una vez mientras luego se le define el % real.
    if (!modoEdicion && !personaId && id) {
      const analistaId = requerimientoPorId.get(id)?.solicitud?.analista_requerimientos_id
      if (analistaId && personasDisponibles.some((p) => p.id === analistaId)) {
        setPersonaId(analistaId)
        setPorcentaje('0')
        if (!categoriaId) setCategoriaId(categoriaHabitual(analistaId))
      }
    }
  }, [categoriaHabitual, categoriaId, modoEdicion, personaId, personasDisponibles, requerimientoPorId])

  /** Tras "Crear y asignar otra": conserva requerimiento y categoría, pide persona y % de nuevo. */
  const prepararSiguiente = useCallback((mensaje: string) => {
    setPersonaId('')
    setPorcentaje('')
    setPrioridad(false)
    setError('')
    setAviso(mensaje)
    setGuardando(false)
  }, [])

  return {
    abierto,
    modoEdicion,
    asigEditando,
    personaId,
    categoriaId,
    setCategoriaId,
    porcentaje,
    setPorcentaje: (valor: string) => {
      setPorcentaje(valor)
      setError('')
    },
    requerimientoId,
    opcionReqSeleccionada,
    prioridad,
    setPrioridad,
    error,
    setError,
    aviso,
    guardando,
    setGuardando,
    restoDe,
    abrirCrear,
    abrirEditar,
    cerrar,
    cambiarPersona,
    cambiarRequerimiento,
    prepararSiguiente,
  }
}

export type PanelAsignarEstado = ReturnType<typeof usePanelAsignar>
