// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import { Boton } from '../../components/ui'
import type { EliminacionPendiente } from './useEliminacionDiferida'

interface Props {
  pendientes: EliminacionPendiente[]
  onDeshacer: (asigId: string) => void
  /** Abre la vista previa para repartir entre las demás asignaciones de la persona. */
  onRepartir: (personaId: string) => void
  /** Si la persona tiene otras asignaciones activas entre las que repartir. */
  puedeRepartir: (personaId: string) => boolean
  puedeEditar: boolean
}

/**
 * Avisos de "Asignación eliminada · Deshacer (8 s)". El DELETE aún no se envió:
 * mientras corre la cuenta atrás se puede deshacer. Ofrece, sin aplicarlo solo,
 * repartir lo liberado entre las otras asignaciones de la persona.
 */
export function ToastDeshacer({ pendientes, onDeshacer, onRepartir, puedeRepartir, puedeEditar }: Props) {
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (pendientes.length === 0) return
    setAhora(Date.now())
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [pendientes.length])

  if (pendientes.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {pendientes.map((pendiente) => {
        const segundos = Math.max(0, Math.ceil((pendiente.vence - ahora) / 1000))
        const liberado = pendiente.asig.total_porcentaje
        return (
          <div
            key={pendiente.asig.id}
            role="status"
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span className="min-w-0">
              Asignación eliminada · <span className="font-medium">{pendiente.descripcion}</span>
            </span>
            <span className="flex items-center gap-2">
              <Boton variante="fantasma" tamano="sm" className="!text-white underline" onClick={() => onDeshacer(pendiente.asig.id)}>
                Deshacer <span aria-hidden="true">({segundos} s)</span>
              </Boton>
              {puedeEditar && liberado > 0 && puedeRepartir(pendiente.asig.persona_id) && (
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  className="!text-white underline"
                  onClick={() => onRepartir(pendiente.asig.persona_id)}
                >
                  Liberaste {liberado}% · Repartir…
                </Boton>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
