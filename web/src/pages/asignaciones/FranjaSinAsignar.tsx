// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { Boton, Chip } from '../../components/ui'
import type { OpcionReq } from './tipos'

const MAXIMO_VISIBLE = 6

interface Props {
  requerimientos: OpcionReq[]
  puedeEditar: boolean
  onAsignar: (requerimientoId: string) => void
}

/**
 * Franja de requerimientos activos que no tienen a nadie asignado. Los grupos
 * de la pantalla nacen de las asignaciones, así que estos no aparecerían en
 * ninguna otra parte.
 */
export function FranjaSinAsignar({ requerimientos, puedeEditar, onAsignar }: Props) {
  const [verTodos, setVerTodos] = useState(false)
  if (requerimientos.length === 0) return null
  const visibles = verTodos ? requerimientos : requerimientos.slice(0, MAXIMO_VISIBLE)
  const ocultos = requerimientos.length - visibles.length

  return (
    <section aria-label="Requerimientos activos sin asignar" className="tarjeta tarjeta-pad mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Requerimientos activos sin asignar</h2>
        <Chip tono="alerta">{requerimientos.length}</Chip>
        <span className="text-xs text-slate-500">ninguna persona a cargo todavía</span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {visibles.map((req) => (
          <li
            key={req.id}
            className="flex max-w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 py-1 pl-3 pr-1 text-xs text-slate-700"
          >
            <span className="min-w-0 truncate" title={req.label}>{req.label}</span>
            {puedeEditar && (
              <Boton tamano="sm" variante="suave" onClick={() => onAsignar(req.id)}>
                + Asignar
              </Boton>
            )}
          </li>
        ))}
      </ul>
      {(ocultos > 0 || verTodos) && requerimientos.length > MAXIMO_VISIBLE && (
        <button type="button" className="enlace-accion mt-2" onClick={() => setVerTodos((v) => !v)}>
          {verTodos ? 'Ver menos' : `Ver los ${ocultos} restantes`}
        </button>
      )}
    </section>
  )
}
