// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import type { BacklogFuturo, Categoria } from '../../types'
import type { GrupoPersona, WoPersona } from './tipos'
import { TarjetaPersona } from './TarjetaPersona'
import type { useEscriturasAsignaciones } from './useEscriturasAsignaciones'

interface Props {
  gruposPorPersona: GrupoPersona[]
  personasExpandidas: Set<string>
  onAlternarPersona: (personaId: string) => void
  wosPorPersonaMap: Map<string, WoPersona[]>
  backlogPorPersonaMap: Map<string, BacklogFuturo[]>
  categoriaPorId: Map<string, Categoria>
  puedeEditarAsignaciones: boolean
  escrituras: ReturnType<typeof useEscriturasAsignaciones>
}

/** Vista "Por Personas": lista de tarjetas de persona expandibles + estado vacío. */
export function VistaPorPersonas({
  gruposPorPersona,
  personasExpandidas,
  onAlternarPersona,
  wosPorPersonaMap,
  backlogPorPersonaMap,
  categoriaPorId,
  puedeEditarAsignaciones,
  escrituras,
}: Props) {
  return (
    <div className="space-y-4">
      {gruposPorPersona.map((grupo) => (
        <TarjetaPersona
          key={grupo.persona.id}
          grupo={grupo}
          expandida={personasExpandidas.has(grupo.persona.id)}
          onToggle={() => onAlternarPersona(grupo.persona.id)}
          categoriaPorId={categoriaPorId}
          wos={wosPorPersonaMap.get(grupo.persona.id) ?? []}
          backlogFuturo={backlogPorPersonaMap.get(grupo.persona.id) ?? []}
          puedeEditarAsignaciones={puedeEditarAsignaciones}
          escrituras={escrituras}
        />
      ))}
      {gruposPorPersona.length === 0 && (
        <div className="tarjeta p-6 text-center text-sm text-slate-400">
          Sin asignaciones para mostrar.
        </div>
      )}
    </div>
  )
}
