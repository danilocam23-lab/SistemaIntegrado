// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useState } from 'react'
import type { KeyboardEvent } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Requerimiento } from '../../types'
import { cabecerasAplicacion } from '../../utilidades/aplicacion'
import { resolverAppAsignacion } from './resolverApp'
import type { AsignacionItem } from './tipos'
import type { FilaReparto } from './useDerivadosAsignaciones'

interface ParametrosEscrituras {
  requerimientoPorId: Map<string, Requerimiento>
  capacidadUsada: (paraPersonaId: string, excluyendoId?: string) => number
  asignacionExistente: (pid: string, reqId: string, excluyendoId?: string) => AsignacionItem | null
  activa: string
  puedeEditar: boolean
  recargar: () => Promise<void> | void
  /** Registra (o limpia con `''`) el mensaje de error de una fila: se muestra en la propia fila/panel. */
  registrarErrorFila: (asigId: string, mensaje: string) => void
}

/** Datos del panel "Asignar" listos para enviar. */
export interface DatosAsignacion {
  personaId: string
  categoriaId: string
  porcentaje: number
  requerimientoId: string
  etiquetaRequerimiento: string
  /** Aplicación de creación ya resuelta por el panel (`''` en modo consolidado sin requerimiento). */
  aplicacionId: string
  prioridad: boolean
}

export interface FalloReparto {
  asigId: string
  mensaje: string
}

/**
 * Mensaje de validación del tope de capacidad (solo cuenta requerimientos
 * activos, igual que siempre); `null` si cabe.
 */
export function mensajeCapacidad(usado: number, nuevoPct: number): string | null {
  if (usado + nuevoPct > 100) {
    return `La persona ya tiene ${usado}% asignado en requerimientos activos. Agregar ${nuevoPct}% superaría el 100%.`
  }
  return null
}

/**
 * Escrituras de asignaciones: alta/edición desde el panel, edición del % en
 * línea, prioridad y aplicación explícita de un reparto. NO hay reparto
 * automático ni corrección al montar: todo cambio de otras asignaciones pasa por
 * `aplicarReparto`, que el usuario confirma con vista previa.
 *
 * Los errores del servidor (422/404/409 con `detail`) se devuelven como texto o
 * se asocian a la fila para mostrarlos donde corresponde (no arriba de la página).
 */
