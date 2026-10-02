// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import { Boton } from '../../components/ui'
import type { EliminacionCapacidadPendiente } from './useEliminacionCapacidad'

interface Props {
  pendientes: EliminacionCapacidadPendiente[]
  onDeshacer: (registroId: string) => void
}

/**
 * Avisos "Capacidad eliminada · Deshacer (8 s)". El DELETE aún no se envió:
 * mientras corre la cuenta atrás se puede deshacer.
 */
export function ToastEliminacion({ pendientes, onDeshacer }: Props) {
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
        return (
          <div
            key={pendiente.registro.id}
            role="status"
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span className="min-w-0">
              Capacidad de <span className="font-medium">{pendiente.descripcion}</span> eliminada
            </span>
            <Boton
              variante="fantasma"
              tamano="sm"
              className="!text-white underline"
              onClick={() => onDeshacer(pendiente.registro.id)}
            >
              Deshacer <span aria-hidden="true">({segundos} s)</span>
            </Boton>
          </div>
        )
      })}
    </div>
  )
}
