// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { Asignacion, BacklogFuturo, Persona } from '../../types'

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

/** Horas de Azure DevOps ya agregadas para una persona (o para "sin persona"). */
export interface HorasAzureGrupo {
  originalEstimate: number
  completedWork: number
  remainingWork: number
}

export interface ItemGrupo {
  asig: AsignacionItem
  horasCarga: number
  /** `null` cuando el requerimiento del grupo no tiene Feature de Azure vinculada. */
  horasAzure: HorasAzureGrupo | null
}

export interface GrupoReq {
  reqId: string | null
  reqLabel: string
  reqEstado: string | null
  /** Horas estimadas del requerimiento (calculado en `gruposReq`, donde ya se
   *  hace el `find`, para que la cabecera de la vista no lo repita). */
  horasEstimadas: number | null
  /** `id_azure_hitss` del requerimiento del grupo (`null` = sin Feature vinculada). */
  idAzureHitss: number | null
  /** Horas de Tasks de Azure sin persona reconocida en el sistema (incluye
   *  `email: null` y correos que no coinciden con ningún `Persona.email`).
   *  `null` si el grupo no tiene Feature vinculada. */
  horasAzureSinPersona: HorasAzureGrupo | null
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

export type BacklogPorPersonaMap = Map<string, BacklogFuturo[]>
