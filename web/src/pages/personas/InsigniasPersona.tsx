// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip } from '../../components/ui'
import type { Persona } from '../../types'

/** Insignias de la persona: líder técnico, sobrecarga, usuario vinculado e inactiva. Siempre con texto. */
export function InsigniasPersona({ persona }: { persona: Persona }) {
  return (
    <>
      {persona.es_lider_tecnico && <Chip tono="marca" title="Líder técnico">★ Líder técnico</Chip>}
      {persona.permite_sobrecarga && (
        <Chip tono="alerta" title="Se le puede asignar por encima de su capacidad">Sobrecarga</Chip>
      )}
      {persona.usuario_id && <Chip tono="neutro" title="Vinculada a una cuenta de usuario">con usuario</Chip>}
      {!persona.activo && <Chip tono="error">Inactiva</Chip>}
    </>
  )
}
