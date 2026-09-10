import { ESTADO_ACTIVO } from './tipos'

/** Clases del badge según el estado del requerimiento (verde activo, gris
 * cancelado, ámbar el resto). Copiado tal cual del antiguo `badgeEstadoClass`. */
export function claseBadgeEstado(estado: string | null): string {
  if (!estado) return 'bg-slate-100 text-slate-600'
  if (estado === ESTADO_ACTIVO) return 'bg-green-100 text-green-700'
  if (estado.toLowerCase().includes('cancel')) return 'bg-slate-100 text-slate-700'
  return 'bg-amber-100 text-amber-700'
}
