import { ESTADO_ACTIVO } from './tipos'

/** Tono del `Chip` según el estado del requerimiento (verde activo, gris
 * cancelado, ámbar el resto). Mismo criterio que el antiguo `claseBadgeEstado`. */
export function tonoEstadoChip(estado: string | null): 'exito' | 'neutro' | 'alerta' {
  if (!estado) return 'neutro'
  if (estado === ESTADO_ACTIVO) return 'exito'
  if (estado.toLowerCase().includes('cancel')) return 'neutro'
  return 'alerta'
}
