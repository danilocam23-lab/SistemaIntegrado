// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { Requerimiento } from '../../types'
import { cabecerasAplicacion } from '../../utilidades/aplicacion'
import { resolverAppAsignacion } from './resolverApp'
import type { AsignacionItem } from './tipos'

/** Segundos que dura el "Deshacer" antes de enviar el DELETE al servidor. */
export const SEGUNDOS_DESHACER = 8

export interface EliminacionPendiente {
  asig: AsignacionItem
  /** Texto para el aviso ("Danilo en MT-GTI-0548"). */
  descripcion: string
  /** Marca de tiempo (ms) en que se enviará el DELETE. */
  vence: number
}

interface Parametros {
  requerimientoPorId: Map<string, Requerimiento>
  activa: string
  puedeEditar: boolean
  recargar: () => Promise<void> | void
  registrarErrorFila: (asigId: string, mensaje: string) => void
}

/**
 * Eliminación con "Deshacer": la asignación se oculta al instante y el DELETE se
 * envía al servidor pasados `SEGUNDOS_DESHACER` segundos. Reemplaza el
 * `window.confirm`. Si el usuario recarga o cierra la pestaña a mitad, el
 * DELETE no se envía y la asignación reaparece (falla en el lado seguro). Si
 * navega a otra pantalla dentro de la app, las pendientes se envían al salir.
 */
export function useEliminacionDiferida({
  requerimientoPorId,
  activa,
  puedeEditar,
  recargar,
  registrarErrorFila,
}: Parametros) {
  const [pendientes, setPendientes] = useState<EliminacionPendiente[]>([])
  const temporizadores = useRef(new Map<string, number>())
  const enCurso = useRef(new Map<string, EliminacionPendiente>())

  const enviar = useCallback(async (pendiente: EliminacionPendiente, trasEnvio: boolean) => {
    const { asig } = pendiente
    temporizadores.current.delete(asig.id)
    enCurso.current.delete(asig.id)
    try {
      await client.delete(
        `/asignaciones/${asig.id}`,
        cabecerasAplicacion(resolverAppAsignacion(asig, requerimientoPorId, activa)),
      )
      if (trasEnvio) await recargar()
    } catch (err) {
      registrarErrorFila(asig.id, `No se pudo eliminar: ${mensajeError(err)}`)
    } finally {
      if (trasEnvio) setPendientes((lista) => lista.filter((p) => p.asig.id !== asig.id))
    }
  }, [activa, recargar, registrarErrorFila, requerimientoPorId])

  const eliminar = useCallback((asig: AsignacionItem, descripcion: string) => {
    if (!puedeEditar) return
    if (temporizadores.current.has(asig.id)) return
    registrarErrorFila(asig.id, '')
    const pendiente: EliminacionPendiente = { asig, descripcion, vence: Date.now() + SEGUNDOS_DESHACER * 1000 }
    enCurso.current.set(asig.id, pendiente)
    setPendientes((lista) => [...lista, pendiente])
    temporizadores.current.set(
      asig.id,
      window.setTimeout(() => void enviar(pendiente, true), SEGUNDOS_DESHACER * 1000),
    )
  }, [enviar, puedeEditar, registrarErrorFila])

  const deshacer = useCallback((asigId: string) => {
    const temporizador = temporizadores.current.get(asigId)
    if (temporizador !== undefined) window.clearTimeout(temporizador)
    temporizadores.current.delete(asigId)
    enCurso.current.delete(asigId)
    setPendientes((lista) => lista.filter((p) => p.asig.id !== asigId))
  }, [])

  // Al salir de la pantalla se envían las eliminaciones pendientes (la intención
  // del usuario ya estaba clara). `enviar` se lee por ref para no reenviar al
  // cambiar de identidad.
  const enviarRef = useRef(enviar)
  useEffect(() => {
    enviarRef.current = enviar
  }, [enviar])
  useEffect(() => {
    const temporizadoresActuales = temporizadores.current
    const enCursoActual = enCurso.current
    return () => {
      for (const [id, temporizador] of temporizadoresActuales) {
        window.clearTimeout(temporizador)
        const pendiente = enCursoActual.get(id)
        if (pendiente) void enviarRef.current(pendiente, false)
      }
      temporizadoresActuales.clear()
    }
  }, [])

  return { pendientes, eliminar, deshacer }
}
