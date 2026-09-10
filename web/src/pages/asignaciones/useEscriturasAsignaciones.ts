import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Requerimiento } from '../../types'
import { cabecerasAplicacion } from '../../utilidades/aplicacion'
import type { AsignacionItem } from './tipos'
import type { useFormularioAsignacion } from './useFormularioAsignacion'

interface ParametrosEscrituras {
  asignaciones: AsignacionItem[]
  requerimientos: Requerimiento[]
  reqIdsActivos: Set<string>
  capacidadUsada: (paraPersonaId: string, excluyendoId?: string) => number
  activa: string
  puedeEditar: boolean
  setAviso: (mensaje: string) => void
  recargar: () => Promise<void> | void
  formulario: ReturnType<typeof useFormularioAsignacion>
  etiquetaReq: (reqId: string | null) => string
}

/**
 * Todas las escrituras de asignaciones: validación de capacidad, redistribución
 * equitativa del %, autofix al cargar si alguien supera el 100% (una sola vez
 * por montaje), CRUD por formulario y edición del % en línea.
 */
export function useEscriturasAsignaciones({
  asignaciones,
  requerimientos,
  reqIdsActivos,
  capacidadUsada,
  activa,
  puedeEditar,
  setAviso,
  recargar,
  formulario,
  etiquetaReq,
}: ParametrosEscrituras) {
  const {
    personaId,
    categoriaId,
    porcentaje,
    requerimientoId,
    opcionReqSeleccionada,
    editandoAsig,
    resolverAppCreacion,
    limpiarFormulario,
  } = formulario

  const [edicionInlineId, setEdicionInlineId] = useState<string | null>(null)
  const [edicionInlineValor, setEdicionInlineValor] = useState('')
  const autoFixedRef = useRef(false)

  const resolverAppAsignacion = useCallback((asig: AsignacionItem) => {
    if (asig.aplicacion_id) return asig.aplicacion_id
    const reqId = asig.proyectos.find((p) => p.requerimiento_id)?.requerimiento_id
    const req = reqId ? requerimientos.find((item) => item.id === reqId) : null
    return req?.aplicacion_id ?? activa
  }, [activa, requerimientos])

  const validarCapacidad = useCallback((pid: string, nuevoPct: number, excluyendoId?: string) => {
    const usado = capacidadUsada(pid, excluyendoId)
    if (usado + nuevoPct > 100) {
      setAviso(`La persona ya tiene ${usado}% asignado en requerimientos activos. Agregar ${nuevoPct}% superaría el 100%.`)
      return false
    }
    return true
  }, [capacidadUsada])

  /** Actualiza el % de todas las asignaciones activas de una persona a distribución equitativa */
  const redistribuirPct = useCallback(async (pid: string, excluyendoId?: string) => {
    const activas = asignaciones.filter((a) =>
      a.persona_id === pid &&
      a.id !== excluyendoId &&
      a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id)),
    )
    if (activas.length === 0) return
    const pct = Math.round(100 / activas.length)
    await Promise.allSettled(
      activas.map((a) =>
        client.put(
          `/asignaciones/${a.id}`,
          { persona_id: a.persona_id, categoria_id: a.categoria_id, total_porcentaje: pct,
            estado: a.estado ?? 'active', activo: a.activo ?? true, proyectos: a.proyectos },
          cabecerasAplicacion(resolverAppAsignacion(a)),
        )
      ),
    )
  }, [asignaciones, reqIdsActivos, resolverAppAsignacion])

  // Al cargar, auto-corrige si alguna persona supera el 100%
  useEffect(() => {
    if (autoFixedRef.current || asignaciones.length === 0 || reqIdsActivos.size === 0) return
    const totalesPorPersona = new Map<string, number>()
    for (const a of asignaciones) {
      if (a.proyectos.some((p) => p.requerimiento_id && reqIdsActivos.has(p.requerimiento_id))) {
        totalesPorPersona.set(a.persona_id, (totalesPorPersona.get(a.persona_id) ?? 0) + a.total_porcentaje)
      }
    }
    const conExceso = [...totalesPorPersona.entries()]
      .filter(([, total]) => Math.round(total) > 100)
      .map(([pid]) => pid)
    autoFixedRef.current = true
    if (conExceso.length > 0) {
      Promise.allSettled(conExceso.map((pid) => redistribuirPct(pid)))
        .then(() => recargar())
        .catch(() => {})
    }
  }, [asignaciones, reqIdsActivos, redistribuirPct, recargar])

  const crear = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!puedeEditar) return
    setAviso('')

    const nuevoPct = porcentaje ? Number(porcentaje) : 0
    if (!validarCapacidad(personaId, nuevoPct)) return

    const duplicado = requerimientoId && asignaciones.some((a) =>
      a.persona_id === personaId &&
      a.proyectos.some((p) => p.requerimiento_id === requerimientoId),
    )
    if (duplicado) {
      setAviso('Esta persona ya tiene una asignación para ese requerimiento')
      return
    }

    const aplicacionId = resolverAppCreacion()
    if (!aplicacionId) {
      setAviso('En modo consolidado debes seleccionar primero un requerimiento para crear la asignación.')
      return
    }

    try {
      // Usar el porcentaje ingresado por el usuario
      await client.post(
        '/asignaciones',
        {
          persona_id: personaId,
          categoria_id: categoriaId,
          total_porcentaje: nuevoPct,
          estado: 'active',
          activo: true,
          proyectos: requerimientoId
            ? [{ nombre: opcionReqSeleccionada?.label ?? '', estado: 'active', requerimiento_id: requerimientoId }]
            : [],
        },
        cabecerasAplicacion(aplicacionId),
      )
      limpiarFormulario()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [asignaciones, categoriaId, limpiarFormulario, opcionReqSeleccionada, personaId, porcentaje, puedeEditar, recargar, requerimientoId, reqIdsActivos, redistribuirPct, resolverAppCreacion, validarCapacidad])

  const actualizar = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!puedeEditar) return
    if (!editandoAsig) return
    setAviso('')

    const nuevoPct = porcentaje ? Number(porcentaje) : 0
    if (!validarCapacidad(personaId, nuevoPct, editandoAsig.id)) return

    const aplicacionId = resolverAppAsignacion(editandoAsig)
    if (!aplicacionId) {
      setAviso('No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.put(
        `/asignaciones/${editandoAsig.id}`,
        {
          persona_id: personaId,
          categoria_id: categoriaId,
          total_porcentaje: nuevoPct,
          estado: editandoAsig.estado ?? 'active',
          activo: editandoAsig.activo ?? true,
          proyectos: requerimientoId
            ? [{ nombre: opcionReqSeleccionada?.label ?? etiquetaReq(requerimientoId), estado: 'active', requerimiento_id: requerimientoId }]
            : [],
        },
        cabecerasAplicacion(aplicacionId),
      )
      limpiarFormulario()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [categoriaId, editandoAsig, etiquetaReq, limpiarFormulario, opcionReqSeleccionada, personaId, porcentaje, puedeEditar, recargar, requerimientoId, resolverAppAsignacion, validarCapacidad])

  const eliminar = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditar) return
    if (!window.confirm('¿Eliminar esta asignación?')) return
    setAviso('')

    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) {
      setAviso('No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.delete(`/asignaciones/${asig.id}`, cabecerasAplicacion(aplicacionId))
      if (editandoAsig?.id === asig.id) limpiarFormulario()
      // Redistribuir % entre las asignaciones restantes
      await redistribuirPct(asig.persona_id, asig.id)
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [editandoAsig?.id, limpiarFormulario, puedeEditar, recargar, redistribuirPct, resolverAppAsignacion])

  const iniciarEdicionInline = useCallback((asig: AsignacionItem) => {
    if (!puedeEditar) return
    setAviso('')
    setEdicionInlineId(asig.id)
    setEdicionInlineValor(String(asig.total_porcentaje))
  }, [puedeEditar])

  const cancelarEdicionInline = useCallback(() => {
    setEdicionInlineId(null)
    setEdicionInlineValor('')
  }, [])

  const guardarEdicionInline = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditar) return
    if (edicionInlineId !== asig.id) return

    const nuevoPct = edicionInlineValor ? Number(edicionInlineValor) : 0
    setAviso('')
    if (!validarCapacidad(asig.persona_id, nuevoPct, asig.id)) return

    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) {
      setAviso('No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.put(
        `/asignaciones/${asig.id}`,
        {
          persona_id: asig.persona_id,
          categoria_id: asig.categoria_id,
          total_porcentaje: nuevoPct,
          estado: asig.estado ?? 'active',
          activo: asig.activo ?? true,
          proyectos: asig.proyectos,
        },
        cabecerasAplicacion(aplicacionId),
      )
      cancelarEdicionInline()
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [cancelarEdicionInline, edicionInlineId, edicionInlineValor, puedeEditar, recargar, resolverAppAsignacion, validarCapacidad])

  const cambiarPrioridad = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditar) return
    const aplicacionId = resolverAppAsignacion(asig)
    if (!aplicacionId) return
    try {
      await client.patch(`/asignaciones/${asig.id}/prioridad`, {}, cabecerasAplicacion(aplicacionId))
      await recargar()
    } catch (err) {
      setAviso(mensajeError(err))
    }
  }, [puedeEditar, recargar, resolverAppAsignacion])

  const onInlineKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
    if (event.key === 'Escape') cancelarEdicionInline()
  }, [cancelarEdicionInline])

  return {
    crear,
    actualizar,
    eliminar,
    cambiarPrioridad,
    edicionInlineId,
    edicionInlineValor,
    setEdicionInlineValor,
    iniciarEdicionInline,
    cancelarEdicionInline,
    guardarEdicionInline,
    onInlineKeyDown,
  }
}
