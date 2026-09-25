// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { Boton } from '../../components/ui'
import type { PresetRango } from './tipos'

const PRESETS: Array<{ valor: PresetRango; etiqueta: string }> = [
  { valor: 3, etiqueta: 'Últimos 3 meses' },
  { valor: 6, etiqueta: 'Últimos 6 meses' },
  { valor: 12, etiqueta: 'Últimos 12 meses' },
  { valor: 'todo', etiqueta: 'Todo' },
]

interface Props {
  activo: PresetRango | null
  onSeleccionar: (preset: PresetRango) => void
}

/** Atajos de rango relativo a hoy; alimentan el mismo filtro de periodo que Año/Mes. */
export default function FiltroRangoRapido({ activo, onSeleccionar }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Rango rápido de fechas">
      {PRESETS.map((preset) => (
        <Boton
          key={String(preset.valor)}
          tamano="sm"
          variante={activo === preset.valor ? 'primario' : 'secundario'}
          aria-pressed={activo === preset.valor}
          onClick={() => onSeleccionar(preset.valor)}
        >
          {preset.etiqueta}
        </Boton>
      ))}
    </div>
  )
}