export function useEscriturasAsignaciones({
  requerimientoPorId,
  capacidadUsada,
  asignacionExistente,
  activa,
  puedeEditar,
  recargar,
  registrarErrorFila,
}: ParametrosEscrituras) {
  // INVARIANTE: la edición en línea y el panel nunca coexisten (la página cancela
  // la edición en línea antes de abrir el panel).
  const [edicionInlineId, setEdicionInlineId] = useState<string | null>(null)
  const [edicionInlineValor, setEdicionInlineValor] = useState('')

  const appDe = useCallback(
    (asig: AsignacionItem) => resolverAppAsignacion(asig, requerimientoPorId, activa),
    [activa, requerimientoPorId],
  )

  const cuerpoActualizacion = (asig: AsignacionItem, cambios: Partial<{
    persona_id: string
    categoria_id: string
    total_porcentaje: number
    proyectos: AsignacionItem['proyectos']
  }>) => ({
    persona_id: asig.persona_id,
    categoria_id: asig.categoria_id,
    total_porcentaje: asig.total_porcentaje,
    estado: asig.estado ?? 'active',
    activo: asig.activo ?? true,
    prioridad: asig.prioridad === true,
    proyectos: asig.proyectos,
    ...cambios,
  })

  /** Alta. Devuelve el mensaje de error o `null` si se creó. */
  const crear = useCallback(async (datos: DatosAsignacion): Promise<string | null> => {
    if (!puedeEditar) return 'No tienes permiso para crear asignaciones.'
    if (!Number.isFinite(datos.porcentaje) || datos.porcentaje < 0 || datos.porcentaje > 100) {
      return 'El % de carga debe estar entre 0 y 100.'
    }
    const errorCapacidad = mensajeCapacidad(capacidadUsada(datos.personaId), datos.porcentaje)
    if (errorCapacidad) return errorCapacidad

    if (datos.requerimientoId && asignacionExistente(datos.personaId, datos.requerimientoId)) {
      return 'Esta persona ya tiene una asignación para ese requerimiento'
    }
    if (!datos.aplicacionId) {
      return 'En modo consolidado debes seleccionar primero un requerimiento para crear la asignación.'
    }

    try {
      const respuesta = await client.post<{ id?: string }>(
        '/asignaciones',
        {
          persona_id: datos.personaId,
          categoria_id: datos.categoriaId,
          total_porcentaje: datos.porcentaje,
          estado: 'active',
          activo: true,
          proyectos: datos.requerimientoId
            ? [{ nombre: datos.etiquetaRequerimiento, estado: 'active', requerimiento_id: datos.requerimientoId }]
            : [],
        },
        cabecerasAplicacion(datos.aplicacionId),
      )
      const nuevoId = respuesta.data?.id
      if (datos.prioridad && nuevoId) {
        try {
          await client.patch(`/asignaciones/${nuevoId}/prioridad`, {}, cabecerasAplicacion(datos.aplicacionId))
        } catch (err) {
          registrarErrorFila(nuevoId, `Se creó, pero no se pudo marcar como prioridad: ${mensajeError(err)}`)
        }
      }
      await recargar()
      return null
    } catch (err) {
      return mensajeError(err)
    }
  }, [asignacionExistente, capacidadUsada, puedeEditar, recargar, registrarErrorFila])

  /** Edición desde el panel. Devuelve el mensaje de error o `null` si se guardó. */
  const actualizar = useCallback(async (asig: AsignacionItem, datos: DatosAsignacion): Promise<string | null> => {
    if (!puedeEditar) return 'No tienes permiso para editar asignaciones.'
    if (!Number.isFinite(datos.porcentaje) || datos.porcentaje < 0 || datos.porcentaje > 100) {
      return 'El % de carga debe estar entre 0 y 100.'
    }
    const errorCapacidad = mensajeCapacidad(capacidadUsada(datos.personaId, asig.id), datos.porcentaje)
    if (errorCapacidad) return errorCapacidad

    const reqOriginal = asig.proyectos.find((p) => p.requerimiento_id)?.requerimiento_id ?? ''
    if (datos.requerimientoId && asignacionExistente(datos.personaId, datos.requerimientoId, asig.id)) {
      return 'Esta persona ya tiene una asignación para ese requerimiento'
    }

    const aplicacionId = appDe(asig)
    if (!aplicacionId) return 'No fue posible determinar la aplicación de la asignación.'

    // Si el requerimiento no cambió se conservan los proyectos tal cual.
    const proyectos = datos.requerimientoId === reqOriginal
      ? asig.proyectos
      : datos.requerimientoId
        ? [{ nombre: datos.etiquetaRequerimiento, estado: 'active', requerimiento_id: datos.requerimientoId }]
        : []

    try {
      await client.put(
        `/asignaciones/${asig.id}`,
        cuerpoActualizacion(asig, {
          persona_id: datos.personaId,
          categoria_id: datos.categoriaId,
          total_porcentaje: datos.porcentaje,
          proyectos: proyectos as AsignacionItem['proyectos'],
        }),
        cabecerasAplicacion(aplicacionId),
      )
      if (datos.prioridad !== (asig.prioridad === true)) {
        try {
          await client.patch(`/asignaciones/${asig.id}/prioridad`, {}, cabecerasAplicacion(aplicacionId))
        } catch (err) {
          registrarErrorFila(asig.id, `Se guardó, pero no se pudo cambiar la prioridad: ${mensajeError(err)}`)
        }
      }
      await recargar()
      return null
    } catch (err) {
      return mensajeError(err)
    }
  }, [appDe, asignacionExistente, capacidadUsada, puedeEditar, recargar, registrarErrorFila])

  const iniciarEdicionInline = useCallback((asig: AsignacionItem) => {
    if (!puedeEditar) return
    registrarErrorFila(asig.id, '')
    setEdicionInlineId(asig.id)
    setEdicionInlineValor(String(asig.total_porcentaje))
  }, [puedeEditar, registrarErrorFila])

  const cancelarEdicionInline = useCallback(() => {
    setEdicionInlineId(null)
    setEdicionInlineValor('')
  }, [])

  const guardarEdicionInline = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditar) return
    if (edicionInlineId !== asig.id) return

    registrarErrorFila(asig.id, '')
    const nuevoPct = edicionInlineValor === '' ? 0 : Number(edicionInlineValor)
    if (!Number.isFinite(nuevoPct) || nuevoPct < 0 || nuevoPct > 100) {
      registrarErrorFila(asig.id, 'El % de carga debe estar entre 0 y 100.')
      return
    }
    if (nuevoPct === asig.total_porcentaje) {
      cancelarEdicionInline()
      return
    }
    const errorCapacidad = mensajeCapacidad(capacidadUsada(asig.persona_id, asig.id), nuevoPct)
    if (errorCapacidad) {
      registrarErrorFila(asig.id, errorCapacidad)
      return
    }

    const aplicacionId = appDe(asig)
    if (!aplicacionId) {
      registrarErrorFila(asig.id, 'No fue posible determinar la aplicación de la asignación.')
      return
    }

    try {
      await client.put(
        `/asignaciones/${asig.id}`,
        cuerpoActualizacion(asig, { total_porcentaje: nuevoPct }),
        cabecerasAplicacion(aplicacionId),
      )
      cancelarEdicionInline()
      await recargar()
    } catch (err) {
      registrarErrorFila(asig.id, mensajeError(err))
    }
  }, [appDe, cancelarEdicionInline, capacidadUsada, edicionInlineId, edicionInlineValor, puedeEditar, recargar, registrarErrorFila])

  const cambiarPrioridad = useCallback(async (asig: AsignacionItem) => {
    if (!puedeEditar) return
    const aplicacionId = appDe(asig)
    if (!aplicacionId) return
    registrarErrorFila(asig.id, '')
    try {
      await client.patch(`/asignaciones/${asig.id}/prioridad`, {}, cabecerasAplicacion(aplicacionId))
      await recargar()
    } catch (err) {
      registrarErrorFila(asig.id, mensajeError(err))
    }
  }, [appDe, puedeEditar, recargar, registrarErrorFila])

  /**
   * Aplica un reparto propuesto (ya mostrado con vista previa y confirmado por
   * el usuario). Devuelve los fallos por fila; las que sí se guardaron quedan.
   */
  const aplicarReparto = useCallback(async (filas: FilaReparto[]): Promise<FalloReparto[]> => {
    if (!puedeEditar) return [{ asigId: '', mensaje: 'No tienes permiso para editar asignaciones.' }]
    const cambios = filas.filter((f) => f.pctNuevo !== f.pctActual)
    const resultados = await Promise.allSettled(
      cambios.map((f) =>
        client.put(
          `/asignaciones/${f.asig.id}`,
          cuerpoActualizacion(f.asig, { total_porcentaje: f.pctNuevo }),
          cabecerasAplicacion(appDe(f.asig)),
        ),
      ),
    )
    const fallos: FalloReparto[] = []
    resultados.forEach((resultado, i) => {
      if (resultado.status === 'rejected') {
        fallos.push({ asigId: cambios[i].asig.id, mensaje: mensajeError(resultado.reason) })
      }
    })
    await recargar()
    return fallos
  }, [appDe, puedeEditar, recargar])

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
    cambiarPrioridad,
    aplicarReparto,
    edicionInlineId,
    edicionInlineValor,
    setEdicionInlineValor,
    iniciarEdicionInline,
    cancelarEdicionInline,
    guardarEdicionInline,
    onInlineKeyDown,
  }
}
