// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { Boton } from '../../components/ui'
import type { EventoBitacora } from '../../types'

interface Props {
  eventos: EventoBitacora[]
  puedeEliminar: boolean
  onEliminar: (eventoId: string) => void
  /** Omite el rótulo "Bitácora" interno cuando el contenedor (p. ej. un Modal) ya trae su propio título. */
  ocultarTitulo?: boolean
}

/** Entradas visibles por defecto (las más recientes, ya vienen ordenadas así del backend). */
const LIMITE_VISIBLE = 6

export default function SeccionBitacora({
  eventos,
  puedeEliminar,
  onEliminar,
  ocultarTitulo = false,
}: Props) {
  const [mostrarTodo, setMostrarTodo] = useState(false)

  const hayOcultos = eventos.length > LIMITE_VISIBLE
  const eventosVisibles = mostrarTodo ? eventos : eventos.slice(0, LIMITE_VISIBLE)

  return (
    <div className="tarjeta tarjeta-pad">
      {!ocultarTitulo && (
        <h2 className="etiqueta-sup mb-3">
          Bitácora
        </h2>
      )}
      <ul className="space-y-1 text-sm">
        {eventosVisibles.map((ev) => (
          <li key={ev.id} className="flex items-start justify-between gap-2 border-b py-1 last:border-0">
            <span>
              <span className="text-slate-400">{ev.creado_en?.slice(0, 19).replace('T', ' ')}</span>
              {' · '}<b>{ev.accion}</b> · {ev.descripcion}
              {ev.autor ? <span className="text-slate-400"> ({ev.autor})</span> : null}
            </span>
            {puedeEliminar && (
              <button
                type="button"
                onClick={() => { void onEliminar(ev.id) }}
                className="enlace-accion enlace-accion-peligro shrink-0"
              >
                Eliminar
              </button>
            )}
          </li>
        ))}
        {eventos.length === 0 && <li className="text-slate-400">Sin eventos.</li>}
      </ul>
      {hayOcultos && (
        <div className="mt-3 flex justify-center">
          <Boton
            variante="secundario"
            tamano="sm"
            onClick={() => setMostrarTodo((v) => !v)}
          >
            {mostrarTodo ? 'Mostrar menos' : `Ver bitácora completa (${eventos.length})`}
          </Boton>
        </div>
      )}
    </div>
  )
}
