// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Chip, Tarjeta } from '../../components/ui'
import type { NivelJerarquiaAzure } from '../../types'

interface Props {
  jerarquia: NivelJerarquiaAzure[]
}

export function PanelJerarquia({ jerarquia }: Props) {
  if (jerarquia.length === 0) return null

  const niveles = [...jerarquia].sort((a, b) => b.rango - a.rango)

  return (
    <Tarjeta className="space-y-3">
      <div>
        <h2 className="titulo-seccion">Jerarquía del proceso</h2>
        <p className="text-xs text-slate-500">Referencia leída desde Azure DevOps para este proyecto.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {niveles.map((nivel, indice) => (
          <div key={`${nivel.nombre}-${nivel.rango}`} className="flex items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-2xs font-bold uppercase tracking-wide text-slate-500">{nivel.nombre}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {nivel.tipos.map((tipo) => <Chip key={tipo} tono="marca">{tipo}</Chip>)}
              </div>
            </div>
            {indice < niveles.length - 1 && <span className="text-slate-300">→</span>}
          </div>
        ))}
      </div>
    </Tarjeta>
  )
}
