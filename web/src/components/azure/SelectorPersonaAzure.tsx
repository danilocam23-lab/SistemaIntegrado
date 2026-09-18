// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Selector } from '../ui'
import type { PersonaConfigAzure } from '../../types'

interface Props {
  puedeElegir: boolean
  personasConConfig: PersonaConfigAzure[]
  usuarioId: string
  personaSeleccionada: PersonaConfigAzure | null
  onCambiar: (valor: string) => void
}

/** Selector de configuración (PAT) por persona para Azure DevOps. Solo se
 * renderiza cuando el usuario puede elegir cualquier configuración. */
export function SelectorPersonaAzure({
  puedeElegir,
  personasConConfig,
  usuarioId,
  personaSeleccionada,
  onCambiar,
}: Props) {
  if (!puedeElegir) return null

  return (
    <div className="flex items-end gap-3">
      <Selector
        etiqueta="Configuración (PAT)"
        value={usuarioId}
        onChange={(evento) => onCambiar(evento.target.value)}
        disabled={personasConConfig.length === 0}
        className="min-w-64"
        compacto
      >
        {personasConConfig.length === 0 ? (
          <option value="">Sin configuraciones personales</option>
        ) : (
          <>
            <option value="">Configuración global</option>
            {personasConConfig.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombre}{persona.email ? ` (${persona.email})` : ''}
              </option>
            ))}
          </>
        )}
      </Selector>
      {personaSeleccionada && (
        <span className="pb-2 text-xs font-medium text-marca">
          Usando la configuración de {personaSeleccionada.nombre}
        </span>
      )}
    </div>
  )
}
