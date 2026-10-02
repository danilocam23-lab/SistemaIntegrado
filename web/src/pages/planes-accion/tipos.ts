// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Persona } from '../../types'

export const ESTADOS = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO'] as const
export type EstadoPlan = (typeof ESTADOS)[number]

export const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
}

export const ESTADO_TONO: Record<string, 'neutro' | 'marca' | 'exito' | 'alerta' | 'error'> = {
  PENDIENTE: 'alerta',
  EN_PROGRESO: 'marca',
  COMPLETADO: 'exito',
  CANCELADO: 'neutro',
}

/** Roles operativos que pueden ser responsables de un plan (solo para ASIGNAR). */
export const ROLES_RESPONSABLE = ['LT_HITSS', 'SCRUM']

/** Segundos que dura el "Deshacer" (eliminar y cambio de estado). */
export const SEGUNDOS_DESHACER = 8

export type FiltroVencimiento = '' | 'vencidos' | 'semana' | 'sin_fecha'
export type VistaPlanes = 'lista' | 'tablero'
export type OrdenPlanes = 'reciente' | 'fecha'

export interface FiltrosPlanes {
  estado: string
  vencimiento: FiltroVencimiento
  /** '' = todos, '__ninguno__' = sin responsable, o id de persona. */
  responsable: string
  busqueda: string
  orden: OrdenPlanes
}

export const SIN_RESPONSABLE = '__ninguno__'

export const FILTROS_INICIALES: FiltrosPlanes = {
  estado: '',
  vencimiento: '',
  responsable: '',
  busqueda: '',
  orden: 'reciente',
}

export interface FormPlan {
  id: string | null
  titulo: string
  descripcion: string
  responsableId: string
  fechaLimite: string
  estado: string
}

export const FORM_VACIO: FormPlan = {
  id: null,
  titulo: '',
  descripcion: '',
  responsableId: '',
  fechaLimite: '',
  estado: 'PENDIENTE',
}

export function esAbierto(estado: string): boolean {
  return estado === 'PENDIENTE' || estado === 'EN_PROGRESO'
}

/** Estado al que pasa el plan con un clic: Pendiente → En progreso → Completado → Pendiente. */
export function siguienteEstado(estado: string): string {
  if (estado === 'PENDIENTE') return 'EN_PROGRESO'
  if (estado === 'EN_PROGRESO') return 'COMPLETADO'
  return 'PENDIENTE'
}

/** Cuerpo parcial del PUT para cambiar solo el estado (no pisa otras ediciones). */
export function cuerpoSoloEstado(estado: string) {
  return { estado }
}

export interface InfoResponsable {
  nombre: string
  rol: string | null
  inactivo: boolean
  /** La persona ya no figura en la lista. */
  desconocido: boolean
}

/** Datos para MOSTRAR al responsable: usa la lista completa (incluye inactivos). */
export function infoResponsable(id: string | null, personas: Map<string, Persona>): InfoResponsable | null {
  if (!id) return null
  const p = personas.get(id)
  if (!p) return { nombre: 'Responsable no encontrado', rol: null, inactivo: false, desconocido: true }
  return { nombre: p.nombre, rol: p.rol_operativo, inactivo: !p.activo, desconocido: false }
}

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
