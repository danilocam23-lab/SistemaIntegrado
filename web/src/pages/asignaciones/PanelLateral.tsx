// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useEffect, useId } from 'react'
import type { ReactNode } from 'react'
import { Icono } from '../../components/ui'

interface Props {
  abierto: boolean
  titulo: ReactNode
  onCerrar: () => void
  /** Zona fija inferior (botones). */
  pie?: ReactNode
  children: ReactNode
}

/**
 * Panel lateral deslizante (hoja inferior en móvil) con fondo atenuado. Se
 * cierra con Esc o al hacer clic en el fondo. El listado de detrás sigue
 * visible para no perder el contexto.
 *
 * Primitivo candidato a `components/ui` si otra pantalla necesita el patrón.
 */
export function PanelLateral({ abierto, titulo, onCerrar, pie, children }: Props) {
  const idTitulo = useId()

  useEffect(() => {
    if (!abierto) return
    function alPulsarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPulsarTecla)
    return () => document.removeEventListener('keydown', alPulsarTecla)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onCerrar} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="absolute inset-x-0 bottom-0 top-10 flex flex-col rounded-t-2xl bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:rounded-none"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 id={idTitulo} className="min-w-0 truncate text-sm font-semibold text-marca-osc">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded p-1 text-slate-400 hover:text-slate-700"
            aria-label="Cerrar panel"
          >
            <Icono nombre="x" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {pie && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">{pie}</footer>
        )}
      </aside>
    </div>
  )
}
