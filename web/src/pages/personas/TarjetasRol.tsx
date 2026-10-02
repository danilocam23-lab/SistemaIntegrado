// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import { cx } from '../../components/ui'
import { ChipRol } from './ChipRol'
import { ROL_SIN_CONTRATACION } from './roles'

interface Props {
  resumen: Array<{ rol: string; total: number; activas: number }>
  rolActivo: string
  onElegir: (rol: string) => void
}

/** Tarjetas-contador por rol; pulsar una filtra la lista por ese rol (otra vez, la quita). */
export function TarjetasRol({ resumen, rolActivo, onElegir }: Props) {
  return (
    <div role="group" aria-label="Resumen por rol" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {resumen.map(({ rol, total, activas }) => {
        const elegida = rolActivo === rol
        return (
          <button
            key={rol}
            type="button"
            aria-pressed={elegida}
            onClick={() => onElegir(elegida ? '' : rol)}
            className={cx(
              'flex min-w-0 flex-col items-start gap-1 rounded-xl border bg-white p-2.5 text-left shadow-sm transition-colors',
              'hover:border-marca-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500',
              elegida ? 'border-marca-500 ring-2 ring-marca-200' : 'border-slate-200',
            )}
          >
            <ChipRol rol={rol} />
            <span className="text-xl font-bold leading-none text-slate-800">{total}</span>
            <span className="text-2xs text-slate-500">
              {activas} activa{activas === 1 ? '' : 's'}
              {rol === ROL_SIN_CONTRATACION && ' · sin valores'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
