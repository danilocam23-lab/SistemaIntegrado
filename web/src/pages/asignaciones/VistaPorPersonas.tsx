// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { ReactNode } from 'react'
import type { BacklogFuturo, Categoria } from '../../types'
import type { CargaPersona } from './carga'
import type { AsignacionItem, GrupoPersona, WoPersona } from './tipos'
import { TarjetaPersona } from './TarjetaPersona'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

interface Props {
  gruposPorPersona: GrupoPersona[]
  personasExpandidas: Set<string>
  onAlternarPersona: (personaId: string) => void
  wosPorPersonaMap: Map<string, WoPersona[]>
  backlogPorPersonaMap: Map<string, BacklogFuturo[]>
  categoriaPorId: Map<string, Categoria>
  cargaDe: (personaId: string) => CargaPersona
  puedeEditarAsignaciones: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
  erroresFila: Record<string, string>
  onCerrarError: (asigId: string) => void
  onEditar: (asig: AsignacionItem) => void
  onEliminar: (asig: AsignacionItem) => void
  onAsignar: (personaId: string) => void
  onRepartir: (personaId: string) => void
  vacio: ReactNode
}

/** Vista "Por Personas": lista de tarjetas de persona expandibles + estado vacío. */
export function VistaPorPersonas({
  gruposPorPersona,
  personasExpandidas,
  onAlternarPersona,
  wosPorPersonaMap,
  backlogPorPersonaMap,
  categoriaPorId,
  cargaDe,
  puedeEditarAsignaciones,
  escrituras,
  erroresFila,
  onCerrarError,
  onEditar,
  onEliminar,
  onAsignar,
  onRepartir,
  vacio,
}: Props) {
  return (
    <div className="space-y-3">
      {gruposPorPersona.map((grupo) => (
        <TarjetaPersona
          key={grupo.persona.id}
          grupo={grupo}
          expandida={personasExpandidas.has(grupo.persona.id)}
          onToggle={() => onAlternarPersona(grupo.persona.id)}
          categoriaPorId={categoriaPorId}
          wos={wosPorPersonaMap.get(grupo.persona.id) ?? []}
          backlogFuturo={backlogPorPersonaMap.get(grupo.persona.id) ?? []}
          carga={cargaDe(grupo.persona.id)}
          puedeEditarAsignaciones={puedeEditarAsignaciones}
          escrituras={escrituras}
          erroresFila={erroresFila}
          onCerrarError={onCerrarError}
          onEditar={onEditar}
          onEliminar={onEliminar}
          onAsignar={onAsignar}
          onRepartir={onRepartir}
        />
      ))}
      {gruposPorPersona.length === 0 && (
        <div className="tarjeta p-6 text-center text-sm text-slate-500">{vacio}</div>
      )}
    </div>
  )
}
