// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useMemo } from 'react'
import type { Persona, PlanAccion } from '../../types'
import { diasHasta } from './fechas'
import { ESTADOS, ROLES_RESPONSABLE, SIN_RESPONSABLE, esAbierto } from './tipos'
import type { FiltrosPlanes } from './tipos'

export interface PlanConVencimiento {
  plan: PlanAccion
  /** Días hasta la fecha límite (negativo = pasó); null si no hay fecha. */
  dias: number | null
  /** Abierto (Pendiente/En progreso) con fecha pasada. */
  vencido: boolean
  /** Abierto con fecha entre hoy y 7 días. */
  proximo: boolean
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * Derivados de la lista: vencimiento, contadores, filtros y orden. Calculado
 * en el navegador con la fecha local de `hoy`.
 */
export function useDerivadosPlanes(
  planes: PlanAccion[],
  personas: Persona[],
  filtros: FiltrosPlanes,
  hoy: Date,
) {
  const personasPorId = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])

  /** Para ASIGNAR: solo activos con rol LT_HITSS / SCRUM. */
  const responsablesAsignables = useMemo(
    () => personas
      .filter((p) => p.activo && ROLES_RESPONSABLE.includes(p.rol_operativo))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [personas],
  )

  const todos = useMemo<PlanConVencimiento[]>(() => planes.map((plan) => {
    const dias = diasHasta(plan.fecha_limite, hoy)
    const abierto = esAbierto(plan.estado)
    return {
      plan,
      dias,
      vencido: abierto && dias !== null && dias < 0,
      proximo: abierto && dias !== null && dias >= 0 && dias <= 7,
    }
  }), [planes, hoy])

  /** Responsables que aparecen en los planes (para el filtro), con nombre de la lista completa. */
  const responsablesEnPlanes = useMemo(() => {
    const ids = new Set(planes.map((p) => p.responsable_id).filter((id): id is string => !!id))
    return [...ids]
      .map((id) => ({ id, nombre: personasPorId.get(id)?.nombre ?? 'Responsable no encontrado' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [planes, personasPorId])

  const kpis = useMemo(() => {
    const abiertos = todos.filter((t) => esAbierto(t.plan.estado)).length
    const enProgreso = todos.filter((t) => t.plan.estado === 'EN_PROGRESO').length
    const vencidos = todos.filter((t) => t.vencido)
    const completados = todos.filter((t) => t.plan.estado === 'COMPLETADO').length
    const validos = todos.filter((t) => t.plan.estado !== 'CANCELADO').length
    return {
      total: todos.length,
      abiertos,
      enProgreso,
      vencidos,
      completados,
      validos,
      porcentajeCompletado: validos ? Math.round((completados / validos) * 100) : 0,
    }
  }, [todos])

  const filtrados = useMemo(() => {
    const q = normalizar(filtros.busqueda.trim())
    const lista = todos.filter((t) => {
      if (filtros.estado && t.plan.estado !== filtros.estado) return false
      if (filtros.vencimiento === 'vencidos' && !t.vencido) return false
      if (filtros.vencimiento === 'semana' && !t.proximo) return false
      if (filtros.vencimiento === 'sin_fecha' && t.dias !== null) return false
      if (filtros.responsable === SIN_RESPONSABLE && t.plan.responsable_id) return false
      if (filtros.responsable && filtros.responsable !== SIN_RESPONSABLE
        && t.plan.responsable_id !== filtros.responsable) return false
      if (q && !normalizar(`${t.plan.titulo} ${t.plan.descripcion ?? ''}`).includes(q)) return false
      return true
    })
    if (filtros.orden === 'fecha') {
      return lista.slice().sort((a, b) => {
        if (a.dias === null && b.dias === null) return 0
        if (a.dias === null) return 1
        if (b.dias === null) return -1
        return a.dias - b.dias
      })
    }
    return lista
  }, [todos, filtros])

  /** Contador por estado (sobre todos los planes) para los segmentos de estado. */
  const contadoresEstado = useMemo(() => {
    const m: Record<string, number> = {}
    ESTADOS.forEach((e) => { m[e] = todos.filter((t) => t.plan.estado === e).length })
    return m
  }, [todos])

  return { personasPorId, responsablesAsignables, responsablesEnPlanes, todos, kpis, filtrados, contadoresEstado }
}
