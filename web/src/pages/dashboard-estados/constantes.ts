// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { COLOR_GRAFICA } from '../../components/ui/graficas'
import type { DefinicionFase } from './tipos'

/** Color neutro para desvíos / posentrega y "Otros estados". */
const COLOR_NEUTRO = '#94a3b8' // slate-400

/**
 * Mapa de estados de requerimiento a fases del ciclo de vida (aprobado por el usuario).
 * Un estado que no esté aquí cae en la fase "Otros estados". Si se renombra un estado en
 * Configuración, actualizar esta constante.
 */
export const FASES_REQUERIMIENTO: DefinicionFase[] = [
  {
    id: 'estimacion',
    nombre: 'Estimación',
    subtitulo: 'HITSS → EPM → LT',
    flujo: true,
    acento: 'border-t-amber-500',
    color: COLOR_GRAFICA.alerta,
    estados: [
      'ESTIMACION EN CURSO POR HITSS',
      'ESTIMACION EN ESPERA DE APROBACION POR EPM',
      'ESTIMACION APROBADA POR LT',
    ],
  },
  {
    id: 'ejecucion',
    nombre: 'Ejecución',
    subtitulo: 'entregas y cambios',
    flujo: true,
    acento: 'border-t-marca-600',
    color: COLOR_GRAFICA.serie,
    estados: ['ESTIMACION APROBADA ENTREGA PENDIENTE', 'CONTROL DE CAMBIOS'],
  },
  {
    id: 'cierre',
    nombre: 'Cierre',
    subtitulo: 'entregado y cerrado',
    flujo: false,
    acento: 'border-t-green-600',
    color: COLOR_GRAFICA.ok,
    estados: ['REQUERIMIENTO ENTREGADO', 'REQUERIMIENTO CERRADO'],
  },
  {
    id: 'desvios',
    nombre: 'Desvíos',
    subtitulo: 'salen del flujo',
    flujo: false,
    acento: 'border-t-slate-400',
    color: COLOR_NEUTRO,
    estados: [
      'ESTIMACION RECHAZADA',
      'REQUERIMIENTO DEVUELTO A EPM',
      'REQUERIMIENTO SUSPENDIDO POR EPM',
      'REQUERIMIENTO CANCELADO POR EPM',
      'REQUERIMIENTO REEMPLAZADO',
    ],
  },
]

/** Mapa de estados de entrega a fases. Lo desconocido (incl. "Sin estado") cae en "Otros estados". */
export const FASES_ENTREGA: DefinicionFase[] = [
  {
    id: 'por-entregar',
    nombre: 'Por entregar',
    subtitulo: 'aún sin cargar',
    flujo: true,
    acento: 'border-t-amber-500',
    color: COLOR_GRAFICA.alerta,
    estados: ['PENDIENTE', 'ENTREGA NO CARGADA'],
  },
  {
    id: 'en-revision',
    nombre: 'En revisión',
    subtitulo: 'esperando a EPM',
    flujo: true,
    acento: 'border-t-marca-600',
    color: COLOR_GRAFICA.serie,
    estados: ['ENTREGA CARGADA', 'EN ESPERA DE APROBACION'],
  },
  {
    id: 'resueltas',
    nombre: 'Resueltas',
    subtitulo: 'aprobadas o rechazadas',
    flujo: true,
    acento: 'border-t-green-600',
    color: COLOR_GRAFICA.ok,
    estados: ['APROBADA', 'RECHAZADA'],
  },
  {
    id: 'posentrega',
    nombre: 'Posentrega',
    subtitulo: 'garantía y cambios',
    flujo: false,
    acento: 'border-t-slate-400',
    color: COLOR_NEUTRO,
    estados: ['EN GARANTIA', 'CONTROL DE CAMBIOS'],
  },
]

/** Fase de captura para estados que no están en el mapa. */
export const FASE_OTROS: DefinicionFase = {
  id: 'otros',
  nombre: 'Otros estados',
  subtitulo: 'fuera del mapa de fases',
  flujo: false,
  acento: 'border-t-slate-300',
  color: COLOR_NEUTRO,
  estados: [],
}

export function normalizarEstado(estado: string): string {
  return estado.trim().toUpperCase()
}

/** Color por estado (sin cambios respecto al dashboard anterior). */
export function colorEstado(estado: string): string {
  const normalizado = estado.toUpperCase()
  if (normalizado.includes('CANCELADO')) return COLOR_GRAFICA.malo
  if (normalizado.includes('PENDIENTE') || normalizado.includes('ESPERA')) return COLOR_GRAFICA.alerta
  if (normalizado.includes('APROBADA') || normalizado.includes('APROBADO')) return COLOR_GRAFICA.ok
  return COLOR_GRAFICA.serie
}

/** Definición de "activo": ni cancelado ni reemplazado (sin cambios). */
export function esActivo(estado: string): boolean {
  const normalizado = estado.toUpperCase()
  return !normalizado.includes('CANCELADO') && !normalizado.includes('REEMPLAZADO')
}

export function fmtNumero(valor: number): string {
  return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 })
}

/** Id de la fase de requerimiento de un estado ('otros' si no está en el mapa). */
export function faseDeRequerimiento(estado: string): string {
  const clave = normalizarEstado(estado)
  return FASES_REQUERIMIENTO.find((fase) => fase.estados.includes(clave))?.id ?? FASE_OTROS.id
}
