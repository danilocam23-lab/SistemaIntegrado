// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Aviso, Icono } from '../../components/ui'
import type { Persona } from '../../types'
import type { CargaPersona } from './carga'
import { formatearPct } from './carga'

interface Props {
  filas: { persona: Persona; carga: CargaPersona }[]
  puedeEditar: boolean
  onVerAsignaciones: (personaId: string) => void
  onRevisarReparto: (personaId: string) => void
}

/**
 * Aviso de sobrecarga: quién supera el 100% y con qué carga. Reemplaza al
 * autocorrector silencioso: lo único que ofrece es abrir una vista previa del
 * reparto ("Revisar reparto…"), que el usuario aplica o descarta.
 */
export function AvisoSobrecarga({ filas, puedeEditar, onVerAsignaciones, onRevisarReparto }: Props) {
  if (filas.length === 0) return null
  return (
    <Aviso tono="alerta" className="mb-4">
      <div role="alert" className="grid gap-1.5">
        <p className="inline-flex items-center gap-1.5 font-semibold">
          <Icono nombre="alerta" />
          {filas.length === 1 ? '1 persona supera el 100%' : `${filas.length} personas superan el 100%`}
        </p>
        <ul className="grid gap-1">
          {filas.map(({ persona, carga }) => (
            <li key={persona.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>
                <b>{persona.nombre}</b> ({formatearPct(carga.total)}%)
              </span>
              <button type="button" className="enlace-accion" onClick={() => onVerAsignaciones(persona.id)}>
                Ver sus asignaciones
              </button>
              {puedeEditar && carga.nActivas > 0 && (
                <button type="button" className="enlace-accion" onClick={() => onRevisarReparto(persona.id)}>
                  Revisar reparto…
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Aviso>
  )
}
