// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react'
import { Boton } from '../../components/ui'
import type { AvisoPlan } from './useEscriturasPlanes'

interface Props {
  avisos: AvisoPlan[]
}

/**
 * Avisos "… · Deshacer (8 s)". Mismo patrón visual que Asignaciones y
 * Capacidades; sirve para el cambio de estado y para la eliminación.
 */
export function ToastPlanes({ avisos }: Props) {
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (avisos.length === 0) return
    setAhora(Date.now())
    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(intervalo)
  }, [avisos.length])

  if (avisos.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {avisos.map((aviso) => {
        const segundos = Math.max(0, Math.ceil((aviso.vence - ahora) / 1000))
        return (
          <div
            key={aviso.clave}
            role="status"
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span className="min-w-0 break-words">{aviso.texto}</span>
            <Boton variante="fantasma" tamano="sm" className="!text-white underline" onClick={aviso.deshacer}>
              Deshacer <span aria-hidden="true">({segundos} s)</span>
            </Boton>
          </div>
        )
      })}
    </div>
  )
}
