// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { useState } from 'react'
import { Boton, Campo, Chip } from '../../components/ui'

interface Props {
  seleccionados: string[]
  disponibles: string[]
  deshabilitado?: boolean
  onCambiar: (squads: string[]) => void
}

/** Squads como chips con buscador. El primero es el «principal» (fija la aplicación). */
export function SelectorSquads({ seleccionados, disponibles, deshabilitado, onCambiar }: Props) {
  const [q, setQ] = useState('')
  const texto = q.trim().toLowerCase()
  const opciones = disponibles.filter((s) => !seleccionados.includes(s) && s.toLowerCase().includes(texto))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" aria-label="Squads seleccionados">
        {seleccionados.length === 0 && <span className="text-xs text-slate-400">Sin squads</span>}
        {seleccionados.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1">
            <Chip tono={i === 0 ? 'marca' : 'neutro'}>
              {s}
              {i === 0 && ' · principal'}
            </Chip>
            {!deshabilitado && i > 0 && (
              <Boton
                tamano="sm"
                variante="fantasma"
                aria-label={`Hacer principal el squad ${s}`}
                title="Hacer principal"
                onClick={() => onCambiar([s, ...seleccionados.filter((x) => x !== s)])}
              >
                ★
              </Boton>
            )}
            {!deshabilitado && (
              <Boton
                tamano="sm"
                variante="fantasma"
                aria-label={`Quitar el squad ${s}`}
                onClick={() => onCambiar(seleccionados.filter((x) => x !== s))}
              >
                ×
              </Boton>
            )}
          </span>
        ))}
      </div>
      {!deshabilitado && (
        <>
          <Campo
            compacto
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar squad para agregar…"
            aria-label="Buscar squad para agregar"
            className="w-full"
          />
          <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {opciones.length === 0 && <span className="text-xs text-slate-400">No hay más squads.</span>}
            {opciones.map((s) => (
              <Boton
                key={s}
                tamano="sm"
                onClick={() => {
                  onCambiar([...seleccionados, s])
                  setQ('')
                }}
              >
                + {s}
              </Boton>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
