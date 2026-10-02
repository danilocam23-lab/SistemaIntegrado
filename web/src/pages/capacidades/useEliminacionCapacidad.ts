// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { CapacidadFila } from './tipos'

/** Segundos que dura el "Deshacer" antes de enviar el DELETE al servidor. */
export const SEGUNDOS_DESHACER = 8

export interface EliminacionCapacidadPendiente {
  registro: CapacidadFila
  /** Texto del aviso ("Ana Gómez · Octubre 2026"). */
  descripcion: string
  /** Marca de tiempo (ms) en que se enviará el DELETE. */
  vence: number
}

interface Parametros {
  puedeEditar: boolean
  recargar: () => void
  /** Se llama con el mensaje cuando el DELETE falla (el registro reaparece). */
  alFallar: (mensaje: string) => void
}

/**
 * Eliminación con "Deshacer": el registro se oculta al instante y el DELETE se
 * envía pasados `SEGUNDOS_DESHACER` segundos. Si el servidor rechaza, el
 * registro reaparece y se avisa. Al salir de la pantalla se envían las
 * pendientes (la intención ya estaba clara); si se cierra la pestaña, no se
 * envían y el registro sigue ahí.
 */
export function useEliminacionCapacidad({ puedeEditar, recargar, alFallar }: Parametros) {
  const [pendientes, setPendientes] = useState<EliminacionCapacidadPendiente[]>([])
  const temporizadores = useRef(new Map<string, number>())
  const enCurso = useRef(new Map<string, EliminacionCapacidadPendiente>())

  const enviar = useCallback(async (pendiente: EliminacionCapacidadPendiente, trasEnvio: boolean) => {
    const { registro } = pendiente
    temporizadores.current.delete(registro.id)
    enCurso.current.delete(registro.id)
    try {
      await client.delete(`/capacidades/${registro.id}`)
    } catch (err) {
      alFallar(`No se pudo eliminar (${pendiente.descripcion}): ${mensajeError(err)}`)
    } finally {
      if (trasEnvio) {
        recargar()
        setPendientes((lista) => lista.filter((p) => p.registro.id !== registro.id))
      }
    }
  }, [alFallar, recargar])

  const eliminar = useCallback((registro: CapacidadFila, descripcion: string) => {
    if (!puedeEditar || temporizadores.current.has(registro.id)) return
    const pendiente: EliminacionCapacidadPendiente = {
      registro, descripcion, vence: Date.now() + SEGUNDOS_DESHACER * 1000,
    }
    enCurso.current.set(registro.id, pendiente)
    setPendientes((lista) => [...lista, pendiente])
    temporizadores.current.set(
      registro.id,
      window.setTimeout(() => void enviar(pendiente, true), SEGUNDOS_DESHACER * 1000),
    )
  }, [enviar, puedeEditar])

  const deshacer = useCallback((registroId: string) => {
    const temporizador = temporizadores.current.get(registroId)
    if (temporizador !== undefined) window.clearTimeout(temporizador)
    temporizadores.current.delete(registroId)
    enCurso.current.delete(registroId)
    setPendientes((lista) => lista.filter((p) => p.registro.id !== registroId))
  }, [])

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

  const ocultos = useMemo(() => new Set(pendientes.map((p) => p.registro.id)), [pendientes])

  return { pendientes, ocultos, eliminar, deshacer }
}
