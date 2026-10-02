// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { cx } from '../../components/ui'
import { CLASE_TONO } from './base'
import type { TonoCelda } from './tipos'

const ITEMS: Array<{ tono: TonoCelda; texto: string }> = [
  { tono: 'ok', texto: 'En la base (±5 %)' },
  { tono: 'bajo', texto: 'Por debajo de la base' },
  { tono: 'critico', texto: 'Menos de la mitad' },
  { tono: 'alto', texto: 'Por encima de la base' },
  { tono: 'sin', texto: 'Sin registro (se aplica la base sugerida*)' },
]

/** Leyenda de colores del mapa de calor y nota de la fórmula de la base sugerida. */
export function LeyendaCapacidades() {
  return (
    <div className="mt-3 text-xs text-slate-500">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label="Leyenda de colores">
        {ITEMS.map((item) => (
          <li key={item.tono} className="inline-flex items-center gap-1.5">
            <i className={cx('inline-block h-3 w-3 rounded', CLASE_TONO[item.tono])} aria-hidden="true" />
            {item.texto}
          </li>
        ))}
      </ul>
      <p className="mt-1.5">
        * Base sugerida = horas del mes por defecto × días hábiles ÷ días laborables; es la misma fórmula del
        Dashboard Backlog. Solo se sugiere: no se guarda sola.
      </p>
    </div>
  )
}
