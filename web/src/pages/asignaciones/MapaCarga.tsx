// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Selector } from '../../components/ui'
import type { Persona } from '../../types'
import { CLASE_BORDE_NIVEL, ETIQUETA_NIVEL, formatearPct, nivelCarga } from './carga'
import type { CargaPersona } from './carga'
import type { OrdenPersonas } from './tipos'

interface Props {
  filas: { persona: Persona; carga: CargaPersona }[]
  orden: OrdenPersonas
  onOrden: (orden: OrdenPersonas) => void
  onIrAPersona: (personaId: string) => void
}

/**
 * Mapa de carga del equipo: una celda por persona con su % y el color del
 * umbral (>100 sobrecarga · 90–100 alta · 70–89 normal · <70 holgura). Un clic
 * lleva a la tarjeta de la persona.
 */
export function MapaCarga({ filas, orden, onOrden, onIrAPersona }: Props) {
  if (filas.length === 0) return null
  return (
    <details open className="tarjeta tarjeta-pad mb-4">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-700">
        <span>Mapa de carga del equipo</span>
      </summary>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-slate-500">
          Un clic lleva a la persona. Umbrales: &gt;100% sobrecarga · 90–100% alta · 70–89% normal · &lt;70% holgura.
        </p>
        <Selector
          etiqueta="Ordenar"
          compacto
          value={orden}
          onChange={(e) => onOrden(e.target.value === 'nombre' ? 'nombre' : 'carga')}
        >
          <option value="carga">Mayor carga primero</option>
          <option value="nombre">Nombre</option>
        </Selector>
      </div>
      <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-1.5">
        {filas.map(({ persona, carga }) => {
          const nivel = nivelCarga(carga.total)
          return (
            <li key={persona.id}>
              <button
                type="button"
                onClick={() => onIrAPersona(persona.id)}
                aria-label={`${persona.nombre}: ${formatearPct(carga.total)}%, ${ETIQUETA_NIVEL[nivel]}`}
                className={`flex w-full items-center justify-between gap-2 rounded-lg border border-l-[3px] border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 ${CLASE_BORDE_NIVEL[nivel]}`}
              >
                <span className="min-w-0 truncate text-slate-700">{persona.nombre}</span>
                <b className="tabular-nums text-slate-900">{formatearPct(carga.total)}%</b>
              </button>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
