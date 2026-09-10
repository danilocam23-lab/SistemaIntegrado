import type { Asignacion, Persona } from '../../types'

export const ESTADO_ACTIVO = 'ESTIMACION APROBADA ENTREGA PENDIENTE'

// Roles válidos para asignaciones (excluye LT_EPM)
// Si se crean nuevos roles, se incluirán automáticamente
export const ROLES_EXCLUIDOS = ['LT_EPM']

export type AsignacionItem = Asignacion & {
  aplicacion_id?: string
  activo?: boolean
}

export interface OpcionReq {
  id: string
  label: string
  aplicacionId: string
  estado?: string
}

export interface ItemGrupo {
  asig: AsignacionItem
  horasCarga: number
}

export interface GrupoReq {
  reqId: string | null
  reqLabel: string
  reqEstado: string | null
  /** Horas estimadas del requerimiento (calculado en `gruposReq`, donde ya se
   *  hace el `find`, para que la cabecera de la vista no lo repita). */
  horasEstimadas: number | null
  items: ItemGrupo[]
}

export interface GrupoPersona {
  persona: Persona
  reqs: {
    reqId: string | null
    reqLabel: string
    reqEstado: string | null
    asig: AsignacionItem
    horasCarga: number
  }[]
}

export interface WoPersona {
  id: string
  wo_id: string
  assigned_to: string
  status: string
  priority: string
  created_date: string
  descripcion: string
}
