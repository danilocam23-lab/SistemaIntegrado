// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import client from '../../api/client'
import { mensajeError } from '../../api/hooks'
import type { PlanAccion } from '../../types'
import { ESTADO_LABEL, SEGUNDOS_DESHACER, cuerpoSoloEstado, siguienteEstado } from './tipos'
import type { FormPlan } from './tipos'

/** Aviso con cuenta atrás y "Deshacer" (cambio de estado o eliminación). */
export interface AvisoPlan {
  clave: string
  texto: string
  /** Marca de tiempo (ms) en que expira el aviso. */
  vence: number
  deshacer: () => void
}

interface EliminacionPendiente {
  plan: PlanAccion
  vence: number
}

interface Parametros {
  puedeEditar: boolean
  recargar: () => void
  /** Error visible en la pantalla (cambio de estado o eliminación fallidos). */
  alFallar: (mensaje: string) => void
}

/**
 * Escrituras de planes de acción:
 * - guardar (POST/PUT con el cuerpo completo, incluido el estado),
 * - cambio de estado en un clic con "Deshacer" (restaura el estado anterior),
 * - eliminación diferida: el plan se oculta y el DELETE se envía a los
 *   `SEGUNDOS_DESHACER` s. Si se cierra la pestaña antes, el plan reaparece;
 *   si se navega dentro de la app, se envía al salir.
 */
export function useEscriturasPlanes({ puedeEditar, recargar, alFallar }: Parametros) {
  const [pendientes, setPendientes] = useState<EliminacionPendiente[]>([])
  const [avisosEstado, setAvisosEstado] = useState<AvisoPlan[]>([])
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const temporizadores = useRef(new Map<string, number>())
  const enCurso = useRef(new Map<string, EliminacionPendiente>())
  const montado = useRef(true)
  const avisosTimers = useRef(new Set<number>())

  /** Devuelve el mensaje de error o null si se guardó. */
  const guardar = useCallback(async (form: FormPlan): Promise<string | null> => {
    if (!puedeEditar) return 'No tienes permiso para editar planes de acción.'
    const cuerpo = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      responsable_id: form.responsableId || null,
      fecha_limite: form.fechaLimite || null,
      estado: form.estado,
    }
    try {
      if (form.id) await client.put(`/planes-accion/${form.id}`, cuerpo)
      else await client.post('/planes-accion', cuerpo)
      recargar()
      return null
    } catch (err) {
      return mensajeError(err)
    }
  }, [puedeEditar, recargar])

  const marcarGuardando = useCallback((id: string, activo: boolean) => {
    if (!montado.current) return
    setGuardando((s) => {
      const n = new Set(s)
      if (activo) n.add(id)
      else n.delete(id)
      return n
    })
  }, [])

  const quitarAvisoEstado = useCallback((clave: string) => {
    if (!montado.current) return
    setAvisosEstado((l) => l.filter((a) => a.clave !== clave))
  }, [])

  const poner = useCallback(async (plan: PlanAccion, estado: string): Promise<boolean> => {
    marcarGuardando(plan.id, true)
    try {
      // Solo el estado: el PUT es parcial y no debe pisar ediciones hechas entretanto.
      await client.put(`/planes-accion/${plan.id}`, cuerpoSoloEstado(estado))
      if (montado.current) recargar()
      return true
    } catch (err) {
      if (montado.current) alFallar(`No se pudo cambiar el estado de «${plan.titulo}»: ${mensajeError(err)}`)
      return false
    } finally {
      marcarGuardando(plan.id, false)
    }
  }, [alFallar, marcarGuardando, recargar])

  const cambiarEstado = useCallback(async (plan: PlanAccion, nuevo?: string) => {
    if (!puedeEditar) return
    const destino = nuevo ?? siguienteEstado(plan.estado)
    const anterior = plan.estado
    if (destino === anterior) return
    if (!(await poner(plan, destino))) return
    const clave = `estado-${plan.id}-${Date.now()}`
    const aviso: AvisoPlan = {
      clave,
      texto: `«${plan.titulo}» pasó a ${ESTADO_LABEL[destino] ?? destino}`,
      vence: Date.now() + SEGUNDOS_DESHACER * 1000,
      deshacer: () => {
        quitarAvisoEstado(clave)
        void poner({ ...plan, estado: destino }, anterior)
      },
    }
    setAvisosEstado((l) => [...l.filter((a) => !a.clave.startsWith(`estado-${plan.id}-`)), aviso])
    const t = window.setTimeout(() => {
      avisosTimers.current.delete(t)
      quitarAvisoEstado(clave)
    }, SEGUNDOS_DESHACER * 1000)
    avisosTimers.current.add(t)
  }, [poner, puedeEditar, quitarAvisoEstado])

  const enviarEliminacion = useCallback(async (pendiente: EliminacionPendiente, trasEnvio: boolean) => {
    const { plan } = pendiente
    temporizadores.current.delete(plan.id)
    enCurso.current.delete(plan.id)
    try {
      await client.delete(`/planes-accion/${plan.id}`)
    } catch (err) {
      // Si se salió de la pantalla no hay dónde mostrarlo.
      if (montado.current) alFallar(`No se pudo eliminar «${plan.titulo}»: ${mensajeError(err)}`)
    } finally {
      if (trasEnvio && montado.current) {
        recargar()
        setPendientes((l) => l.filter((p) => p.plan.id !== plan.id))
      }
    }
  }, [alFallar, recargar])

  const eliminar = useCallback((plan: PlanAccion) => {
    if (!puedeEditar || temporizadores.current.has(plan.id)) return
    const pendiente: EliminacionPendiente = { plan, vence: Date.now() + SEGUNDOS_DESHACER * 1000 }
    enCurso.current.set(plan.id, pendiente)
    setPendientes((l) => [...l, pendiente])
    temporizadores.current.set(
      plan.id,
      window.setTimeout(() => void enviarEliminacion(pendiente, true), SEGUNDOS_DESHACER * 1000),
    )
  }, [enviarEliminacion, puedeEditar])

  const deshacerEliminacion = useCallback((id: string) => {
    const t = temporizadores.current.get(id)
    if (t !== undefined) window.clearTimeout(t)
    temporizadores.current.delete(id)
    enCurso.current.delete(id)
    setPendientes((l) => l.filter((p) => p.plan.id !== id))
  }, [])

  // Al salir de la pantalla se envían las eliminaciones pendientes.
  const enviarRef = useRef(enviarEliminacion)
  useEffect(() => {
    enviarRef.current = enviarEliminacion
  }, [enviarEliminacion])
  useEffect(() => {
    const ts = temporizadores.current
    const ec = enCurso.current
    const av = avisosTimers.current
    montado.current = true
    return () => {
      montado.current = false
      av.forEach((t) => window.clearTimeout(t))
      av.clear()
      for (const [id, t] of ts) {
        window.clearTimeout(t)
        const p = ec.get(id)
        if (p) void enviarRef.current(p, false)
      }
      ts.clear()
    }
  }, [])

  const ocultos = useMemo(() => new Set(pendientes.map((p) => p.plan.id)), [pendientes])

  const avisos = useMemo<AvisoPlan[]>(() => [
    ...pendientes.map((p) => ({
      clave: `eliminar-${p.plan.id}`,
      texto: `Plan «${p.plan.titulo}» eliminado`,
      vence: p.vence,
      deshacer: () => deshacerEliminacion(p.plan.id),
    })),
    ...avisosEstado,
  ], [pendientes, avisosEstado, deshacerEliminacion])

  return { guardar, cambiarEstado, eliminar, avisos, ocultos, guardando }
}
